/**
 * Standalone seed script: `npm run seed`.
 *
 * Populates a REAL MongoDB (from MONGODB_URI) with the curated catalogue.
 * Running against the in-memory dev database would be pointless — it is
 * ephemeral and already auto-seeds on boot — so this script requires a URI.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npm run seed
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { seedAgentCatalogue } from '../services/agentSeeder.js';

async function run() {
  if (!env.mongoUri) {
    console.error(
      '[seed] MONGODB_URI is not set.\n' +
        '       Set it to the database you want to seed, e.g.\n' +
        '         MONGODB_URI="mongodb+srv://..." npm run seed\n' +
        '       (In development, running the server with no URI already seeds an in-memory DB.)',
    );
    process.exitCode = 1;
    return;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('[seed] Connected to MongoDB');

  const { inserted } = await seedAgentCatalogue({ wipe: true });
  console.log(`[seed] Reseeded catalogue: ${inserted} agents inserted.`);

  await mongoose.disconnect();
  console.log('[seed] Done.');
}

run().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exitCode = 1;
  mongoose.disconnect().finally(() => process.exit(1));
});
