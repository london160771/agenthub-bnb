import { isDbConnected } from '../config/db.js';
import { Agent } from '../models/Agent.js';
import { confirmNativeBnbPayment, preparePayment } from '../services/payments/paymentService.js';
import { NativeBnbPaymentError } from '../services/payments/nativeBnbPaymentExecutor.js';
import { ApiError, asyncHandler, sendSuccess } from '../utils/apiResponse.js';

const PROJECTION = '-__v -_id';
const MAX_TASK_LENGTH = 300;

function ensureDb() {
  if (!isDbConnected()) {
    throw ApiError.unavailable('The marketplace database is not available right now.');
  }
}

/**
 * Prepare a payment requirement from the server-side Agent record. This route
 * never accepts payment facts from the browser and never submits a payment.
 */
export const postPaymentPreparation = asyncHandler(async (req, res) => {
  ensureDb();
  const agentId = typeof req.body?.agentId === 'string' ? req.body.agentId.trim() : '';
  if (!agentId) throw ApiError.badRequest('"agentId" is required.');

  const task = typeof req.body?.task === 'string' ? req.body.task.trim() : '';
  if (task.length > MAX_TASK_LENGTH) {
    throw ApiError.badRequest(`"task" must be ${MAX_TASK_LENGTH} characters or fewer.`);
  }

  const agent = await Agent.findOne({ agentId }).select(PROJECTION).lean();
  if (!agent) throw ApiError.notFound(`No agent found with id "${agentId}".`);

  sendSuccess(res, preparePayment({ agent, task }));
});

/**
 * POST /api/payments/:executionId/confirm — verify a wallet-submitted native
 * BNB transfer. AgentHub never receives a key and never broadcasts here.
 */
export const postPaymentConfirmation = asyncHandler(async (req, res) => {
  ensureDb();
  const executionId = String(req.params.executionId || '').trim();
  const transactionHash = typeof req.body?.transactionHash === 'string' ? req.body.transactionHash.trim() : '';
  const userAddress = typeof req.body?.userAddress === 'string' ? req.body.userAddress.trim() : '';
  if (!executionId || !transactionHash || !userAddress) {
    throw ApiError.badRequest('executionId, transactionHash and userAddress are required.');
  }

  try {
    sendSuccess(res, await confirmNativeBnbPayment({ executionId, transactionHash, userAddress }));
  } catch (err) {
    if (err instanceof NativeBnbPaymentError) {
      const status = err.code.startsWith('PAYMENT_RPC_') ? 503 : 400;
      throw new ApiError(status, err.code, err.message);
    }
    throw err;
  }
});
