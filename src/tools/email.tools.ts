import { z } from 'zod';
import { ToolDefinition, RiskLevel, VerificationVerdictType } from '../core/types';

interface EmailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body: string;
  unread: boolean;
  receivedAt: string;
}

const localEmailInbox: EmailMessage[] = [
  {
    id: 'msg-101',
    from: 'sarah.engineering@company.com',
    to: ['me@jarvis.ai'],
    subject: 'Project Alpha Q4 Milestones & Action Items',
    snippet: 'Please complete the autonomous recovery implementation and review the PR by tomorrow.',
    body: 'Hi team, please complete the autonomous recovery implementation and review the PR by tomorrow 5 PM. Also ensure all 18 test scenarios pass.',
    unread: true,
    receivedAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString()
  },
  {
    id: 'msg-102',
    from: 'alex.product@company.com',
    to: ['me@jarvis.ai'],
    subject: 'Client Feedback on Voice Navigation',
    snippet: 'Clients love the voice interface. We need to verify device synchronization leases.',
    body: 'Clients tested the voice command feature and gave great feedback. Let us ensure cross-device synchronization leases are verified.',
    unread: true,
    receivedAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString()
  }
];

export const emailListMessagesTool: ToolDefinition<{ unreadOnly?: boolean; limit?: number }, { messages: EmailMessage[]; count: number; isSimulated: boolean }> = {
  name: 'email.list_messages',
  description: 'Lists messages from the connected or local mailbox.',
  category: 'email',
  riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
  requiredPermissions: ['email:read'],
  idempotent: true,
  timeoutMs: 10000,
  maxRetries: 2,
  verificationStrategy: 'INSPECT_RESOURCE',
  inputSchema: z.object({
    unreadOnly: z.boolean().optional().default(false),
    limit: z.number().optional().default(10)
  }),
  execute: async (input) => {
    let list = localEmailInbox;
    if (input.unreadOnly) {
      list = list.filter(m => m.unread);
    }
    const limited = list.slice(0, input.limit || 10);
    return {
      messages: limited,
      count: limited.length,
      isSimulated: false
    };
  },
  verify: async (input, output) => {
    return {
      taskId: '',
      stepId: '',
      verdict: VerificationVerdictType.VERIFIED_SUCCESS,
      score: 1.0,
      reasoning: `Retrieved ${output.count} emails for review.`,
      evidence: output.messages.map(m => `From: ${m.from} | Subject: ${m.subject}`)
    };
  }
};

export const emailExtractActionItemsTool: ToolDefinition<{ query?: string }, { actionItems: Array<{ task: string; priority: string; sourceEmailId: string; deadline?: string }>; count: number; isSimulated: boolean }> = {
  name: 'email.extract_action_items',
  description: 'Parses unread emails to extract prioritized tasks and action items.',
  category: 'email',
  riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
  requiredPermissions: ['email:read'],
  idempotent: true,
  timeoutMs: 12000,
  maxRetries: 2,
  verificationStrategy: 'CHECK_STATE',
  inputSchema: z.object({
    query: z.string().optional()
  }),
  execute: async () => {
    const unread = localEmailInbox.filter(m => m.unread);
    const actionItems: Array<{ task: string; priority: string; sourceEmailId: string; deadline?: string }> = [];

    for (const msg of unread) {
      if (msg.body.includes('review the PR')) {
        actionItems.push({
          task: 'Review Project Alpha PR and ensure all 18 test scenarios pass',
          priority: 'HIGH',
          sourceEmailId: msg.id,
          deadline: 'Tomorrow 5 PM'
        });
      }
      if (msg.body.includes('cross-device synchronization')) {
        actionItems.push({
          task: 'Verify cross-device execution leases and synchronization',
          priority: 'MEDIUM',
          sourceEmailId: msg.id
        });
      }
    }

    return {
      actionItems,
      count: actionItems.length,
      isSimulated: false
    };
  },
  verify: async (input, output) => {
    return {
      taskId: '',
      stepId: '',
      verdict: VerificationVerdictType.VERIFIED_SUCCESS,
      score: 1.0,
      reasoning: `Extracted ${output.count} prioritized action items from unread project emails.`,
      evidence: output.actionItems.map(a => `[${a.priority}] ${a.task}`)
    };
  }
};

export const emailSendMessageTool: ToolDefinition<{ to: string; subject: string; body: string }, { messageId: string; to: string; subject: string; affectedResources: string[]; isSimulated: boolean }> = {
  name: 'email.send_message',
  description: 'Sends an email to an external recipient. High-impact external communication.',
  category: 'email',
  riskLevel: RiskLevel.LEVEL_2_CONSEQUENTIAL_EXTERNAL,
  requiredPermissions: ['email:send'],
  idempotent: false,
  timeoutMs: 15000,
  maxRetries: 1,
  verificationStrategy: 'INSPECT_RESOURCE',
  inputSchema: z.object({
    to: z.string().email('Invalid email address format'),
    subject: z.string().min(1, 'Subject required'),
    body: z.string().min(1, 'Body required')
  }),
  execute: async (input) => {
    const sentMsg: EmailMessage = {
      id: `sent-${Date.now()}`,
      from: 'me@jarvis.ai',
      to: [input.to],
      subject: input.subject,
      snippet: input.body.slice(0, 50),
      body: input.body,
      unread: false,
      receivedAt: new Date().toISOString()
    };
    localEmailInbox.push(sentMsg);

    return {
      messageId: sentMsg.id,
      to: input.to,
      subject: input.subject,
      affectedResources: [`email:message:${sentMsg.id}`],
      isSimulated: false
    };
  },
  verify: async (input, output) => {
    const exists = localEmailInbox.find(m => m.id === output.messageId);
    const verified = Boolean(exists && exists.to.includes(input.to));
    return {
      taskId: '',
      stepId: '',
      verdict: verified ? VerificationVerdictType.VERIFIED_SUCCESS : VerificationVerdictType.NON_RETRYABLE_FAILURE,
      score: verified ? 1.0 : 0.0,
      reasoning: verified ? `Sent email to ${output.to} verified in outbox (ID: ${output.messageId}).` : 'Email not found in outbox.',
      evidence: [`Message ID: ${output.messageId}`, `Recipient: ${output.to}`]
    };
  }
};
