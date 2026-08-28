import { asyncHandler, ApiError } from '../utils/apiResponse.js';
import { isDbConnected } from '../config/db.js';
import { findAgents } from '../services/finderService.js';
import { hasAiKey } from '../config/env.js';

function ensureDb() {
  if (!isDbConnected()) throw ApiError.unavailable('The marketplace database is not available right now.');
}

/**
 * POST /api/finder
 * Body: { query, limit? }
 * Also supports GET /api/finder?q=... for convenience.
 */
export const postFinder = asyncHandler(async (req, res) => {
  ensureDb();
  const query = String(req.body?.query ?? req.query?.q ?? '').trim();
  if (!query) throw ApiError.badRequest('Query is required.');
  if (query.length > 500) throw ApiError.badRequest('Query must be 500 characters or less.');
  const limitRaw = req.body?.limit ?? req.query?.limit;
  let limit = 12;
  if (limitRaw != null && limitRaw !== '') {
    const n = Number(limitRaw);
    if (!Number.isFinite(n) || n < 1 || n > 24) throw ApiError.badRequest('limit must be 1..24');
    limit = Math.trunc(n);
  }

  const result = await findAgents(query, { limit });
  res.json({
    success: true,
    data: {
      query,
      intent: {
        category: result.intentCategory,
        source: result.intentSource, // ai | keyword | none
        aiConfigured: hasAiKey,
      },
      tokens: result.queryTokens,
      total: result.results.length,
      results: result.results.map((r) => ({
        agent: r.agent,
        match: {
          score: r.score,
          pct: r.pct,
          reasons: r.reasons,
          breakdown: r.breakdown,
        },
      })),
    },
  });
});

export const getFinder = postFinder;
