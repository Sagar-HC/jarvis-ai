import { z } from 'zod';
import {
  ToolDefinition,
  ActionResultData,
  ActionStatus,
  ExecutionContext,
  VerificationVerdictData,
  VerificationVerdictType
} from '../core/types';
import { PolicyEngine } from '../core/policy';
import { AuditLogger } from '../core/audit';

export class ToolValidationError extends Error {
  constructor(public errors: any[]) {
    super(`Tool validation failed: ${JSON.stringify(errors)}`);
    this.name = 'ToolValidationError';
  }
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`Requested tool '${name}' is not registered in the system tool registry.`);
    this.name = 'ToolNotFoundError';
  }
}

export class ToolTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`Tool '${name}' exceeded timeout threshold of ${timeoutMs}ms.`);
    this.name = 'ToolTimeoutError';
  }
}

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() {}

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[TOOL-REGISTRY] Warning: Overwriting existing tool '${tool.name}'`);
    }
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getToolSchemasForLLM(): any[] {
    return this.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      riskLevel: t.riskLevel,
      requiredPermissions: t.requiredPermissions,
      idempotent: t.idempotent,
      verificationStrategy: t.verificationStrategy
    }));
  }

  /**
   * Executes a tool with strict input validation, timeout bounding, error classification,
   * and structured action result generation.
   */
  public async executeTool(
    name: string,
    rawInput: any,
    context: ExecutionContext
  ): Promise<{ actionResult: ActionResultData; verification?: VerificationVerdictData; output?: any }> {
    const tool = this.getTool(name);
    if (!tool) {
      AuditLogger.log('TOOL_NOT_FOUND', { toolName: name, rawInput }, { taskId: context.taskId, userId: context.userId });
      return {
        actionResult: {
          taskId: context.taskId,
          stepId: context.stepId,
          toolName: name,
          status: ActionStatus.FAILURE,
          actionTaken: `Attempted to invoke unregistered capability '${name}'.`,
          expectedPostcondition: 'Tool execution completes successfully.',
          errorType: 'MISSING_CAPABILITY',
          retryable: false,
          evidence: [`Tool '${name}' not found in registry`],
          affectedResources: [],
          simulated: context.isSimulated
        }
      };
    }

    // 1. Strict Input Schema Validation
    const parsed = tool.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      AuditLogger.log('TOOL_VALIDATION_ERROR', { toolName: name, errors: parsed.error.errors }, { taskId: context.taskId, userId: context.userId });
      return {
        actionResult: {
          taskId: context.taskId,
          stepId: context.stepId,
          toolName: name,
          status: ActionStatus.FAILURE,
          actionTaken: `Input validation failed for tool '${name}'.`,
          expectedPostcondition: 'Valid input arguments conforming to schema.',
          errorType: 'INVALID_ARGUMENTS',
          retryable: false,
          evidence: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          affectedResources: [],
          simulated: context.isSimulated
        }
      };
    }

    const validatedInput = parsed.data;

    // 2. Timeout-bounded execution
    const timeoutMs = tool.timeoutMs || 30000;
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new ToolTimeoutError(name, timeoutMs));
      }, timeoutMs);
    });

    AuditLogger.log('TOOL_EXECUTE_START', { toolName: name, input: validatedInput }, { taskId: context.taskId, userId: context.userId, riskLevel: tool.riskLevel });

    try {
      const output = await Promise.race([
        tool.execute(validatedInput, context),
        timeoutPromise
      ]);

      if (timer) clearTimeout(timer);

      // Validate output schema if present
      if (tool.outputSchema) {
        const outParse = tool.outputSchema.safeParse(output);
        if (!outParse.success) {
          console.warn(`[TOOL-OUTPUT-WARN] Tool '${name}' output did not conform to schema:`, outParse.error);
        }
      }

      const evidence = [
        `Executed '${name}' successfully`,
        `Output signature: ${typeof output === 'object' ? Object.keys(output || {}).join(', ') : typeof output}`
      ];

      const affectedResources = (output && output.affectedResources) ? output.affectedResources : [];

      const actionResult: ActionResultData = {
        taskId: context.taskId,
        stepId: context.stepId,
        toolName: name,
        status: ActionStatus.SUCCESS,
        actionTaken: `Executed '${name}' with authorized arguments.`,
        expectedPostcondition: `Capability '${name}' produces verified output.`,
        actualOutcome: typeof output === 'string' ? output.slice(0, 500) : JSON.stringify(output).slice(0, 500),
        evidence,
        affectedResources,
        retryable: false,
        simulated: context.isSimulated || (output && output.isSimulated)
      };

      // 3. Optional Tool-level Independent Verification Hook
      let verification: VerificationVerdictData | undefined;
      if (tool.verify) {
        try {
          verification = await tool.verify(validatedInput, output, context);
        } catch (vErr: any) {
          verification = {
            taskId: context.taskId,
            stepId: context.stepId,
            verdict: VerificationVerdictType.OUTCOME_UNKNOWN,
            score: 0.5,
            reasoning: `Verification hook threw an error: ${vErr.message}`,
            evidence: [vErr.message]
          };
        }
      }

      AuditLogger.log('TOOL_EXECUTE_SUCCESS', { toolName: name, status: ActionStatus.SUCCESS }, { taskId: context.taskId, userId: context.userId });

      return { actionResult, verification, output };
    } catch (error: any) {
      if (timer) clearTimeout(timer);

      const isTimeout = error instanceof ToolTimeoutError;
      const errorMsg = error.message || 'Unknown execution error';

      // Classify error type
      let errorType = 'APPLICATION_REJECTION';
      let retryable = false;

      if (isTimeout) {
        errorType = 'TIMEOUT';
        retryable = tool.idempotent; // Only retry timeouts if operation is idempotent
      } else if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('network') || errorMsg.includes('fetch failed')) {
        errorType = 'NETWORK_INTERRUPTION';
        retryable = true;
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        errorType = 'RATE_LIMIT';
        retryable = true;
      } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        errorType = 'AUTHENTICATION_FAILURE';
        retryable = false;
      } else if (errorMsg.includes('403') || errorMsg.includes('Permission')) {
        errorType = 'PERMISSION_DENIAL';
        retryable = false;
      }

      AuditLogger.log('TOOL_EXECUTE_FAILURE', { toolName: name, errorType, errorMsg, retryable }, { taskId: context.taskId, userId: context.userId });

      return {
        actionResult: {
          taskId: context.taskId,
          stepId: context.stepId,
          toolName: name,
          status: ActionStatus.FAILURE,
          actionTaken: `Attempted execution of '${name}'.`,
          expectedPostcondition: 'Operation completed successfully.',
          actualOutcome: `Failed with error: ${errorMsg}`,
          errorType,
          retryable,
          evidence: [errorMsg],
          affectedResources: [],
          simulated: context.isSimulated
        }
      };
    }
  }
}
