const BASE_URL = '/api';

export interface TaskSummary {
  id: string;
  originalRequest: string;
  normalizedObjective: string;
  status: string;
  riskLevel: number;
  priority: string;
  createdAt: string;
  completedAt?: string;
  lastError?: string;
  steps: Array<{
    id: string;
    stepIndex: number;
    title: string;
    capability: string;
    toolName: string;
    status: string;
    riskLevel: number;
    completedAt?: string;
  }>;
}

export interface TaskDetail extends TaskSummary {
  steps: Array<{
    id: string;
    stepIndex: number;
    title: string;
    capability: string;
    toolName: string;
    inputData: string;
    status: string;
    riskLevel: number;
    preconditions?: string;
    postconditions?: string;
    verificationMethod?: string;
    errorMessage?: string;
    evidence?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  actionResults: Array<{
    id: string;
    stepId: string;
    toolName: string;
    status: string;
    actionTaken: string;
    expectedPostcondition: string;
    actualOutcome?: string;
    evidence: string;
    affectedResources: string;
    errorType?: string;
    retryable: boolean;
    executedAt: string;
  }>;
  verifications: Array<{
    id: string;
    stepId: string;
    verdict: string;
    score: number;
    reasoning: string;
    evidence: string;
    verifiedAt: string;
  }>;
  approvals: Array<any>;
}

export interface ApprovalItem {
  id: string;
  taskId: string;
  stepId: string;
  riskLevel: number;
  actionDescription: string;
  toolName: string;
  proposedParams: string;
  status: string;
  requestedAt: string;
  task: { originalRequest: string };
  step: { title: string };
}

export interface IntegrationItem {
  providerId: string;
  name: string;
  isSimulated: boolean;
  capabilities: Array<{ name: string; description: string; riskLevel: number }>;
  health: {
    status: string;
    isSimulated: boolean;
    message: string;
    checkedAt: string;
  };
}

export interface DeviceItem {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  capabilities: string;
  connectionStatus: string;
  lastHeartbeat: string;
  isAuthorized: boolean;
}

export interface MemoryItem {
  id: string;
  category: string;
  key: string;
  value: string;
  userApproved: boolean;
  updatedAt: string;
}

export interface ScheduleItem {
  id: string;
  name: string;
  cronExpression: string;
  naturalSchedule: string;
  status: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface AuditItem {
  id: string;
  eventType: string;
  details: string;
  riskLevel: number;
  timestamp: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  description?: string;
  createdAt: string;
}

export interface EmailItem {
  id: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body: string;
  unread: boolean;
  receivedAt: string;
}

export const api = {
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const res = await fetch(`${BASE_URL}/calendar/events`);
    return res.json();
  },

  async createCalendarEvent(event: { title: string; startTime: string; endTime: string; attendees?: string[]; description?: string }): Promise<CalendarEvent> {
    const res = await fetch(`${BASE_URL}/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    return res.json();
  },

  async deleteCalendarEvent(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/calendar/events/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async getEmails(): Promise<EmailItem[]> {
    const res = await fetch(`${BASE_URL}/emails`);
    return res.json();
  },

  async getTasks(): Promise<TaskSummary[]> {
    const res = await fetch(`${BASE_URL}/tasks`);
    return res.json();
  },

  async getTask(id: string): Promise<TaskDetail> {
    const res = await fetch(`${BASE_URL}/tasks/${id}`);
    return res.json();
  },

  async submitTask(request: string): Promise<{ taskId: string; message: string }> {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request })
    });
    return res.json();
  },

  async cancelTask(id: string, reason?: string) {
    const res = await fetch(`${BASE_URL}/tasks/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return res.json();
  },

  async resumeTask(id: string) {
    const res = await fetch(`${BASE_URL}/tasks/${id}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return res.json();
  },

  async getApprovals(): Promise<ApprovalItem[]> {
    const res = await fetch(`${BASE_URL}/approvals`);
    return res.json();
  },

  async respondApproval(id: string, approved: boolean, notes?: string) {
    const res = await fetch(`${BASE_URL}/approvals/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, notes })
    });
    return res.json();
  },

  async getIntegrations(): Promise<IntegrationItem[]> {
    const res = await fetch(`${BASE_URL}/integrations`);
    return res.json();
  },

  async connectIntegration(id: string, config: any): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${BASE_URL}/integrations/${id}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  },

  async disconnectIntegration(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${BASE_URL}/integrations/${id}/disconnect`, {
      method: 'POST'
    });
    return res.json();
  },

  async getDevices(): Promise<DeviceItem[]> {
    const res = await fetch(`${BASE_URL}/devices`);
    return res.json();
  },

  async getMemories(): Promise<MemoryItem[]> {
    const res = await fetch(`${BASE_URL}/memory`);
    return res.json();
  },

  async addMemory(data: { category: string; key: string; value: string }) {
    const res = await fetch(`${BASE_URL}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteMemory(key: string) {
    const res = await fetch(`${BASE_URL}/memory/${key}`, { method: 'DELETE' });
    return res.json();
  },

  async getSchedules(): Promise<ScheduleItem[]> {
    const res = await fetch(`${BASE_URL}/schedules`);
    return res.json();
  },

  async createSchedule(data: { name: string; naturalSchedule: string; prompt: string }) {
    const res = await fetch(`${BASE_URL}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getAudit(): Promise<{ logs: AuditItem[]; usage: any }> {
    const res = await fetch(`${BASE_URL}/audit`);
    return res.json();
  }
};
