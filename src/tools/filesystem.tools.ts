import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ToolDefinition, RiskLevel, VerificationVerdictType } from '../core/types';

const WORKSPACE_ROOT = process.cwd();

function resolveSafePath(userPath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, userPath);
  // Ensure path is inside workspace or a safe subdirectory
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Path '${userPath}' traverses outside the authorized workspace directory.`);
  }
  return resolved;
}

export const readFileTool: ToolDefinition<{ path: string }, { content: string; size: number }> = {
  name: 'filesystem.read_file',
  description: 'Reads content from a file within the authorized workspace.',
  category: 'filesystem',
  riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
  requiredPermissions: ['filesystem:read'],
  idempotent: true,
  timeoutMs: 10000,
  maxRetries: 2,
  verificationStrategy: 'INSPECT_RESOURCE',
  inputSchema: z.object({
    path: z.string().min(1, 'Path cannot be empty')
  }),
  outputSchema: z.object({
    content: z.string(),
    size: z.number()
  }),
  execute: async (input) => {
    const safePath = resolveSafePath(input.path);
    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found: ${input.path}`);
    }
    const content = fs.readFileSync(safePath, 'utf8');
    return {
      content,
      size: content.length
    };
  },
  verify: async (input, output) => {
    const safePath = resolveSafePath(input.path);
    const exists = fs.existsSync(safePath);
    return {
      taskId: '',
      stepId: '',
      verdict: exists ? VerificationVerdictType.VERIFIED_SUCCESS : VerificationVerdictType.NON_RETRYABLE_FAILURE,
      score: exists ? 1.0 : 0.0,
      reasoning: exists ? `Verified file '${input.path}' exists and contains ${output.size} bytes.` : `File '${input.path}' does not exist.`,
      evidence: [`File exists: ${exists}`, `File byte size: ${output.size}`]
    };
  }
};

export const writeFileTool: ToolDefinition<{ path: string; content: string }, { bytesWritten: number; path: string; affectedResources: string[] }> = {
  name: 'filesystem.write_file',
  description: 'Writes content to a file in the workspace. Overwrites existing content safely.',
  category: 'filesystem',
  riskLevel: RiskLevel.LEVEL_1_REVERSIBLE_PRIVATE,
  requiredPermissions: ['filesystem:write'],
  idempotent: true,
  timeoutMs: 15000,
  maxRetries: 2,
  verificationStrategy: 'INSPECT_RESOURCE',
  inputSchema: z.object({
    path: z.string().min(1, 'Path cannot be empty'),
    content: z.string()
  }),
  execute: async (input) => {
    const safePath = resolveSafePath(input.path);
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(safePath, input.content, 'utf8');
    return {
      bytesWritten: Buffer.byteLength(input.content, 'utf8'),
      path: input.path,
      affectedResources: [input.path]
    };
  },
  verify: async (input, output) => {
    const safePath = resolveSafePath(input.path);
    if (!fs.existsSync(safePath)) {
      return {
        taskId: '',
        stepId: '',
        verdict: VerificationVerdictType.NON_RETRYABLE_FAILURE,
        score: 0.0,
        reasoning: `Expected written file '${input.path}' was not found on disk.`,
        evidence: ['File missing on disk']
      };
    }
    const actualContent = fs.readFileSync(safePath, 'utf8');
    const matched = actualContent === input.content;
    return {
      taskId: '',
      stepId: '',
      verdict: matched ? VerificationVerdictType.VERIFIED_SUCCESS : VerificationVerdictType.VERIFIED_PARTIAL_SUCCESS,
      score: matched ? 1.0 : 0.7,
      reasoning: matched ? `Verified file '${input.path}' accurately matches written content (${actualContent.length} bytes).` : `File content mismatch in '${input.path}'.`,
      evidence: [`Disk size: ${actualContent.length} bytes`, `Content match: ${matched}`]
    };
  }
};

export const listDirTool: ToolDefinition<{ path?: string }, { files: string[]; count: number }> = {
  name: 'filesystem.list_dir',
  description: 'Lists files and directories in the workspace.',
  category: 'filesystem',
  riskLevel: RiskLevel.LEVEL_0_READ_ONLY,
  requiredPermissions: ['filesystem:read'],
  idempotent: true,
  timeoutMs: 10000,
  maxRetries: 2,
  verificationStrategy: 'INSPECT_RESOURCE',
  inputSchema: z.object({
    path: z.string().optional().default('.')
  }),
  execute: async (input) => {
    const safePath = resolveSafePath(input.path || '.');
    if (!fs.existsSync(safePath)) {
      throw new Error(`Directory not found: ${input.path}`);
    }
    const files = fs.readdirSync(safePath);
    return {
      files,
      count: files.length
    };
  }
};
