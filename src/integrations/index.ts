import { IntegrationManager } from './base.connector';
import { FilesystemConnector } from './filesystem.connector';
import { CalendarConnector, EmailConnector, GitHubConnector, WebSearchConnector } from './connectors';

export function initializeIntegrations(): IntegrationManager {
  const manager = IntegrationManager.getInstance();
  manager.registerConnector(new FilesystemConnector());
  manager.registerConnector(new CalendarConnector());
  manager.registerConnector(new EmailConnector());
  manager.registerConnector(new GitHubConnector());
  manager.registerConnector(new WebSearchConnector());
  return manager;
}

export * from './base.connector';
export * from './connectors';
export * from './filesystem.connector';
