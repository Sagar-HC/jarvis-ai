import prisma from '../server/db';
import { JarvisOrchestrator } from '../agents/orchestrator.agent';
import { AuditLogger } from './audit';

export class SchedulerEngine {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private orchestrator: JarvisOrchestrator) {}

  public start(intervalMs: number = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.tick(), intervalMs);
    AuditLogger.log('SCHEDULER_STARTED', { intervalMs });
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    AuditLogger.log('SCHEDULER_STOPPED', {});
  }

  /**
   * Evaluates due scheduled jobs
   */
  public async tick(): Promise<void> {
    const now = new Date();
    try {
      const dueJobs = await prisma.scheduledJob.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { nextRunAt: { lte: now } },
            { nextRunAt: null }
          ]
        }
      });

      for (const job of dueJobs) {
        await this.executeJob(job);
      }
    } catch (err: any) {
      console.error('[SCHEDULER-ERROR] Error checking scheduled jobs:', err);
    }
  }

  private async executeJob(job: any): Promise<void> {
    AuditLogger.log('SCHEDULED_JOB_TRIGGER', { jobId: job.id, name: job.name }, { userId: job.userId });

    const template = JSON.parse(job.taskTemplate || '{}');
    const prompt = template.prompt || job.name;

    // Advance nextRunAt (e.g. 24 hours or next cron interval)
    const nextRun = new Date(Date.now() + 24 * 3600 * 1000);
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: nextRun
      }
    });

    // Execute via Orchestrator with full verification pipeline
    await this.orchestrator.submitTask(job.userId, prompt);
  }

  public async registerSchedule(
    userId: string,
    name: string,
    cronExpression: string,
    naturalSchedule: string,
    prompt: string
  ): Promise<any> {
    const nextRunAt = new Date(Date.now() + 24 * 3600 * 1000); // 1 day default
    const job = await prisma.scheduledJob.create({
      data: {
        userId,
        name,
        cronExpression,
        naturalSchedule,
        taskTemplate: JSON.stringify({ prompt }),
        status: 'ACTIVE',
        nextRunAt
      }
    });

    AuditLogger.log('SCHEDULE_REGISTERED', { jobId: job.id, name, naturalSchedule }, { userId });
    return job;
  }
}
