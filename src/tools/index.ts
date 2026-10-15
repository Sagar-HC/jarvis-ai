import { ToolRegistry } from './registry';
import { readFileTool, writeFileTool, listDirTool } from './filesystem.tools';
import { webSearchTool, webFetchPageTool } from './web.tools';
import { shellCommandTool } from './shell.tools';
import { calendarListEventsTool, calendarCheckConflictsTool, calendarCreateEventTool } from './calendar.tools';
import { emailListMessagesTool, emailExtractActionItemsTool, emailSendMessageTool } from './email.tools';
import { memoryRememberTool, memoryRecallTool, memoryForgetTool } from './memory.tools';
import { systemHealthTool, deviceStatusTool } from './system.tools';

export function initializeToolRegistry(): ToolRegistry {
  const registry = ToolRegistry.getInstance();

  // Filesystem
  registry.registerTool(readFileTool);
  registry.registerTool(writeFileTool);
  registry.registerTool(listDirTool);

  // Web
  registry.registerTool(webSearchTool);
  registry.registerTool(webFetchPageTool);

  // Shell
  registry.registerTool(shellCommandTool);

  // Calendar
  registry.registerTool(calendarListEventsTool);
  registry.registerTool(calendarCheckConflictsTool);
  registry.registerTool(calendarCreateEventTool);

  // Email
  registry.registerTool(emailListMessagesTool);
  registry.registerTool(emailExtractActionItemsTool);
  registry.registerTool(emailSendMessageTool);

  // Memory
  registry.registerTool(memoryRememberTool);
  registry.registerTool(memoryRecallTool);
  registry.registerTool(memoryForgetTool);

  // System
  registry.registerTool(systemHealthTool);
  registry.registerTool(deviceStatusTool);

  return registry;
}

export * from './registry';
