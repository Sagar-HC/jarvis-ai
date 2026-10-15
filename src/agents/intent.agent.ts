import { IModelProvider } from '../providers/model.provider';
import { StructuredObjective, RiskLevel } from '../core/types';
import { AuditLogger } from '../core/audit';

export class IntentAgent {
  constructor(private modelProvider: IModelProvider) {}

  public async understandIntent(
    request: string,
    userContext?: { userId: string; preferences?: string[]; existingMemories?: string[] }
  ): Promise<StructuredObjective> {
    AuditLogger.log('INTENT_ANALYSIS_START', { request }, { userId: userContext?.userId });

    const prompt = `You are JARVIS Agent 2 (Intent & Context Agent).
Analyze this user request:
"${request}"

User context:
- Preferences: ${(userContext?.preferences || []).join(', ') || 'None specified'}
- Stored context: ${(userContext?.existingMemories || []).join(', ') || 'None'}

Extract and produce a StructuredObjective with:
- goal: clear end objective
- constraints: operational constraints
- preferences: user preferences
- relevantApplications: e.g. ["calendar", "email", "filesystem", "web", "shell", "memory"]
- relevantResources: any specified files or links
- deadlines: any temporal targets
- requiredOutputs: items that must be produced
- missingInputs: any critical missing details
- assumptions: safe working assumptions
- successCriteria: measurable criteria for success
- maxRiskLevel: 0 (read-only), 1 (reversible private), 2 (external/consequential), 3 (high impact/irreversible)
- requiresUserApproval: true if risk level >= 2 or if consequential actions are required`;

    const schemaDescription = `{
  "goal": "string",
  "constraints": ["string"],
  "preferences": ["string"],
  "relevantApplications": ["string"],
  "relevantResources": ["string"],
  "deadlines": "string | null",
  "requiredOutputs": ["string"],
  "missingInputs": ["string"],
  "assumptions": ["string"],
  "successCriteria": ["string"],
  "maxRiskLevel": 0 | 1 | 2 | 3,
  "requiresUserApproval": boolean
}`;

    const objective = await this.modelProvider.generateStructured<StructuredObjective>(
      prompt,
      schemaDescription,
      'You are JARVIS Intent Agent. Always return valid JSON conforming to StructuredObjective.'
    );

    AuditLogger.log('INTENT_ANALYSIS_COMPLETE', { objective }, { userId: userContext?.userId, riskLevel: objective.maxRiskLevel });
    return objective;
  }
}
