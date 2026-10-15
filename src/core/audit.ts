import { AuditRecord, RiskLevel } from './types';
import { PolicyEngine } from './policy';

export class AuditLogger {
  private static subscribers: ((record: AuditRecord) => void)[] = [];

  public static subscribe(fn: (record: AuditRecord) => void): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== fn);
    };
  }

  public static log(
    eventType: string,
    details: Record<string, any>,
    options?: {
      userId?: string;
      taskId?: string;
      riskLevel?: RiskLevel;
      ipAddress?: string;
    }
  ): AuditRecord {
    const redactedDetails = PolicyEngine.redactSensitiveData(details);
    const record: AuditRecord = {
      eventType,
      details: redactedDetails,
      userId: options?.userId,
      taskId: options?.taskId,
      riskLevel: options?.riskLevel ?? RiskLevel.LEVEL_0_READ_ONLY,
      ipAddress: options?.ipAddress
    };

    // Print structured log
    const logLine = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...record
    });

    if (record.riskLevel >= RiskLevel.LEVEL_2_CONSEQUENTIAL_EXTERNAL) {
      console.warn(`[AUDIT-WARN] ${logLine}`);
    } else {
      console.log(`[AUDIT-INFO] ${logLine}`);
    }

    // Broadcast to memory / live stream subscribers
    for (const sub of this.subscribers) {
      try {
        sub(record);
      } catch (err) {
        console.error('Error in audit log subscriber:', err);
      }
    }

    return record;
  }
}
