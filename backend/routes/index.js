import { Router } from 'express';
import { isDbConnected } from '../config/db.js';
import { hasAiKey } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';
import agentRoutes from './agentRoutes.js';
import executionRoutes from './executionRoutes.js';
import finderRoutes from './finderRoutes.js';

const router = Router();

/**
 * Health / capability probe. The frontend uses this to show an API status
 * indicator and to know whether DB-backed features are available.
 */
router.get('/health', (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    service: 'agenthub-api',
    version: '0.1.0',
    db: isDbConnected() ? 'connected' : 'disconnected',
    ai: hasAiKey ? 'configured' : 'fallback',
    time: new Date().toISOString(),
  });
});

// Feature routers are mounted here as later phases land:
router.use('/agents', agentRoutes);
router.use('/executions', executionRoutes);
router.use('/finder', finderRoutes);

export default router;
