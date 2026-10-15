import { createApp } from './app';
import { config } from './config';

const { app, scheduler } = createApp();

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🤖 JARVIS — Master Autonomous AI Agent System`);
  console.log(`📡 Backend API active on: http://localhost:${config.port}`);
  console.log(`🩺 Health check:          http://localhost:${config.port}/api/health`);
  console.log(`⚡ Real-time SSE stream:  http://localhost:${config.port}/api/events`);
  console.log(`====================================================`);

  // Start background scheduler
  scheduler.start(30000);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  scheduler.stop();
  server.close(() => {
    console.log('HTTP server closed');
  });
});
