import { z } from 'zod';
import { ToolDefinition, RiskLevel, VerificationVerdictType } from '../core/types';
import prisma from '../server/db';
import { PolicyEngine } from '../core/policy';

export const memoryRememberTool: ToolDefinition<{
  category: 'PREFERENCE' | 'PROJECT_CONTEXT' | 'HISTORICAL_RESULT' | 'CAPABILITY_METADATA';
  key: string;
  value: string;
}, { key: string; category: string; value: string; affectedResources: string[] }> = {
  name: 'memory.remember',
  description: 'Stores a user-approved preference, project context, or verified result in long-term memory.',
  category: 'memory',
  riskLevel: RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
  requiredPermissions: ['memory:write'],
  idempotent: true,
  timeoutMs: 10000,
  maxRetries: 2,
  verificationStrategy: 'INSPECT_RESOURCE',
  inputSchema: z.object({
    category: z.enum(['PREFERENCE', 'PROJECT_CONTEXT', 'HISTORICAL_RESULT', 'CAPABILITY_METADATA']),
    key: z.string().min(1, 'Key required'),
    value: z.string().min(1, 'Value required')
  }),
  execute: async (input, context) => {
    // Redact any passwords or API keys before storing into conversational memory
    const cleanValue = PolicyEngine.redactSensitiveData(input.value);

    // Save or update in database
    await prisma.memoryRecord.upsert({
      where: {
        id: `${context.userId}_${input.key}`
      },
      update: {
        category: input.category,
        value: cleanValue,
        userApproved: true,
        updatedAt: new Date()
      },
      create: {
        id: `${context.userId}_${input.key}`,
        userId: context.userId,
        category: input.category,
        key: input.key,
        value: cleanValue,
        userApproved: true
      }
    });

    return {
      key: input.key,
      category: input.category,
      value: cleanValue,
      affectedResources: [`memory:${input.key}`]
    };
  },
  verify: async (input, output, context) => {
    const record = await prisma.memoryRecord.findFirst({
      where: { userId: context.userId, key: input.key }
    });
    const verified = Boolean(record);
    return {
      taskId: context.taskId,
      stepId: context.stepId,
      verdict: verified ? VerificationVerdictType.VERIFIED_SUCCESS : VerificationVerdictType.NON_RETRYABLE_FAILURE,
      score: verified ? 1.0 : 0.0,
      reasoning: verified ? `Memory key '${input.key}' successfully retrieved from persistent store.` : `Memory key '${input.key}' not found.`,
      evidence: [`Stored key: ${input.key}`, `Category: ${output.category}`]
    };
  }
};

export const memoryRecallTool: ToolDefinition<{
  key?: string;
  category?: string;
  query?: string;
}, { records: Array<{ key: string; category: string; value: string }>; count: number }> = {
  name: 'memory.recall',
  description: 'Recalls user-approved preferences, project context, or past verified outcomes from memory.',
  category: 'memory',
  riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
  requiredPermissions: ['memory:read'],
  idempotent: true,
  timeoutMs: 10000,
  maxRetries: 2,
  verificationStrategy: 'CHECK_STATE',
  inputSchema: z.object({
    key: z.string().optional(),
    category: z.string().optional(),
    query: z.string().optional()
  }),
  execute: async (input, context) => {
    const records = await prisma.memoryRecord.findMany({
      where: {
        userId: context.userId,
        ...(input.key ? { key: input.key } : {}),
        ...(input.category ? { category: input.category } : {})
      }
    });

    let filtered = records;
    if (input.query) {
      const q = input.query.toLowerCase();
      filtered = records.filter(r => r.key.toLowerCase().includes(q) || r.value.toLowerCase().includes(q));
    }

    return {
      records: filtered.map(r => ({ key: r.key, category: r.category, value: r.value })),
      count: filtered.length
    };
  },
  verify: async (input, output) => {
    return {
      taskId: '',
      stepId: '',
      verdict: VerificationVerdictType.VERIFIED_SUCCESS,
      score: 1.0,
      reasoning: `Queried memory store and retrieved ${output.count} relevant records.`,
      evidence: output.records.map(r => `${r.category}:${r.key}`)
    };
  }
};

export const memoryForgetTool: ToolDefinition<{ key: string }, { deleted: boolean; key: string; affectedResources: string[] }> = {
  name: 'memory.forget',
  description: 'Deletes a specific record from long-term memory upon user request.',
  category: 'memory',
  riskLevel: RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
  requiredPermissions: ['memory:delete'],
  idempotent: true,
  timeoutMs: 10000,
  maxRetries: 2,
  verificationStrategy: 'INSPECT_RESOURCE',
  inputSchema: z.object({
    key: z.string().min(1, 'Key required')
  }),
  execute: async (input, context) => {
    await prisma.memoryRecord.deleteMany({
      where: { userId: context.userId, key: input.key }
    });
    return {
      deleted: true,
      key: input.key,
      affectedResources: [`memory:${input.key}`]
    };
  },
  verify: async (input, output, context) => {
    const remaining = await prisma.memoryRecord.count({
      where: { userId: context.userId, key: input.key }
    });
    const purged = remaining === 0;
    return {
      taskId: context.taskId,
      stepId: context.stepId,
      verdict: purged ? VerificationVerdictType.VERIFIED_SUCCESS : VerificationVerdictType.RETRYABLE_FAILURE,
      score: purged ? 1.0 : 0.0,
      reasoning: purged ? `Confirmed memory key '${input.key}' has been purged.` : `Memory key '${input.key}' still exists.`,
      evidence: [`Remaining records for key: ${remaining}`]
    };
  }
};
