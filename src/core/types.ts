import { z } from 'zod';

export enum TaskState {
  RECEIVED = 'RECEIVED',
  UNDERSTANDING = 'UNDERSTANDING',
  PLANNING = 'PLANNING',
  AUTHORIZATION_CHECK = 'AUTHORIZATION_CHECK',
  READY = 'READY',
  RUNNING = 'RUNNING',
  VERIFYING = 'VERIFYING',
  RECOVERING = 'RECOVERING',
  WAITING_FOR_USER = 'WAITING_FOR_USER',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum StepState {
  PENDING = 'PENDING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  WAITING_APPROVAL = 'WAITING_APPROVAL'
}

export enum RiskLevel {
  LEVEL_0_READ_ONLY = 0,
  LEVEL_1_REVERSIBLE_PRIVATE = 1,
  LEVEL_2_CONSEQUENTIAL_EXTERNAL = 2,
  LEVEL_3_HIGH_IMPACT_IRREVERSIBLE = 3
}

export enum VerificationVerdictType {
  VERIFIED_SUCCESS = 'VERIFIED_SUCCESS',
  VERIFIED_PARTIAL_SUCCESS = 'VERIFIED_PARTIAL_SUCCESS',
  RETRYABLE_FAILURE = 'RETRYABLE_FAILURE',
  NON_RETRYABLE_FAILURE = 'NON_RETRYABLE_FAILURE',
  OUTCOME_UNKNOWN = 'OUTCOME_UNKNOWN',
  BLOCKED_BY_PERMISSION = 'BLOCKED_BY_PERMISSION',
  REQUIRES_USER_DECISION = 'REQUIRES_USER_DECISION'
}

export enum ActionStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  UNKNOWN = 'UNKNOWN'
}

export enum DeviceType {
  DESKTOP = 'DESKTOP',
  MOBILE = 'MOBILE',
  SERVER = 'SERVER',
  BROWSER = 'BROWSER'
}

export interface ActionResultData {
  taskId: string;
  stepId: string;
  toolName: string;
  status: ActionStatus;
  actionTaken: string;
  expectedPostcondition: string;
  actualOutcome?: string;
  evidence: string[];
  affectedResources: string[];
  errorType?: string;
  retryable: boolean;
  nextAction?: string;
  simulated?: boolean;
}

export interface VerificationVerdictData {
  taskId: string;
  stepId: string;
  verdict: VerificationVerdictType;
  score: number; // 0.0 to 1.0
  reasoning: string;
  evidence: string[];
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  requiredPermissions: string[];
  inputSchema: z.ZodSchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  idempotent: boolean;
  timeoutMs: number;
  maxRetries: number;
  verificationStrategy: 'INSPECT_RESOURCE' | 'COMPARE_HASH' | 'CHECK_STATE' | 'QUERY_PROVIDER' | 'NONE';
  execute: (input: TInput, context: ExecutionContext) => Promise<TOutput>;
  verify?: (input: TInput, output: TOutput, context: ExecutionContext) => Promise<VerificationVerdictData>;
}

export interface ExecutionContext {
  taskId: string;
  stepId: string;
  userId: string;
  deviceId?: string;
  workerId?: string;
  isSimulated?: boolean;
}

export interface StructuredObjective {
  goal: string;
  constraints: string[];
  preferences: string[];
  relevantApplications: string[];
  relevantResources: string[];
  deadlines?: string;
  requiredOutputs: string[];
  missingInputs: string[];
  assumptions: string[];
  successCriteria: string[];
  maxRiskLevel: RiskLevel;
  requiresUserApproval: boolean;
}

export interface PlannedStep {
  stepId: string;
  stepIndex: number;
  title: string;
  capability: string;
  toolName: string;
  inputData: Record<string, any>;
  preconditions: string;
  dependencies: string[]; // stepIds
  riskLevel: RiskLevel;
  expectedPostcondition: string;
  verificationMethod: string;
  timeoutMs: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface ExecutionPlan {
  taskId: string;
  objective: StructuredObjective;
  steps: PlannedStep[];
}

export interface UserSession {
  userId: string;
  email: string;
  role: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  capabilities: string[];
  connectionStatus: 'ONLINE' | 'OFFLINE' | 'BUSY';
  lastHeartbeat: Date;
  activeLeaseId?: string;
  isAuthorized: boolean;
}

export interface AuditRecord {
  userId?: string;
  taskId?: string;
  eventType: string;
  details: Record<string, any>;
  riskLevel: RiskLevel;
  ipAddress?: string;
}
