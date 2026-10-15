import os from 'os';
import { z } from 'zod';
import { ToolDefinition, RiskLevel, VerificationVerdictType } from '../core/types';
import prisma from '../server/db';

export const systemHealthTool: ToolDefinition<{}, {
  status: string;
  uptimeSeconds: number;
  memoryUsageMb: number;
  platform: string;
  cpus: number;
  databaseConnected: boolean;
}> = {
  name: 'system.health',
  description: 'Checks application health, memory usage, CPU count, and database connection status.',
  category: 'system',
  riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
  requiredPermissions: ['system:read'],
  idempotent: true,
  timeoutMs: 5000,
  maxRetries: 2,
  verificationStrategy: 'CHECK_STATE',
  inputSchema: z.object({}),
  execute: async () => {
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    return {
      status: 'OPERATIONAL',
      uptimeSeconds: Math.round(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      platform: os.platform(),
      cpus: os.cpus().length,
      databaseConnected: dbOk
    };
  },
  verify: async (_, output) => {
    const healthy = output.status === 'OPERATIONAL' && output.databaseConnected;
    return {
      taskId: '',
      stepId: '',
      verdict: healthy ? VerificationVerdictType.VERIFIED_SUCCESS : VerificationVerdictType.RETRYABLE_FAILURE,
      score: healthy ? 1.0 : 0.0,
      reasoning: healthy ? 'System is fully operational and database is connected.' : 'System health degraded.',
      evidence: [`Status: ${output.status}`, `DB Connected: ${output.databaseConnected}`]
    };
  }
};

export const deviceStatusTool: ToolDefinition<{ deviceId?: string }, {
  devices: Array<{ deviceId: string; name: string; type: string; status: string; isAuthorized: boolean }>;
  count: number;
}> = {
  name: 'system.device_status',
  description: 'Lists connected devices and their current heartbeat and authorization status.',
  category: 'system',
  riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
  requiredPermissions: ['device:read'],
  idempotent: true,
  timeoutMs: 10000,
  maxRetries: 2,
  verificationStrategy: 'CHECK_STATE',
  inputSchema: z.object({
    deviceId: z.string().optional()
  }),
  execute: async (input, context) => {
    const devices = await prisma.device.findMany({
      where: {
        userId: context.userId,
        ...(input.deviceId ? { deviceId: input.deviceId } : {})
      }
    });

    return {
      devices: devices.map(d => ({
        deviceId: d.deviceId,
        name: d.deviceName,
        type: d.deviceType,
        status: d.connectionStatus,
        isAuthorized: d.isAuthorized
      })),
      count: devices.length
    };
  }
};
