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

/**
 * A manual-vs-agent measurement, recorded by a human after actually doing the
 * task both ways. See AGENT_ADVANTAGE.md for the protocol and the rubric.
 *
 * THREE RULES THIS SCHEMA ENFORCES, deliberately:
 *
 * 1. **No defaults on any field.** Not one. A `default: 0` on `manualCost` or a
 *    `default: 5` on a quality score would be a fabricated measurement the
 *    moment the parent object came into existence. Absent means "not measured",
 *    and it must stay visibly absent.
 *
 * 2. **Provenance is required, not optional.** If this object exists at all, it
 *    must say who measured it, when, how the manual run was performed, and where
 *    the raw evidence lives. A number without those four is an anecdote.
 *
 * 3. **A metric can't appear without its definition.** Step counts require
 *    `stepDefinition`; quality scores require `qualityRubric`. Two people
 *    counting "steps" differently produce numbers that cannot be compared, so
 *    the definition travels with the data.
 *
 * Because the parent path is `default: null`, none of this validation runs on an
 * ordinary execution — an unmeasured hire simply has `advantage: null`.
 */
const AdvantageSchema = new Schema(
  {
    // --- How the human did it ----------------------------------------------
    /** Wall-clock time for a human to produce the equivalent output. */
    manualDurationMs: { type: Number, min: 0 },
    /**
     * Discrete human actions counted under `stepDefinition`. NOT comparable to
     * this app's internal pipeline steps, which is why nothing derives it.
     */
    manualSteps: { type: Number, min: 0 },
    /** Money actually attributable to the manual run, under `manualCostBasis`. */
    manualCost: { type: Number, min: 0 },
    /** Unit for `manualCost` (e.g. 'USD'). Required once a cost is recorded. */
    manualCurrency: {
      type: String,
      required: function currencyNeeded() {
        return this.manualCost != null;
      },
    },
    /**
     * How `manualCost` was arrived at — the rate, the source of that rate, and
     * what it includes. A cost without a stated basis is not checkable.
     */
    manualCostBasis: {
      type: String,
      required: function basisNeeded() {
        return this.manualCost != null;
      },
    },
    /** Exactly what the human did: tools opened, pages visited, in order. */
    manualMethod: { type: String, required: true },
    /** The human's actual output, preserved verbatim for side-by-side reading. */
    manualOutput: { type: String },

    // --- How the agent did it ----------------------------------------------
    /**
     * Human wall-clock time to get the answer USING the agent: from starting the
     * hire form to having the result in hand, stopwatch-measured.
     *
     * This — not the execution's `durationMs` — is the figure comparable to
     * `manualDurationMs`. `durationMs` measures only the backend run, which
     * excludes the person choosing an agent and filling in the form; comparing it
     * to a human's wall-clock would flatter the agent by omitting exactly the
     * part a human does. Both numbers are kept, and the report shows both.
     */
    agentOperatorDurationMs: { type: Number, min: 0 },
    /**
     * Human-counted agent actions under the SAME `stepDefinition` as
     * `manualSteps`. Never populated from the six internal timeline steps —
     * those measure our pipeline, not work a person would have to do.
     */
    agentSteps: { type: Number, min: 0 },
    /**
     * The exact counting rule used for both step figures, quoted so a reader can
     * recount. Required whenever either step count is present.
     */
    stepDefinition: {
      type: String,
      required: function stepDefNeeded() {
        return this.manualSteps != null || this.agentSteps != null;
      },
    },

    // --- Output quality ----------------------------------------------------
    // Scored 0-5 on each of four dimensions (see AGENT_ADVANTAGE.md), so the
    // composite runs 0-20. Bounds are structural only; nothing fills them in.
    agentQuality: { type: Number, min: 0, max: 20 },
    manualQuality: { type: Number, min: 0, max: 20 },
    /** Rubric name + version used for both scores. Required if either is set. */
    qualityRubric: {
      type: String,
      required: function rubricNeeded() {
        return this.agentQuality != null || this.manualQuality != null;
      },
    },
    /** Who scored the outputs, if not the person who ran the experiment. */
    qualityScoredBy: { type: String },

    // --- Provenance of the measurement itself -------------------------------
    /** Where the raw evidence lives (recording, transcript, screenshots). */
    evidenceRef: { type: String, required: true },
    /** The person who ran both halves of the experiment. */
    measuredBy: { type: String, required: true },
    /** When the experiment was conducted. */
    measuredAt: { type: Date, required: true },
    /** Caveats: what went wrong, what was retried, what is not comparable. */
    note: { type: String },
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

    // Fee recorded against the hire. NOT charged — this build simulates payment,
    // so no tBNB moves and `transactionHash` stays empty.
    cost: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'BNB' },
    durationMs: { type: Number, default: null, min: 0 },

    // Network + transaction context (testnet during development).
    chain: { type: String, default: 'bnb-testnet' },
    transactionHash: { type: String, default: '' },

    // --- Measurement of the agent run ---------------------------------------
    // These three exist so agent-side timing is reconstructible from stored
    // facts rather than trusted. `createdAt` (from `timestamps`) is when the
    // hire was made, which can be minutes before anyone presses Run — so
    // `completedAt - createdAt` is queue time plus work, and only
    // `completedAt - startedAt` is the agent's actual execution time.
    /** When the runner claimed the job and work genuinely began. */
    startedAt: { type: Date, default: null },
    /**
     * JSON-RPC reads this run issued, counted at the point every request passes
     * through. The unit of work an agent does here is a chain read, so this is
     * the closest honest analogue to "how much looking up did it take" — the
     * figure a manual baseline is compared against.
     *
     * Known for failed runs too (the log survives the throw), so a failure
     * records the reads it managed before giving up. Null means the run has not
     * started; 0 means it failed before issuing any request.
     */
    rpcCallCount: { type: Number, default: null, min: 0 },
    completedAt: { type: Date, default: null },

    /**
     * Manual-vs-agent comparison — null until a human actually measures one.
     *
     * `default: null` is load-bearing: a sub-document default would have
     * Mongoose materialise an empty `advantage` object on every hire, which
     * reads downstream as "a measurement was taken and came back zero".
     * Nothing in the running application writes this field.
     */
    advantage: { type: AdvantageSchema, default: null },
  },
  { timestamps: true },
);

ExecutionSchema.index({ userAddress: 1, createdAt: -1 });
ExecutionSchema.index({ agentId: 1, createdAt: -1 });

export const Execution = mongoose.model('Execution', ExecutionSchema);
