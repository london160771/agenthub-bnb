import { Router } from 'express';
import { isDbConnected } from '../config/db.js';
import { hasAiKey } from '../config/env.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';
import agentRoutes from './agentRoutes.js';
import executionRoutes from './executionRoutes.js';
import finderRoutes from './finderRoutes.js';
import paymentRoutes from './paymentRoutes.js';

const router = Router();

export function healthState({ dbConnected, aiConfigured = hasAiKey, now = new Date() } = {}) {
  return {
    healthy: dbConnected === true,
    data: {
      status: dbConnected === true ? 'ok' : 'unhealthy',
      service: 'agenthub-api',
      version: '0.1.0',
      db: dbConnected === true ? 'connected' : 'disconnected',
      ai: aiConfigured ? 'configured' : 'fallback',
      time: now.toISOString(),
    },
  };
}

export function sendHealthResponse(res, options = {}) {
  const health = healthState(options);
  if (!health.healthy) {
    return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'AgentHub persistence is unavailable.', health.data);
  }
  return sendSuccess(res, health.data);
}

/**
 * Health / capability probe. The frontend uses this to show an API status
 * indicator and to know whether DB-backed features are available.
 */
router.get('/health', (req, res) => {
  return sendHealthResponse(res, { dbConnected: isDbConnected() });
});

// Feature routers are mounted here as later phases land:
router.use('/agents', agentRoutes);
router.use('/executions', executionRoutes);
router.use('/finder', finderRoutes);
router.use('/payments', paymentRoutes);

export default router;
