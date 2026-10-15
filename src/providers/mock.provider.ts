import { IModelProvider, ModelUsageStats } from './model.provider';
import { StructuredObjective, PlannedStep, RiskLevel } from '../core/types';

export class MockModelProvider implements IModelProvider {
  public name = 'DeterministicMockProvider';
  private stats: ModelUsageStats = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0
  };

  public isAvailable(): boolean {
    return true;
  }

  public async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    this.recordTokens(prompt.length / 4, 100);
    return `JARVIS: Processed request with deterministic analysis. Prompt: "${prompt.slice(0, 100)}..."`;
  }

  public async generateStructured<T>(prompt: string, schemaDescription: string, systemPrompt?: string): Promise<T> {
    this.recordTokens(prompt.length / 4, 300);

    const lower = prompt.toLowerCase();

    // Intent & Context generation
    if (schemaDescription.includes('StructuredObjective') || schemaDescription.includes('goal') || schemaDescription.includes('relevantApplications')) {
      const isDangerous = lower.includes('delete') || lower.includes('drop') || lower.includes('format') || lower.includes('wipe');
      const isExternal = lower.includes('send email') || lower.includes('invite') || lower.includes('publish') || lower.includes('deploy');

      let maxRisk = RiskLevel.LEVEL_0_READ_ONLY;
      if (isDangerous) maxRisk = RiskLevel.LEVEL_3_HIGH_IMPACT_IRREVERSIBLE;
      else if (isExternal) maxRisk = RiskLevel.LEVEL_2_CONSEQUENTIAL_EXTERNAL;
      else if (lower.includes('create') || lower.includes('write') || lower.includes('update')) maxRisk = RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE;

      const objective: StructuredObjective = {
        goal: prompt.trim(),
        constraints: ['Strict verification required', 'Must not exceed granted permissions'],
        preferences: ['Concise reporting', 'Independent outcome verification'],
        relevantApplications: ['filesystem', 'web', 'calendar', 'email'],
        relevantResources: [],
        requiredOutputs: ['Structured outcome report', 'Execution evidence'],
        missingInputs: [],
        assumptions: ['Environment resources are accessible within granted scopes'],
        successCriteria: ['All planned steps complete with VERIFIED_SUCCESS'],
        maxRiskLevel: maxRisk,
        requiresUserApproval: maxRisk >= RiskLevel.LEVEL_2_CONSEQUENTIAL_EXTERNAL
      };
      return objective as unknown as T;
    }

    // Planning generation
    if (schemaDescription.includes('ExecutionPlan') || schemaDescription.includes('PlannedStep') || schemaDescription.includes('stepId')) {
      const steps: PlannedStep[] = [];

      if (lower.includes('schedule') || lower.includes('calendar')) {
        steps.push({
          stepId: 'step-1',
          stepIndex: 0,
          title: 'List calendar events',
          capability: 'calendar',
          toolName: 'calendar.list_events',
          inputData: { daysAhead: 2 },
          preconditions: 'Calendar integration is connected or simulated',
          dependencies: [],
          riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
          expectedPostcondition: 'Calendar events retrieved and conflicts analyzed',
          verificationMethod: 'INSPECT_RESOURCE',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
        steps.push({
          stepId: 'step-2',
          stepIndex: 1,
          title: 'Check calendar conflicts',
          capability: 'calendar',
          toolName: 'calendar.check_conflicts',
          inputData: { targetDate: new Date().toISOString().split('T')[0] },
          preconditions: 'Step 1 complete',
          dependencies: ['step-1'],
          riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
          expectedPostcondition: 'Conflict report generated',
          verificationMethod: 'CHECK_STATE',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
      } else if (lower.includes('research') || lower.includes('search')) {
        steps.push({
          stepId: 'step-1',
          stepIndex: 0,
          title: 'Search reliable web sources',
          capability: 'web',
          toolName: 'web.search',
          inputData: { query: prompt.replace(/research|search/gi, '').trim() || 'AI agents architecture' },
          preconditions: 'Web search capability available',
          dependencies: [],
          riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
          expectedPostcondition: 'Search results gathered with citation URLs',
          verificationMethod: 'CHECK_STATE',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
        steps.push({
          stepId: 'step-2',
          stepIndex: 1,
          title: 'Save research summary to document',
          capability: 'filesystem',
          toolName: 'filesystem.write_file',
          inputData: { path: 'research_summary.md', content: `# Research Summary\nGenerated from: ${prompt}` },
          preconditions: 'Step 1 complete',
          dependencies: ['step-1'],
          riskLevel: RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
          expectedPostcondition: 'File research_summary.md exists and is readable',
          verificationMethod: 'INSPECT_RESOURCE',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
      } else if (lower.includes('email') || lower.includes('unread')) {
        steps.push({
          stepId: 'step-1',
          stepIndex: 0,
          title: 'List unread emails',
          capability: 'email',
          toolName: 'email.list_messages',
          inputData: { unreadOnly: true, limit: 5 },
          preconditions: 'Email connector accessible',
          dependencies: [],
          riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
          expectedPostcondition: 'Email headers and bodies retrieved',
          verificationMethod: 'CHECK_STATE',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
        steps.push({
          stepId: 'step-2',
          stepIndex: 1,
          title: 'Extract prioritized action items',
          capability: 'email',
          toolName: 'email.extract_action_items',
          inputData: { query: 'project' },
          preconditions: 'Step 1 complete',
          dependencies: ['step-1'],
          riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
          expectedPostcondition: 'Action items extracted and categorized',
          verificationMethod: 'CHECK_STATE',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
      } else if (lower.includes('inspect') || lower.includes('repository') || lower.includes('fix') || lower.includes('code')) {
        steps.push({
          stepId: 'step-1',
          stepIndex: 0,
          title: 'List directory files',
          capability: 'filesystem',
          toolName: 'filesystem.list_dir',
          inputData: { path: '.' },
          preconditions: 'Workspace accessible',
          dependencies: [],
          riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
          expectedPostcondition: 'Directory files listed',
          verificationMethod: 'INSPECT_RESOURCE',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
        steps.push({
          stepId: 'step-2',
          stepIndex: 1,
          title: 'Run repository test suite',
          capability: 'shell',
          toolName: 'shell.run_command',
          inputData: { command: 'npm test -- --bail' },
          preconditions: 'Step 1 complete',
          dependencies: ['step-1'],
          riskLevel: RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
          expectedPostcondition: 'Tests executed and exit status recorded',
          verificationMethod: 'CHECK_STATE',
          timeoutMs: 30000,
          retryPolicy: { maxRetries: 1, backoffMs: 1000 }
        });
      } else {
        // Default 2-step task
        steps.push({
          stepId: 'step-1',
          stepIndex: 0,
          title: 'Inspect system capabilities',
          capability: 'system',
          toolName: 'system.health',
          inputData: {},
          preconditions: 'Engine active',
          dependencies: [],
          riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
          expectedPostcondition: 'System health verified',
          verificationMethod: 'CHECK_STATE',
          timeoutMs: 10000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
        steps.push({
          stepId: 'step-2',
          stepIndex: 1,
          title: 'Record task summary in memory',
          capability: 'memory',
          toolName: 'memory.remember',
          inputData: {
            category: 'HISTORICAL_RESULT',
            key: `task_${Date.now()}`,
            value: `Completed user goal: ${prompt.slice(0, 100)}`
          },
          preconditions: 'Step 1 complete',
          dependencies: ['step-1'],
          riskLevel: RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
          expectedPostcondition: 'Memory record persisted and queryable',
          verificationMethod: 'INSPECT_RESOURCE',
          timeoutMs: 10000,
          retryPolicy: { maxRetries: 2, backoffMs: 500 }
        });
      }

      return steps as unknown as T;
    }

    return {} as unknown as T;
  }

  public getUsageStats(): ModelUsageStats {
    return { ...this.stats };
  }

  public resetUsage(): void {
    this.stats = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
  }

  private recordTokens(prompt: number, completion: number): void {
    this.stats.promptTokens += Math.round(prompt);
    this.stats.completionTokens += Math.round(completion);
    this.stats.totalTokens += Math.round(prompt + completion);
    // Rough estimate $0.002 / 1k tokens
    this.stats.estimatedCostUsd = (this.stats.totalTokens / 1000) * 0.002;
  }
}
