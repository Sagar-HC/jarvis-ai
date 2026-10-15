import { RiskLevel, ToolDefinition } from './types';

export interface PolicyEvaluationResult {
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  reason: string;
}

export interface SecurityPolicyConfig {
  autoApproveRiskLevelUpTo: RiskLevel; // default: Level 1
  blockedTools?: string[];
  allowedTools?: string[];
  untrustedInputPatterns?: RegExp[];
}

export class PolicyEngine {
  private static defaultUntrustedPatterns: RegExp[] = [
    /ignore previous instructions/i,
    /system prompt override/i,
    /you are now in developer mode/i,
    /bypass safety checks/i,
    /elevate privileges/i,
    /drop table/i,
    /rm -rf/i,
    /format c:/i
  ];

  /**
   * Deterministically evaluates whether a tool execution requires human approval or is blocked.
   * Runs OUTSIDE the language model.
   */
  public static evaluateToolExecution(
    tool: ToolDefinition,
    inputParams: Record<string, any>,
    userRiskTolerance: RiskLevel = RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
    hasStandingApproval: boolean = false
  ): PolicyEvaluationResult {
    // 1. Check for prompt injection / hostile pattern in input parameters
    const inputStr = JSON.stringify(inputParams);
    for (const pattern of this.defaultUntrustedPatterns) {
      if (pattern.test(inputStr)) {
        return {
          allowed: false,
          requiresApproval: false,
          riskLevel: RiskLevel.LEVEL_3_HIGH_IMPACT_IRREVERSIBLE,
          reason: `Security policy violation: Detected potentially hostile instruction pattern (${pattern.source}) in tool arguments.`
        };
      }
    }

    const toolRisk = tool.riskLevel;

    // 2. Risk Level 0: Read-only actions (always allowed within permissions)
    if (toolRisk === RiskLevel.LEVEL_0_READ_ONLY) {
      return {
        allowed: true,
        requiresApproval: false,
        riskLevel: toolRisk,
        reason: 'Read-only operation permitted automatically under Level 0 policy.'
      };
    }

    // 3. Risk Level 1: Reversible private changes
    if (toolRisk === RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE) {
      if (userRiskTolerance >= RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE) {
        return {
          allowed: true,
          requiresApproval: false,
          riskLevel: toolRisk,
          reason: 'Reversible private change permitted under authorized user policy.'
        };
      } else {
        return {
          allowed: true,
          requiresApproval: true,
          riskLevel: toolRisk,
          reason: 'Reversible private change requires approval due to conservative user risk tolerance.'
        };
      }
    }

    // 4. Risk Level 2: External or consequential actions
    if (toolRisk === RiskLevel.LEVEL_2_CONSEQUENTIAL_EXTERNAL) {
      if (hasStandingApproval && userRiskTolerance >= RiskLevel.LEVEL_2_CONSEQUENTIAL_EXTERNAL) {
        return {
          allowed: true,
          requiresApproval: false,
          riskLevel: toolRisk,
          reason: 'Consequential action permitted by pre-authorized standing user approval.'
        };
      }
      return {
        allowed: true,
        requiresApproval: true,
        riskLevel: toolRisk,
        reason: 'Level 2 external/consequential action requires explicit user authorization.'
      };
    }

    // 5. Risk Level 3: High impact / irreversible actions
    // Always requires explicit, action-specific approval; standing approval is insufficient.
    return {
      allowed: true,
      requiresApproval: true,
      riskLevel: toolRisk,
      reason: 'Level 3 high-impact / irreversible operation MANDATES explicit action-specific user authorization.'
    };
  }

  /**
   * Redacts sensitive information (tokens, keys, passwords) from arbitrary data
   */
  public static redactSensitiveData(data: any): any {
    if (!data) return data;
    if (typeof data === 'string') {
      return data
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/("?(?:password|token|secret|apiKey|api_key|auth)"?\s*[:=]\s*)"[^"]+"/gi, '$1"[REDACTED]"')
        .replace(/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_API_KEY]')
        .replace(/(sk-[a-zA-Z0-9]{20,})/g, '[REDACTED_API_KEY]');
    }
    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }
    if (typeof data === 'object') {
      const sanitized: Record<string, any> = {};
      const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'api_key', 'authdetails', 'privatekey', 'jwt_secret'];
      for (const [k, v] of Object.entries(data)) {
        if (sensitiveKeys.includes(k.toLowerCase())) {
          sanitized[k] = '[REDACTED]';
        } else {
          sanitized[k] = this.redactSensitiveData(v);
        }
      }
      return sanitized;
    }
    return data;
  }
}
