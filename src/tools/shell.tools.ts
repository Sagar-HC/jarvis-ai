import { exec } from 'child_process';
import { z } from 'zod';
import { ToolDefinition, RiskLevel, VerificationVerdictType } from '../core/types';

export const shellCommandTool: ToolDefinition<{ command: string; timeoutMs?: number }, { command: string; stdout: string; stderr: string; exitCode: number }> = {
  name: 'shell.run_command',
  description: 'Executes a command within the authorized environment workspace.',
  category: 'shell',
  riskLevel: RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
  requiredPermissions: ['shell:execute'],
  idempotent: false,
  timeoutMs: 30000,
  maxRetries: 1,
  verificationStrategy: 'CHECK_STATE',
  inputSchema: z.object({
    command: z.string().min(1, 'Command cannot be empty'),
    timeoutMs: z.number().optional().default(20000)
  }),
  execute: async (input) => {
    // Basic command sanitization: Prevent arbitrary destructive shell injections outside workspace
    const blockedCommands = ['format c:', 'rmdir /s /q c:\\', 'rm -rf /', ':(){ :|:& };:'];
    for (const blocked of blockedCommands) {
      if (input.command.toLowerCase().includes(blocked)) {
        throw new Error(`Command '${input.command}' contains prohibited destructive syntax.`);
      }
    }

    return new Promise((resolve, reject) => {
      exec(
        input.command,
        {
          cwd: process.cwd(),
          timeout: input.timeoutMs || 20000,
          maxBuffer: 1024 * 1024
        },
        (error, stdout, stderr) => {
          if (error && error.killed) {
            return reject(new Error(`Command timed out after ${input.timeoutMs}ms`));
          }
          resolve({
            command: input.command,
            stdout: stdout.toString().slice(0, 5000),
            stderr: stderr.toString().slice(0, 5000),
            exitCode: error ? (error.code || 1) : 0
          });
        }
      );
    });
  },
  verify: async (input, output) => {
    const success = output.exitCode === 0;
    return {
      taskId: '',
      stepId: '',
      verdict: success ? VerificationVerdictType.VERIFIED_SUCCESS : VerificationVerdictType.RETRYABLE_FAILURE,
      score: success ? 1.0 : 0.0,
      reasoning: success ? `Command '${input.command}' completed with exit code 0.` : `Command '${input.command}' failed with exit code ${output.exitCode}.`,
      evidence: [
        `Exit code: ${output.exitCode}`,
        `Output preview: ${output.stdout.slice(0, 150) || output.stderr.slice(0, 150)}`
      ]
    };
  }
};
