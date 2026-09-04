/**
 * CLI wrapper for the shared incremental 8004scan refresh.
 * Usage: node scripts/ingest8004.js [--dry-run] [--limit=40]
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import {
  refreshIndexedAgents,
  normalizeRegistryAgent,
  toAgentDoc,
} from '../services/indexedAgentIngestion.js';

async function run({ dryRun = false, limit = 40, wipeIndexed = false } = {}) {
  await connectDatabase({ refresh: false });
  if (mongoose.connection.readyState !== 1) {
    console.error('[ingest] No database connection — aborting');
    process.exitCode = 1;
    return null;
  }

  const result = await refreshIndexedAgents({ dryRun, limit, wipeIndexed });
  console.log(
    `[ingest] done. before=${result.beforeIndexed} after=${result.afterIndexed} ` +
      `processed=${result.processed} inserted=${result.inserted} updated=${result.updated} failed=${result.failed}`,
  );
  console.log('[ingest] provenance: source=\'indexed\'; categories and trust are AgentHub-derived; no payment was sent');
  await disconnectDatabase();
  return result;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wipeIndexed = args.includes('--wipe-indexed');
const limitArg = args.find((arg) => arg.startsWith('--limit'));
const limit = limitArg ? Number(limitArg.split('=')[1]) || 40 : 40;
const isMain = process.argv[1] && import.meta.url.endsWith('ingest8004.js');

if (isMain) run({ dryRun, limit, wipeIndexed }).catch((err) => {
  console.error('[ingest] fatal', err.message);
  process.exitCode = 1;
});

export { run, normalizeRegistryAgent, toAgentDoc };
