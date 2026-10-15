export interface ConnectorCapability {
  name: string;
  description: string;
  riskLevel: number;
  permissionsRequired: string[];
}

export interface ConnectorHealth {
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'CONFIG_REQUIRED';
  isSimulated: boolean;
  message: string;
  checkedAt: string;
}

export interface IConnector {
  providerId: string;
  name: string;
  isSimulated: boolean;
  getCapabilities(): ConnectorCapability[];
  checkHealth(): Promise<ConnectorHealth>;
  connect(config: Record<string, any>): Promise<{ success: boolean; message: string }>;
  disconnect(): Promise<void>;
}

export class IntegrationManager {
  private static instance: IntegrationManager;
  private connectors: Map<string, IConnector> = new Map();

  private constructor() {}

  public static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  public registerConnector(connector: IConnector): void {
    this.connectors.set(connector.providerId, connector);
  }

  public getConnector(providerId: string): IConnector | undefined {
    return this.connectors.get(providerId);
  }

  public getAllConnectors(): IConnector[] {
    return Array.from(this.connectors.values());
  }

  public async getIntegrationStatuses(): Promise<Array<{
    providerId: string;
    name: string;
    isSimulated: boolean;
    capabilities: ConnectorCapability[];
    health: ConnectorHealth;
  }>> {
    const list: any[] = [];
    for (const connector of this.connectors.values()) {
      const health = await connector.checkHealth();
      list.push({
        providerId: connector.providerId,
        name: connector.name,
        isSimulated: connector.isSimulated,
        capabilities: connector.getCapabilities(),
        health
      });
    }
    return list;
  }
}
