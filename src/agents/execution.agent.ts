import { ToolRegistry } from '../tools/registry';
import { ExecutionContext, ActionResultData, PlannedStep, ActionStatus } from '../core/types';
import { PolicyEngine } from '../core/policy';
import { AuditLogger } from '../core/audit';

export class ExecutionAgent {
  constructor(private toolRegistry: ToolRegistry = ToolRegistry.getInstance()) {}

  public async executeStep(
    step: PlannedStep,
    context: ExecutionContext
  ): Promise<{ actionResult: ActionResultData; output?: any }> {
    AuditLogger.log('EXECUTION_AGENT_START', { stepId: step.stepId, toolName: step.toolName }, { taskId: context.taskId, userId: context.userId });

    const tool = this.toolRegistry.getTool(step.toolName);
    if (!tool) {
      return {
        actionResult: {
          taskId: context.taskId,
          stepId: step.stepId,
          toolName: step.toolName,
          status: ActionStatus.FAILURE,
          actionTaken: `Execution of unregistered tool '${step.toolName}' was blocked.`,
          expectedPostcondition: step.expectedPostcondition,
          errorType: 'MISSING_CAPABILITY',
          retryable: false,
          evidence: [`Tool '${step.toolName}' is not in the system registry.`],
          affectedResources: [],
          simulated: context.isSimulated
        }
      };
    }

    // Execute via ToolRegistry which handles Zod parsing, timeouts, and error classification
    const executionResponse = await this.toolRegistry.executeTool(
      step.toolName,
      step.inputData,
      context
    );

    AuditLogger.log('EXECUTION_AGENT_FINISH', {
      stepId: step.stepId,
      status: executionResponse.actionResult.status,
      errorType: executionResponse.actionResult.errorType
    }, { taskId: context.taskId, userId: context.userId });

    return {
      actionResult: executionResponse.actionResult,
      output: executionResponse.output
    };
  }
}
