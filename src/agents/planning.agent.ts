import { IModelProvider } from '../providers/model.provider';
import { StructuredObjective, PlannedStep, ExecutionPlan, RiskLevel } from '../core/types';
import { ToolRegistry } from '../tools/registry';
import { AuditLogger } from '../core/audit';

export class PlanningAgent {
  constructor(
    private modelProvider: IModelProvider,
    private toolRegistry: ToolRegistry = ToolRegistry.getInstance()
  ) {}

  public async createPlan(taskId: string, objective: StructuredObjective, userId: string): Promise<ExecutionPlan> {
    AuditLogger.log('PLANNING_START', { taskId, objective: objective.goal }, { taskId, userId });

    const availableTools = this.toolRegistry.getToolSchemasForLLM();

    const prompt = `You are JARVIS Agent 3 (Planning Agent).
Decompose this StructuredObjective into an executable sequence of steps.

Objective:
- Goal: ${objective.goal || 'Complete task'}
- Constraints: ${(objective.constraints || []).join('; ')}
- Success Criteria: ${(objective.successCriteria || []).join('; ')}

Registered Tools available (YOU MUST ONLY USE THESE REGISTERED TOOLS):
${JSON.stringify(availableTools, null, 2)}

Create an ordered list of PlannedStep objects. Each step must specify:
- stepId: "step-1", "step-2", etc.
- stepIndex: 0, 1, ...
- title: concise title
- capability: tool category (e.g., "filesystem", "calendar", "web", "email", "shell", "memory", "system")
- toolName: exact name from registered tools list
- inputData: exact input parameters for the tool
- preconditions: description of what must be true before running
- dependencies: array of stepIds that must complete before this step
- riskLevel: 0, 1, 2, or 3
- expectedPostcondition: what the state should be after step finishes
- verificationMethod: "INSPECT_RESOURCE" | "CHECK_STATE" | "COMPARE_HASH"
- timeoutMs: timeout in ms
- retryPolicy: { maxRetries: number, backoffMs: number }`;

    const schemaDescription = `[
  {
    "stepId": "string",
    "stepIndex": number,
    "title": "string",
    "capability": "string",
    "toolName": "string",
    "inputData": {},
    "preconditions": "string",
    "dependencies": ["string"],
    "riskLevel": 0 | 1 | 2 | 3,
    "expectedPostcondition": "string",
    "verificationMethod": "string",
    "timeoutMs": number,
    "retryPolicy": { "maxRetries": number, "backoffMs": number }
  }
]`;

    let steps = await this.modelProvider.generateStructured<PlannedStep[]>(
      prompt,
      schemaDescription,
      'You are JARVIS Planning Agent. Only generate steps using available registered tools.'
    );

    const safeSteps = Array.isArray(steps) ? steps : [];

    // Validate that generated steps use REAL registered tools
    for (const step of safeSteps) {
      const registered = this.toolRegistry.getTool(step.toolName);
      if (!registered) {
        throw new Error(`Planning error: Tool '${step.toolName}' suggested by planner is not in the registered capabilities.`);
      }
      // Ensure riskLevel aligns with actual registered tool risk level
      step.riskLevel = registered.riskLevel;
    }

    const plan: ExecutionPlan = {
      taskId,
      objective,
      steps: safeSteps
    };

    AuditLogger.log('PLANNING_COMPLETE', { taskId, stepCount: steps.length }, { taskId, userId });
    return plan;
  }
}
