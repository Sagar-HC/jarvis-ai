import prisma from '../server/db';
import { PolicyEngine } from '../core/policy';
import { AuditLogger } from '../core/audit';

export class MemoryAgent {
  public async getRelevantContext(userId: string, currentGoal: string): Promise<string[]> {
    const memories = await prisma.memoryRecord.findMany({
      where: { userId, userApproved: true },
      take: 20
    });

    const relevant = memories.map(m => `[${m.category}] ${m.key}: ${m.value}`);
    return relevant;
  }

  public async rememberPreference(userId: string, key: string, value: string): Promise<void> {
    const cleanValue = PolicyEngine.redactSensitiveData(value);
    await prisma.memoryRecord.upsert({
      where: { id: `${userId}_${key}` },
      update: { value: cleanValue, category: 'PREFERENCE', userApproved: true },
      create: {
        id: `${userId}_${key}`,
        userId,
        category: 'PREFERENCE',
        key,
        value: cleanValue,
        userApproved: true
      }
    });
    AuditLogger.log('MEMORY_PREFERENCE_STORED', { key }, { userId });
  }

  public async storeTaskOutcome(userId: string, taskId: string, summary: string): Promise<void> {
    const key = `task_result_${taskId.slice(0, 8)}`;
    await prisma.memoryRecord.create({
      data: {
        id: `${userId}_${key}_${Date.now()}`,
        userId,
        category: 'HISTORICAL_RESULT',
        key,
        value: PolicyEngine.redactSensitiveData(summary),
        userApproved: true
      }
    });
  }

  public async purgeMemory(userId: string, key?: string): Promise<number> {
    const result = await prisma.memoryRecord.deleteMany({
      where: {
        userId,
        ...(key ? { key } : {})
      }
    });
    AuditLogger.log('MEMORY_PURGED', { key: key || 'ALL', count: result.count }, { userId });
    return result.count;
  }
}
