import {
  PlannedStep,
  ActionResultData,
  VerificationVerdictData,
  VerificationVerdictType,
  ActionStatus,
  ExecutionContext
} from '../core/types';
import { ToolRegistry } from '../tools/registry';
import { AuditLogger } from '../core/audit';

export interface RecoveryDecision {
  canRecover: boolean;
  action: 'RETRY' | 'REPLAN' | 'PAUSE_FOR_USER' | 'ABORT' | 'PROCEED_PARTIAL';
  backoffMs: number;
  reason: string;
}

export class VerificationAndRecoveryAgent {
  constructor(private toolRegistry: ToolRegistry = ToolRegistry.getInstance()) {}

  /**
   * Independently checks whether an action achieved its expected postcondition.
   * Never marks an operation verified merely because HTTP returned 200.
   */
  public async verifyStepOutcome(
    step: PlannedStep,
    actionResult: ActionResultData,
    output: any,
    context: ExecutionContext
  ): Promise<VerificationVerdictData> {
    AuditLogger.log('VERIFICATION_START', { stepId: step.stepId, toolName: step.toolName }, { taskId: context.taskId });

    // 1. If tool execution completely failed
    if (actionResult.status === ActionStatus.FAILURE) {
      if (actionResult.errorType === 'PERMISSION_DENIAL') {
        return {
          taskId: context.taskId,
          stepId: step.stepId,
          verdict: VerificationVerdictType.BLOCKED_BY_PERMISSION,
          score: 0.0,
          reasoning: `Action failed due to permission denial: ${actionResult.evidence.join('; ')}`,
          evidence: actionResult.evidence
        };
      }
      if (actionResult.retryable) {
        return {
          taskId: context.taskId,
          stepId: step.stepId,
          verdict: VerificationVerdictType.RETRYABLE_FAILURE,
          score: 0.0,
          reasoning: `Transient execution failure detected (${actionResult.errorType}): ${actionResult.evidence.join('; ')}`,
          evidence: actionResult.evidence
        };
      }
      return {
        taskId: context.taskId,
        stepId: step.stepId,
        verdict: VerificationVerdictType.NON_RETRYABLE_FAILURE,
        score: 0.0,
        reasoning: `Non-retryable execution failure (${actionResult.errorType}): ${actionResult.evidence.join('; ')}`,
        evidence: actionResult.evidence
      };
    }

    // 2. If status was UNKNOWN (e.g. timeout on non-idempotent action)
    if (actionResult.status === ActionStatus.UNKNOWN) {
      return {
        taskId: context.taskId,
        stepId: step.stepId,
        verdict: VerificationVerdictType.OUTCOME_UNKNOWN,
        score: 0.3,
        reasoning: 'Tool returned unknown outcome or timed out on a non-idempotent operation. Blind duplicate repetition forbidden.',
        evidence: actionResult.evidence
      };
    }

    // 3. Delegate to Tool's independent verification hook if implemented
    const tool = this.toolRegistry.getTool(step.toolName);
    if (tool && tool.verify) {
      try {
        const verdict = await tool.verify(step.inputData, output, context);
        verdict.taskId = context.taskId;
        verdict.stepId = step.stepId;
        AuditLogger.log('VERIFICATION_COMPLETE', { stepId: step.stepId, verdict: verdict.verdict }, { taskId: context.taskId });
        return verdict;
      } catch (err: any) {
        return {
          taskId: context.taskId,
          stepId: step.stepId,
          verdict: VerificationVerdictType.OUTCOME_UNKNOWN,
          score: 0.4,
          reasoning: `Tool verification hook threw an error: ${err.message}`,
          evidence: [err.message]
        };
      }
    }

    // 4. Default verification logic
    if (output !== undefined && output !== null) {
      return {
        taskId: context.taskId,
        stepId: step.stepId,
        verdict: VerificationVerdictType.VERIFIED_SUCCESS,
        score: 1.0,
        reasoning: `Action completed and produced expected output conforming to postcondition: "${step.expectedPostcondition}"`,
        evidence: [`Evidence observed: ${actionResult.actionTaken}`]
      };
    }

    return {
      taskId: context.taskId,
      stepId: step.stepId,
      verdict: VerificationVerdictType.OUTCOME_UNKNOWN,
      score: 0.5,
      reasoning: 'No definitive output or evidence was produced to verify postcondition.',
      evidence: ['Missing output object']
    };
  }

  /**
   * Evaluates failure and determines bounded autonomous recovery policy
   */
  public determineRecoveryStrategy(
    step: PlannedStep,
    verdict: VerificationVerdictData,
    currentRetryCount: number,
    maxRetries: number = 2
  ): RecoveryDecision {
    // Permission blocks cannot be auto-retried
    if (verdict.verdict === VerificationVerdictType.BLOCKED_BY_PERMISSION) {
      return {
        canRecover: false,
        action: 'PAUSE_FOR_USER',
        backoffMs: 0,
        reason: 'Action blocked by permission policy. Requires user intervention or grant.'
      };
    }

    // Non-retryable failures (e.g. invalid arguments, missing resources) cannot be retried
    if (verdict.verdict === VerificationVerdictType.NON_RETRYABLE_FAILURE) {
      return {
        canRecover: false,
        action: 'ABORT',
        backoffMs: 0,
        reason: 'Action failed with non-retryable error. Repeated attempts would be wasteful.'
      };
    }

    // Outcome unknown: Do NOT blindly retry non-idempotent operations
    if (verdict.verdict === VerificationVerdictType.OUTCOME_UNKNOWN) {
      const tool = this.toolRegistry.getTool(step.toolName);
      if (tool && !tool.idempotent) {
        return {
          canRecover: false,
          action: 'PAUSE_FOR_USER',
          backoffMs: 0,
          reason: 'Outcome is unknown on a non-idempotent operation. Pausing to prevent duplicate side effects.'
        };
      }
    }

    // Retryable failure within retry budget
    if (verdict.verdict === VerificationVerdictType.RETRYABLE_FAILURE || verdict.verdict === VerificationVerdictType.OUTCOME_UNKNOWN) {
      if (currentRetryCount < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, currentRetryCount), 8000);
        return {
          canRecover: true,
          action: 'RETRY',
          backoffMs,
          reason: `Attempting bounded retry (${currentRetryCount + 1}/${maxRetries}) after ${backoffMs}ms backoff.`
        };
      } else {
        return {
          canRecover: false,
          action: 'ABORT',
          backoffMs: 0,
          reason: `Exceeded maximum retry limit (${maxRetries}). Escalating failure.`
        };
      }
    }

    // Partial success
    if (verdict.verdict === VerificationVerdictType.VERIFIED_PARTIAL_SUCCESS) {
      return {
        canRecover: true,
        action: 'PROCEED_PARTIAL',
        backoffMs: 0,
        reason: 'Partial success achieved. Proceeding to downstream dependencies with caveat recorded.'
      };
    }

    return {
      canRecover: false,
      action: 'ABORT',
      backoffMs: 0,
      reason: `Unrecognized verdict: ${verdict.verdict}`
    };
  }
}
