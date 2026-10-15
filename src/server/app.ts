import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { initializeToolRegistry } from '../tools';
import { initializeIntegrations } from '../integrations';
import { JarvisOrchestrator } from '../agents/orchestrator.agent';
import { SchedulerEngine } from '../core/scheduler';
import { MockModelProvider } from '../providers/mock.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import { IModelProvider } from '../providers/model.provider';
import { authMiddleware } from './middleware/auth.middleware';
import { createApiRouter } from './routes/api.routes';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Initialize Core Subsystems
  initializeToolRegistry();
  initializeIntegrations();

  // Model Provider
  let modelProvider: IModelProvider;
  if (config.openaiApiKey && config.openaiApiKey.startsWith('sk-')) {
    modelProvider = new OpenAIProvider(config.openaiApiKey);
  } else {
    modelProvider = new MockModelProvider();
  }

  // Orchestrator & Scheduler
  const orchestrator = new JarvisOrchestrator(modelProvider);
  const scheduler = new SchedulerEngine(orchestrator);

  // Health endpoint (public)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'HEALTHY',
      service: 'JARVIS Central Execution Engine',
      version: '1.0.0',
      activeModelProvider: modelProvider.name,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // Protected API routes
  app.use('/api', authMiddleware, createApiRouter(orchestrator, scheduler, modelProvider));

  // Serve static client bundle if built
  const clientDist = path.join(process.cwd(), 'client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return { app, orchestrator, scheduler, modelProvider };
}
