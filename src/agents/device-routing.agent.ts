import prisma from '../server/db';
import { PlannedStep, DeviceType } from '../core/types';
import { AuditLogger } from '../core/audit';

export interface RoutingDecision {
  assignedDeviceId: string;
  workerType: 'SERVER' | 'DESKTOP' | 'MOBILE' | 'BROWSER';
  canExecuteNow: boolean;
  reason: string;
}

export class DeviceRoutingAgent {
  /**
   * Determines the optimal, authorized device to execute a planned step.
   * Enforces device presence, capabilities, and execution leases.
   */
  public async routeStep(step: PlannedStep, userId: string): Promise<RoutingDecision> {
    // Determine required capabilities
    const capability = step.capability.toLowerCase();
    const isDesktopExclusive = capability === 'shell' || step.toolName.startsWith('desktop.');

    // Look for registered, authorized, and online devices for this user
    const devices = await prisma.device.findMany({
      where: {
        userId,
        isAuthorized: true
      }
    });

    const now = new Date().getTime();
    // A device is considered active if heartbeat was received within the last 60 seconds
    const activeDevices = devices.filter(d => (now - new Date(d.lastHeartbeat).getTime()) < 60000 && d.connectionStatus === 'ONLINE');

    if (isDesktopExclusive) {
      const desktopWorker = activeDevices.find(d => d.deviceType === 'DESKTOP');
      if (desktopWorker) {
        return {
          assignedDeviceId: desktopWorker.deviceId,
          workerType: 'DESKTOP',
          canExecuteNow: true,
          reason: `Step requires desktop environment; routed to active desktop worker '${desktopWorker.deviceName}'.`
        };
      } else {
        return {
          assignedDeviceId: 'NONE',
          workerType: 'DESKTOP',
          canExecuteNow: false,
          reason: 'Desktop capability required, but no authorized desktop worker is currently online. Pausing step safely.'
        };
      }
    }

    // Cloud-compatible steps (filesystem in workspace, web, calendar, email, memory) can execute on the server
    const serverWorker = activeDevices.find(d => d.deviceType === 'SERVER');
    return {
      assignedDeviceId: serverWorker ? serverWorker.deviceId : 'server-local',
      workerType: 'SERVER',
      canExecuteNow: true,
      reason: 'Step is cloud/server compatible; routed to central execution worker.'
    };
  }

  /**
   * Acquires a distributed execution lease to prevent double-execution across multiple workers
   */
  public async acquireLease(taskId: string, stepId: string, deviceId: string, workerId: string, durationMs: number = 60000): Promise<{ acquired: boolean; leaseToken?: string; reason?: string }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMs);

    // Check if an active lease already exists
    const existing = await prisma.executionLease.findFirst({
      where: {
        taskId,
        stepId,
        status: 'ACTIVE',
        expiresAt: { gt: now }
      }
    });

    if (existing) {
      if (existing.workerId === workerId && existing.deviceId === deviceId) {
        // Renew lease
        await prisma.executionLease.update({
          where: { id: existing.id },
          data: { expiresAt }
        });
        return { acquired: true, leaseToken: existing.leaseToken };
      }
      return {
        acquired: false,
        reason: `Step is currently leased to worker '${existing.workerId}' on device '${existing.deviceId}' until ${existing.expiresAt.toISOString()}.`
      };
    }

    const leaseToken = `lease_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await prisma.executionLease.create({
      data: {
        taskId,
        stepId,
        deviceId,
        workerId,
        leaseToken,
        leasedAt: now,
        expiresAt,
        status: 'ACTIVE'
      }
    });

    AuditLogger.log('LEASE_ACQUIRED', { taskId, stepId, deviceId, workerId, leaseToken });
    return { acquired: true, leaseToken };
  }

  /**
   * Releases an execution lease upon step completion or failure
   */
  public async releaseLease(leaseToken: string): Promise<void> {
    await prisma.executionLease.updateMany({
      where: { leaseToken },
      data: { status: 'RELEASED' }
    });
    AuditLogger.log('LEASE_RELEASED', { leaseToken });
  }
}
