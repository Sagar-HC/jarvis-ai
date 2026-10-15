import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'jarvis-default-dev-secret-32-chars-long',
  sessionExpiry: process.env.SESSION_EXPIRY || '7d',
  activeModelProvider: process.env.ACTIVE_MODEL_PROVIDER || 'mock',
  executionLeaseDurationMs: parseInt(process.env.EXECUTION_LEASE_DURATION_MS || '60000', 10),
  maxRecoveryRetries: parseInt(process.env.MAX_RECOVERY_RETRIES || '2', 10),
  maxConcurrentStepsPerUser: parseInt(process.env.MAX_CONCURRENT_STEPS_PER_USER || '4', 10),
  autoApproveRiskLevelUpTo: parseInt(process.env.AUTO_APPROVE_RISK_LEVEL_UP_TO || '1', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || ''
};
