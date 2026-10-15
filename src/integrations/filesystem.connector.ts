import fs from 'fs';
import { IConnector, ConnectorCapability, ConnectorHealth } from './base.connector';

export class FilesystemConnector implements IConnector {
  public providerId = 'FILESYSTEM';
  public name = 'Local Workspace Storage';
  public isSimulated = false; // Real filesystem

  public getCapabilities(): ConnectorCapability[] {
    return [
      { name: 'filesystem.read_file', description: 'Read files from workspace', riskLevel: 0, permissionsRequired: ['filesystem:read'] },
      { name: 'filesystem.write_file', description: 'Write or modify files in workspace', riskLevel: 1, permissionsRequired: ['filesystem:write'] },
      { name: 'filesystem.list_dir', description: 'List directories in workspace', riskLevel: 0, permissionsRequired: ['filesystem:read'] }
    ];
  }

  public async checkHealth(): Promise<ConnectorHealth> {
    const cwd = process.cwd();
    const accessible = fs.existsSync(cwd);
    return {
      status: accessible ? 'CONNECTED' : 'ERROR',
      isSimulated: false,
      message: accessible ? `Workspace accessible at ${cwd}` : 'Workspace path inaccessible',
      checkedAt: new Date().toISOString()
    };
  }

  public async connect(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Filesystem is locally mounted and authorized.' };
  }

  public async disconnect(): Promise<void> {}
}
