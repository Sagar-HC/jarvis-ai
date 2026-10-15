import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import prisma from '../db';
import { JarvisOrchestrator } from '../../agents/orchestrator.agent';
import { IntegrationManager } from '../../integrations/base.connector';
import { EventBroadcaster } from '../events';
import { SchedulerEngine } from '../../core/scheduler';
import { IModelProvider } from '../../providers/model.provider';

export function createApiRouter(
  orchestrator: JarvisOrchestrator,
  scheduler: SchedulerEngine,
  modelProvider: IModelProvider
): Router {
  const router = Router();
  const broadcaster = EventBroadcaster.getInstance();
  const integrationManager = IntegrationManager.getInstance();

  // 1. REAL-TIME SSE STREAM
  router.get('/events', (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    broadcaster.addClient(clientId, res, req.user?.userId);
  });

  // 2. TASKS
  router.post('/tasks', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { request } = req.body;
      if (!request || typeof request !== 'string') {
        return res.status(400).json({ error: 'Request string is required.' });
      }
      const taskId = await orchestrator.submitTask(req.user!.userId, request);
      res.status(201).json({ taskId, message: 'Task submitted successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tasks', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tasks = await prisma.task.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' }
          }
        }
      });
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tasks/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const task = await prisma.task.findUnique({
        where: { id: req.params.id },
        include: {
          steps: { orderBy: { stepIndex: 'asc' } },
          actionResults: { orderBy: { executedAt: 'desc' } },
          verifications: { orderBy: { verifiedAt: 'desc' } },
          approvals: true
        }
      });
      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }
      // Task state isolation check
      if (task.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Access denied to task owned by another user.' });
      }
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await orchestrator.cancelTask(req.params.id, req.body.reason || 'User cancelled task');
      res.json({ success: true, message: 'Task cancellation initiated.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/:id/resume', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await orchestrator.resumeTask(req.params.id);
      res.json({ success: true, message: 'Task resumption initiated.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. APPROVALS
  router.get('/approvals', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const approvals = await prisma.approvalRequest.findMany({
        where: { userId: req.user!.userId, status: 'PENDING' },
        include: { task: true, step: true },
        orderBy: { requestedAt: 'desc' }
      });
      res.json(approvals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/approvals/:id/respond', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { approved, notes } = req.body;
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ error: "'approved' boolean flag is required." });
      }
      await orchestrator.respondToApproval(req.params.id, approved, req.user!.userId, notes);
      res.json({ success: true, message: `Approval response recorded: ${approved ? 'APPROVED' : 'REJECTED'}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. INTEGRATIONS
  router.get('/integrations', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const statuses = await integrationManager.getIntegrationStatuses();
      res.json(statuses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/integrations/:id/connect', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const connector = integrationManager.getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: `Integration provider '${req.params.id}' not found.` });
      }
      const result = await connector.connect(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/integrations/:id/disconnect', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const connector = integrationManager.getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: `Integration provider '${req.params.id}' not found.` });
      }
      await connector.disconnect();
      res.json({ success: true, message: `Disconnected provider '${req.params.id}'.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. DEVICES
  router.get('/devices', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const devices = await prisma.device.findMany({
        where: { userId: req.user!.userId },
        orderBy: { lastHeartbeat: 'desc' }
      });
      res.json(devices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/devices/register', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deviceId, deviceName, deviceType, capabilities } = req.body;
      if (!deviceId || !deviceName || !deviceType) {
        return res.status(400).json({ error: 'deviceId, deviceName, and deviceType are required.' });
      }

      const device = await prisma.device.upsert({
        where: { deviceId },
        update: {
          deviceName,
          deviceType,
          capabilities: JSON.stringify(capabilities || []),
          connectionStatus: 'ONLINE',
          lastHeartbeat: new Date(),
          isAuthorized: true
        },
        create: {
          userId: req.user!.userId,
          deviceId,
          deviceName,
          deviceType,
          capabilities: JSON.stringify(capabilities || []),
          connectionStatus: 'ONLINE',
          lastHeartbeat: new Date(),
          isAuthorized: true
        }
      });
      res.json({ success: true, device });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/devices/heartbeat', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deviceId, connectionStatus } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId is required.' });
      }

      await prisma.device.updateMany({
        where: { deviceId },
        data: {
          lastHeartbeat: new Date(),
          connectionStatus: connectionStatus || 'ONLINE'
        }
      });
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. MEMORY & PRIVACY
  router.get('/memory', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const memories = await prisma.memoryRecord.findMany({
        where: { userId: req.user!.userId },
        orderBy: { updatedAt: 'desc' }
      });
      res.json(memories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/memory', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { category, key, value } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: 'key and value are required.' });
      }
      const record = await prisma.memoryRecord.upsert({
        where: { id: `${req.user!.userId}_${key}` },
        update: { category: category || 'PREFERENCE', value, updatedAt: new Date() },
        create: {
          id: `${req.user!.userId}_${key}`,
          userId: req.user!.userId,
          category: category || 'PREFERENCE',
          key,
          value,
          userApproved: true
        }
      });
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/memory/:key', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await prisma.memoryRecord.deleteMany({
        where: { userId: req.user!.userId, key: req.params.key }
      });
      res.json({ success: true, message: `Memory '${req.params.key}' deleted.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. SCHEDULES & PROACTIVE TASKS
  router.get('/schedules', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schedules = await prisma.scheduledJob.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' }
      });
      res.json(schedules);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/schedules', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, cronExpression, naturalSchedule, prompt } = req.body;
      const job = await scheduler.registerSchedule(
        req.user!.userId,
        name || 'Daily Assistant Briefing',
        cronExpression || '0 8 * * *',
        naturalSchedule || 'Every morning at 8:00 AM',
        prompt || 'Summarize my schedule and outstanding tasks for today.'
      );
      res.status(201).json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. AUDIT & USAGE OBSERVABILITY
  router.get('/audit', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { userId: req.user!.userId },
        orderBy: { timestamp: 'desc' },
        take: 50
      });
      const usage = modelProvider.getUsageStats();
      res.json({ logs, usage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
