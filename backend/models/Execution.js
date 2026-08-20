import mongoose from 'mongoose';

const { Schema } = mongoose;

export const EXECUTION_STATUSES = ['pending', 'running', 'completed', 'failed'];

/**
 * A single hire → run → result record. Timeline steps let the execution page
 * render live progress without a bespoke schema per agent type.
 */
const StepSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    // pending | active | done | failed
    state: { type: String, default: 'pending' },
    at: { type: Date, default: null },
  },
  { _id: false },
);

const ExecutionSchema = new Schema(
  {
    executionId: { type: String, required: true, unique: true, index: true },
    agentId: { type: String, required: true, index: true },
    userAddress: { type: String, required: true, lowercase: true, index: true },

    task: { type: String, required: true },
    // Task configuration supplied at hire time (protocol, target, threshold, ...).
    input: { type: Schema.Types.Mixed, default: {} },
    // Structured result produced by the agent (e.g. health factor report).
    output: { type: Schema.Types.Mixed, default: null },
    steps: { type: [StepSchema], default: [] },

    status: { type: String, enum: EXECUTION_STATUSES, default: 'pending', index: true },
    errorMessage: { type: String, default: '' },

    // Cost actually charged, and duration in milliseconds.
    cost: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'BNB' },
    durationMs: { type: Number, default: null, min: 0 },

    // Network + transaction context (testnet during development).
    chain: { type: String, default: 'bnb-testnet' },
    transactionHash: { type: String, default: '' },

    // Measured manual-vs-agent comparison for the Agent Advantage story.
    advantage: {
      type: new Schema(
        {
          manualDurationMs: Number,
          manualSteps: Number,
          manualCost: Number,
          agentSteps: Number,
          note: String,
        },
        { _id: false },
      ),
      default: null,
    },

    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ExecutionSchema.index({ userAddress: 1, createdAt: -1 });
ExecutionSchema.index({ agentId: 1, createdAt: -1 });

export const Execution = mongoose.model('Execution', ExecutionSchema);
