import { ToolRegistry } from '../tools/registry';
import { RiskLevel, ActionStatus, ToolDefinition } from '../core/types';
import { z } from 'zod';

describe('ToolRegistry', () => {
  const registry = ToolRegistry.getInstance();

  const mockTool: ToolDefinition<{ text: string; count: number }, { result: string }> = {
    name: 'test.sample_tool',
    description: 'Sample test tool',
    category: 'test',
    riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
    requiredPermissions: ['test:sample'],
    idempotent: true,
    timeoutMs: 500,
    maxRetries: 2,
    verificationStrategy: 'CHECK_STATE',
    inputSchema: z.object({
      text: z.string().min(2),
      count: z.number().positive()
    }),
    outputSchema: z.object({
      result: z.string()
    }),
    execute: async (input) => {
      return { result: `${input.text}_${input.count}` };
    }
  };

  registry.registerTool(mockTool);

  it('rejects invalid tool inputs before execution', async () => {
    const context = { taskId: 't1', stepId: 's1', userId: 'u1' };
    const res = await registry.executeTool('test.sample_tool', { text: 'a', count: -5 }, context);
    expect(res.actionResult.status).toBe(ActionStatus.FAILURE);
    expect(res.actionResult.errorType).toBe('INVALID_ARGUMENTS');
  });

  it('successfully executes tool with valid inputs', async () => {
    const context = { taskId: 't1', stepId: 's1', userId: 'u1' };
    const res = await registry.executeTool('test.sample_tool', { text: 'hello', count: 3 }, context);
    expect(res.actionResult.status).toBe(ActionStatus.SUCCESS);
    expect(res.output.result).toBe('hello_3');
  });

  it('handles tool execution timeout safely', async () => {
    let timer: any;
    const slowTool: ToolDefinition<{ delay: number }, {}> = {
      name: 'test.slow_tool',
      description: 'Slow tool',
      category: 'test',
      riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
      requiredPermissions: [],
      idempotent: true,
      timeoutMs: 50,
      maxRetries: 0,
      verificationStrategy: 'NONE',
      inputSchema: z.object({ delay: z.number() }),
      execute: async (input) => {
        await new Promise(r => {
          timer = setTimeout(r, input.delay);
        });
        return {};
      }
    };
    registry.registerTool(slowTool);

    const context = { taskId: 't1', stepId: 's1', userId: 'u1' };
    const res = await registry.executeTool('test.slow_tool', { delay: 300 }, context);
    if (timer) clearTimeout(timer);
    expect(res.actionResult.status).toBe(ActionStatus.FAILURE);
    expect(res.actionResult.errorType).toBe('TIMEOUT');
  });
});
