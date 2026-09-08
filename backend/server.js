import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isProd } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import apiRouter from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server (no origin) and configured clients.
      if (!origin || env.clientUrls.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

app.get('/', (req, res) =>
  res.json({ success: true, data: { name: 'AgentHub API', health: '/api/health' } }),
);
app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);

let httpServer = null;
let shutdownInProgress = false;

async function shutdown(signal) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  try {
    await new Promise((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(resolve);
    });
    await disconnectDatabase();
    console.log(`[server] Shutdown complete after ${signal}`);
  } catch (err) {
    console.error(`[server] Shutdown failed after ${signal}: ${err.message}`);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

async function start() {
  await connectDatabase();
  httpServer = app.listen(env.port, () => {
    console.log(`[server] AgentHub API listening on http://localhost:${env.port}`);
    console.log(`[server] Environment: ${env.nodeEnv}`);
  });
}

start().catch((err) => {
  console.error(`[server] Startup failed: ${err.message}`);
  process.exitCode = 1;
});

export default app;
