import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralised, validated access to environment variables.
 * Never import process.env directly elsewhere — use this module so defaults
 * and coercion stay in one place.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3001,
  // Support a comma-separated list of allowed origins.
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGODB_URI || '',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'claude-sonnet-4-5',
  bnbRpcUrl: process.env.BNB_RPC_URL || '',
  bnbTestnetRpcUrl: process.env.BNB_TESTNET_RPC_URL || '',
};

export const isProd = env.nodeEnv === 'production';
export const hasAiKey = Boolean(env.aiApiKey);
