import prisma from '../server/db';
import {
  TaskState,
  StepState,
  RiskLevel,
  VerificationVerdictType,
  ActionStatus,
  PlannedStep,
  StructuredObjective
} from '../core/types';
import { TaskStateMachine } from '../core/state-machine';
import { PolicyEngine } from '../core/policy';
import { AuditLogger } from '../core/audit';
import { EventBroadcaster } from '../server/events';
import { IntentAgent } from './intent.agent';
import { PlanningAgent } from './planning.agent';
import { ExecutionAgent } from './execution.agent';
import { VerificationAndRecoveryAgent } from './verification-recovery.agent';
import { MemoryAgent } from './memory.agent';
import { DeviceRoutingAgent } from './device-routing.agent';
import { ToolRegistry } from '../tools/registry';
import { IModelProvider } from '../providers/model.provider';

export class JarvisOrchestrator {
  private intentAgent: IntentAgent;
  private planningAgent: PlanningAgent;
  private executionAgent: ExecutionAgent;
  private verificationAgent: VerificationAndRecoveryAgent;
  private memoryAgent: MemoryAgent;
  private deviceRoutingAgent: DeviceRoutingAgent;
  private toolRegistry: ToolRegistry;
  private broadcaster: EventBroadcaster;

  constructor(private modelProvider: IModelProvider) {
    this.intentAgent = new IntentAgent(this.modelProvider);
    this.planningAgent = new PlanningAgent(this.modelProvider);
    this.executionAgent = new ExecutionAgent();
    this.verificationAgent = new VerificationAndRecoveryAgent();
    this.memoryAgent = new MemoryAgent();
    this.deviceRoutingAgent = new DeviceRoutingAgent();
    this.toolRegistry = ToolRegistry.getInstance();
    this.broadcaster = EventBroadcaster.getInstance();
  }

  /**
   * Primary entry point: Handles a natural-language goal from the user.
   */
  public async submitTask(userId: string, request: string): Promise<string> {
    AuditLogger.log('TASK_SUBMITTED', { request }, { userId });

    // 1. Create task record in RECEIVED state
    const task = await prisma.task.create({
      data: {
        userId,
        originalRequest: request,
        normalizedObjective: '',
        successCriteria: '[]',
        status: TaskState.RECEIVED,
        riskLevel: RiskLevel.LEVEL_0_READ_ONLY
      }
    });

    this.broadcaster.broadcast({
      type: 'TASK_CREATED',
      userId,
      taskId: task.id,
      payload: { id: task.id, status: TaskState.RECEIVED, request }
    });

    // Run pipeline asynchronously or synchronously
    setImmediate(async () => {
      try {
        await this.processTask(task.id, userId);
      } catch (err: any) {
        console.error(`Fatal error processing task ${task.id}:`, err);
        await this.updateTaskStatus(task.id, TaskState.FAILED, err.message);
      }
    });

    return task.id;
  }

  /**
   * Main lifecycle coordinator
   */
  public async processTask(taskId: string, userId: string): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { steps: true }
    });
    if (!task) return;

    // A. UNDERSTANDING PHASE
    if (task.status === TaskState.RECEIVED) {
      await this.updateTaskStatus(taskId, TaskState.UNDERSTANDING);

      // Load relevant user context
      const memories = await this.memoryAgent.getRelevantContext(userId, task.originalRequest);
      const objective = await this.intentAgent.understandIntent(task.originalRequest, {
        userId,
        existingMemories: memories
      });

      await prisma.task.update({
        where: { id: taskId },
        data: {
          normalizedObjective: objective.goal,
          successCriteria: JSON.stringify(objective.successCriteria),
          riskLevel: objective.maxRiskLevel,
          checkpointData: JSON.stringify({ objective })
        }
      });

      await this.updateTaskStatus(taskId, TaskState.PLANNING);
    }

    // B. PLANNING PHASE
    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { steps: true }
    });
    if (!updatedTask) return;

    if (updatedTask.status === TaskState.PLANNING) {
      const checkpoint = updatedTask.checkpointData ? JSON.parse(updatedTask.checkpointData) : {};
      const objective: StructuredObjective = checkpoint.objective || {
        goal: updatedTask.originalRequest,
        constraints: [],
        preferences: [],
        relevantApplications: [],
        relevantResources: [],
        requiredOutputs: [],
        missingInputs: [],
        assumptions: [],
        successCriteria: [],
        maxRiskLevel: updatedTask.riskLevel,
        requiresUserApproval: false
      };

      const plan = await this.planningAgent.createPlan(taskId, objective, userId);

      // Persist planned steps
      for (const step of plan.steps) {
        await prisma.taskStep.create({
          data: {
            id: `${taskId}_${step.stepId}`,
            taskId,
            stepIndex: step.stepIndex,
            title: step.title,
            capability: step.capability,
            toolName: step.toolName,
            inputData: JSON.stringify(step.inputData),
            status: StepState.PENDING,
            riskLevel: step.riskLevel,
            preconditions: step.preconditions,
            postconditions: step.expectedPostcondition,
            verificationMethod: step.verificationMethod,
            timeoutMs: step.timeoutMs,
            retryPolicy: JSON.stringify(step.retryPolicy),
            dependencies: JSON.stringify(step.dependencies)
          }
        });
      }

      await this.updateTaskStatus(taskId, TaskState.AUTHORIZATION_CHECK);
    }

    // C. AUTHORIZATION CHECK PHASE
    const taskWithSteps = await prisma.task.findUnique({
      where: { id: taskId },
      include: { steps: true }
    });
    if (!taskWithSteps) return;

    if (taskWithSteps.status === TaskState.AUTHORIZATION_CHECK) {
      await this.updateTaskStatus(taskId, TaskState.READY);
    }

    // D. EXECUTION & VERIFICATION ENGINE (READY / RUNNING)
    await this.runExecutionLoop(taskId, userId);
  }

  /**
   * Execution loop with DAG dependency evaluation, concurrency bounding, approvals,
   * verification, and autonomous recovery.
   */
  public async runExecutionLoop(taskId: string, userId: string): Promise<void> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { steps: { orderBy: { stepIndex: 'asc' } } }
    });
    if (!task) return;
    if (TaskStateMachine.isTerminal(task.status as TaskState) || task.status === TaskState.WAITING_FOR_USER) {
      return;
    }

    await this.updateTaskStatus(taskId, TaskState.RUNNING);

    while (true) {
      const currentTask = await prisma.task.findUnique({
        where: { id: taskId },
        include: { steps: { orderBy: { stepIndex: 'asc' } } }
      });
      if (!currentTask || TaskStateMachine.isTerminal(currentTask.status as TaskState)) {
        break;
      }
      if (currentTask.status === TaskState.WAITING_FOR_USER) {
        break;
      }

      const steps = currentTask.steps;
      const completedStepIds = new Set(
        steps.filter(s => s.status === StepState.COMPLETED).map(s => {
          return s.id.startsWith(taskId + '_') ? s.id.substring(taskId.length + 1) : s.id;
        })
      );

      // Find steps eligible to run (dependencies satisfied and status is PENDING or READY)
      const eligibleSteps = steps.filter(step => {
        if (step.status !== StepState.PENDING && step.status !== StepState.READY) return false;
        const deps: string[] = step.dependencies ? JSON.parse(step.dependencies) : [];
        return deps.every(depId => completedStepIds.has(depId));
      });

      if (eligibleSteps.length === 0) {
        // No steps currently eligible. Check if all steps completed or any failed
        const anyFailed = steps.some(s => s.status === StepState.FAILED);
        const allCompleted = steps.every(s => s.status === StepState.COMPLETED || s.status === StepState.SKIPPED);
        const waitingApproval = steps.some(s => s.status === StepState.WAITING_APPROVAL);

        if (waitingApproval) {
          await this.updateTaskStatus(taskId, TaskState.WAITING_FOR_USER);
        } else if (allCompleted) {
          await this.completeTask(taskId, userId);
        } else if (anyFailed) {
          const someCompleted = steps.some(s => s.status === StepState.COMPLETED);
          const finalState = someCompleted ? TaskState.PARTIALLY_COMPLETED : TaskState.FAILED;
          await this.updateTaskStatus(taskId, finalState, 'One or more required steps failed.');
        }
        break;
      }

      // Concurrency limit: Bounded parallel execution of independent steps
      const batch = eligibleSteps.slice(0, 3);

      // Execute batch concurrently
      await Promise.all(batch.map(async step => {
        await this.executeSingleStep(taskId, step.id, userId);
      }));
    }
  }

  /**
   * Executes a single step: Policy check -> Device Routing -> Execution Lease -> Execution -> Verification -> Recovery
   */
  private async executeSingleStep(taskId: string, stepDbId: string, userId: string): Promise<boolean> {
    const step = await prisma.taskStep.findUnique({ where: { id: stepDbId } });
    if (!step) return false;

    const tool = this.toolRegistry.getTool(step.toolName);
    const inputData = JSON.parse(step.inputData);

    // 1. Deterministic Policy Check (Outside LLM)
    if (tool) {
      const policyCheck = PolicyEngine.evaluateToolExecution(tool, inputData, RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE);
      if (!policyCheck.allowed) {
        await prisma.taskStep.update({
          where: { id: stepDbId },
          data: {
            status: StepState.FAILED,
            errorMessage: policyCheck.reason
          }
        });
        await this.updateTaskStatus(taskId, TaskState.FAILED, policyCheck.reason);
        return false;
      }

      if (policyCheck.requiresApproval) {
        // Create Approval Request
        await prisma.approvalRequest.create({
          data: {
            taskId,
            stepId: stepDbId,
            userId,
            riskLevel: tool.riskLevel,
            actionDescription: `Approval required for ${tool.name}: ${step.title}`,
            toolName: tool.name,
            proposedParams: JSON.stringify(inputData),
            status: 'PENDING'
          }
        });

        await prisma.taskStep.update({
          where: { id: stepDbId },
          data: { status: StepState.WAITING_APPROVAL }
        });

        await this.updateTaskStatus(taskId, TaskState.WAITING_FOR_USER, `Action '${tool.name}' requires explicit authorization.`);
        return false;
      }
    }

    // 2. Device Routing & Capability Check
    const plannedStep: PlannedStep = {
      stepId: step.id.startsWith(taskId + '_') ? step.id.substring(taskId.length + 1) : step.id,
      stepIndex: step.stepIndex,
      title: step.title,
      capability: step.capability,
      toolName: step.toolName,
      inputData,
      preconditions: step.preconditions || '',
      dependencies: step.dependencies ? JSON.parse(step.dependencies) : [],
      riskLevel: step.riskLevel as RiskLevel,
      expectedPostcondition: step.postconditions || '',
      verificationMethod: step.verificationMethod || 'CHECK_STATE',
      timeoutMs: step.timeoutMs,
      retryPolicy: step.retryPolicy ? JSON.parse(step.retryPolicy) : { maxRetries: 2, backoffMs: 500 }
    };

    const routing = await this.deviceRoutingAgent.routeStep(plannedStep, userId);
    if (!routing.canExecuteNow) {
      // Safe pause if required device is offline
      await prisma.taskStep.update({
        where: { id: stepDbId },
        data: { errorMessage: routing.reason }
      });
      await this.updateTaskStatus(taskId, TaskState.WAITING_FOR_USER, routing.reason);
      return false;
    }

    // 3. Acquire Execution Lease to prevent concurrent duplicate execution
    const workerId = `worker_${process.pid}`;
    const lease = await this.deviceRoutingAgent.acquireLease(taskId, stepDbId, routing.assignedDeviceId, workerId);
    if (!lease.acquired) {
      console.warn(`[LEASE-CONFLICT] ${lease.reason}`);
      return false;
    }

    // 4. Update Step to RUNNING
    await prisma.taskStep.update({
      where: { id: stepDbId },
      data: { status: StepState.RUNNING, startedAt: new Date() }
    });

    this.broadcaster.broadcast({
      type: 'STEP_RUNNING',
      taskId,
      payload: { stepId: step.id, title: step.title, tool: step.toolName }
    });

    const context = {
      taskId,
      stepId: step.id,
      userId,
      deviceId: routing.assignedDeviceId,
      workerId
    };

    let retryCount = 0;
    const maxRetries = plannedStep.retryPolicy.maxRetries || 2;
    let stepSuccess = false;

    while (retryCount <= maxRetries && !stepSuccess) {
      // Execute step
      const execResult = await this.executionAgent.executeStep(plannedStep, context);

      // Record Action Result in DB
      await prisma.actionResult.create({
        data: {
          taskId,
          stepId: stepDbId,
          toolName: execResult.actionResult.toolName,
          status: execResult.actionResult.status,
          actionTaken: execResult.actionResult.actionTaken,
          expectedPostcondition: execResult.actionResult.expectedPostcondition,
          actualOutcome: execResult.actionResult.actualOutcome,
          evidence: JSON.stringify(execResult.actionResult.evidence),
          affectedResources: JSON.stringify(execResult.actionResult.affectedResources),
          errorType: execResult.actionResult.errorType,
          retryable: execResult.actionResult.retryable
        }
      });

      // 5. Independent Verification
      await this.updateTaskStatus(taskId, TaskState.VERIFYING);
      const verdict = await this.verificationAgent.verifyStepOutcome(
        plannedStep,
        execResult.actionResult,
        execResult.output,
        context
      );

      // Record Verification in DB
      await prisma.verificationVerdict.create({
        data: {
          taskId,
          stepId: stepDbId,
          verdict: verdict.verdict,
          score: verdict.score,
          reasoning: verdict.reasoning,
          evidence: JSON.stringify(verdict.evidence)
        }
      });

      if (verdict.verdict === VerificationVerdictType.VERIFIED_SUCCESS || verdict.verdict === VerificationVerdictType.VERIFIED_PARTIAL_SUCCESS) {
        stepSuccess = true;
        await prisma.taskStep.update({
          where: { id: stepDbId },
          data: {
            status: StepState.COMPLETED,
            resultData: JSON.stringify(execResult.output || {}),
            evidence: JSON.stringify(verdict.evidence),
            completedAt: new Date()
          }
        });

        this.broadcaster.broadcast({
          type: 'STEP_COMPLETED',
          taskId,
          payload: { stepId: step.id, verdict: verdict.verdict, reasoning: verdict.reasoning }
        });
      } else {
        // 6. Recovery logic
        await this.updateTaskStatus(taskId, TaskState.RECOVERING);
        const recovery = this.verificationAgent.determineRecoveryStrategy(plannedStep, verdict, retryCount, maxRetries);

        if (recovery.canRecover && recovery.action === 'RETRY') {
          retryCount++;
          AuditLogger.log('STEP_RECOVERY_RETRY', { stepId: step.id, retryCount, backoffMs: recovery.backoffMs, reason: recovery.reason }, { taskId });
          if (recovery.backoffMs > 0) {
            await new Promise(r => setTimeout(r, recovery.backoffMs));
          }
        } else {
          // Unrecoverable
          await prisma.taskStep.update({
            where: { id: stepDbId },
            data: {
              status: StepState.FAILED,
              errorMessage: recovery.reason,
              completedAt: new Date()
            }
          });

          this.broadcaster.broadcast({
            type: 'STEP_FAILED',
            taskId,
            payload: { stepId: step.id, reason: recovery.reason }
          });
          break;
        }
      }
    }

    // Release Execution Lease
    if (lease.leaseToken) {
      await this.deviceRoutingAgent.releaseLease(lease.leaseToken);
    }

    return stepSuccess;
  }

  /**
   * Approves a waiting step and resumes execution
   */
  public async respondToApproval(requestId: string, approved: boolean, userId: string, notes?: string): Promise<void> {
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { task: true, step: true }
    });
    if (!request || request.status !== 'PENDING') {
      throw new Error('Approval request not found or already processed.');
    }

    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        respondedAt: new Date(),
        respondedBy: userId,
        notes
      }
    });

    if (approved) {
      await prisma.taskStep.update({
        where: { id: request.stepId },
        data: { status: StepState.READY }
      });
      await this.updateTaskStatus(request.taskId, TaskState.READY);
      setImmediate(() => this.runExecutionLoop(request.taskId, request.userId));
    } else {
      await prisma.taskStep.update({
        where: { id: request.stepId },
        data: { status: StepState.FAILED, errorMessage: 'User rejected approval request.' }
      });
      await this.updateTaskStatus(request.taskId, TaskState.CANCELLED, 'User rejected authorization.');
    }
  }

  /**
   * Resumes an interrupted task (e.g. after backend restart)
   */
  public async resumeTask(taskId: string): Promise<void> {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (TaskStateMachine.isTerminal(task.status as TaskState)) {
      return;
    }

    AuditLogger.log('TASK_RESUME_REQUESTED', { taskId, previousStatus: task.status });
    // Reset any steps that were mid-flight (RUNNING) back to READY so they can be cleanly resumed
    await prisma.taskStep.updateMany({
      where: { taskId, status: StepState.RUNNING },
      data: { status: StepState.READY }
    });

    await this.updateTaskStatus(taskId, TaskState.READY);
    await this.runExecutionLoop(taskId, task.userId);
  }

  /**
   * Cancels a running or pending task safely
   */
  public async cancelTask(taskId: string, reason: string = 'User requested cancellation'): Promise<void> {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (TaskStateMachine.isTerminal(task.status as TaskState)) return;

    await prisma.taskStep.updateMany({
      where: { taskId, status: { in: [StepState.PENDING, StepState.READY, StepState.RUNNING] } },
      data: { status: StepState.SKIPPED, errorMessage: 'Cancelled' }
    });

    await this.updateTaskStatus(taskId, TaskState.CANCELLED, reason);
  }

  private async completeTask(taskId: string, userId: string): Promise<void> {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskState.COMPLETED,
        completedAt: new Date()
      }
    });

    // Record verified outcome into persistent memory
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task) {
      await this.memoryAgent.storeTaskOutcome(
        userId,
        taskId,
        `Successfully completed goal: "${task.originalRequest}"`
      );
    }

    this.broadcaster.broadcast({
      type: 'TASK_COMPLETED',
      taskId,
      userId,
      payload: { taskId, status: TaskState.COMPLETED }
    });

    AuditLogger.log('TASK_COMPLETED', { taskId }, { taskId, userId });
  }

  private async updateTaskStatus(taskId: string, newStatus: TaskState, error?: string): Promise<void> {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    const currentStatus = task.status as TaskState;
    if (currentStatus === newStatus) return;

    // Assert valid state machine transition
    TaskStateMachine.assertTransition(currentStatus, newStatus, error);

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        lastError: error || task.lastError,
        ...(newStatus === TaskState.COMPLETED || newStatus === TaskState.FAILED || newStatus === TaskState.CANCELLED ? { completedAt: new Date() } : {})
      }
    });

    this.broadcaster.broadcast({
      type: 'TASK_STATUS_CHANGED',
      taskId,
      userId: task.userId,
      payload: { taskId, from: currentStatus, to: newStatus, error }
    });

    AuditLogger.log('TASK_STATE_TRANSITION', { from: currentStatus, to: newStatus, error }, { taskId, userId: task.userId });
  }
}
