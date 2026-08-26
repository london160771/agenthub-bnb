# Agent Advantage — measurement definitions and experiment protocol

**Status: no measurements have been taken.** Every manual/comparison field in the
database is `null`, and nothing in the running application writes one. This
document defines how they will be filled in. It is a protocol, not a result.

> **The rule this whole document exists to protect:** a number is either measured
> or absent. There are no defaults, no estimates, no "typical" values and no
> illustrative figures anywhere in AgentHub's Agent Advantage data. A fabricated
> benchmark inside a submission about verifiable on-chain data would discredit
> the parts that are real.

---

## 1. What the application measures on its own

These are captured automatically on every execution, without human involvement.
All are real.

| Field | Meaning | How it is obtained |
|---|---|---|
| `createdAt` | When the hire was made | Mongoose `timestamps` |
| `startedAt` | When the run genuinely began | Written in the same atomic update that flips `pending → running` ([executionService.js](backend/services/executionService.js), `claimForRun`) |
| `completedAt` | When the run finished (success or failure) | Set on both paths in [executionRunner.js](backend/services/executionRunner.js) |
| `durationMs` | Backend execution time | `completedAt − startedAt`, measured with a clock |
| `rpcCallCount` | JSON-RPC requests the run issued | Counted at the single point every request passes through ([blockchainService.js](backend/services/blockchainService.js), `withRpcLog`) |
| `output.reads[]` | Which methods, against which addresses | Same log |
| `output.provenance` | Chain id, RPC host, block number, read time | `buildProvenance()` |
| `cost` / `currency` | Fee recorded against the hire | Read server-side from the agent document |
| `task` / `input` | What was asked, and with what configuration | Submitted at hire time |
| `output.fields[]` | The result, each value tagged `chain`/`derived`/`input`/`simulated`/`unavailable` | Per-executor |

### Why `startedAt` had to be added

Before this change the only stored timestamps were `createdAt` and
`completedAt`, and the run's start time lived in a local variable that was
discarded. A real execution from testing showed the consequence:
`completedAt − createdAt` was **31.6 s** while the measured `durationMs` was
**4.4 s** — the difference being how long the hire sat waiting for someone to
press Run. Anyone reconstructing timing from the stored record would have
overstated the agent's execution time by 7×. The two figures now agree:
`startedAt + durationMs == completedAt`.

### What `cost` does and does not mean

`cost` is the fee the agent **lists**, recorded against the hire. No payment is
taken: this build sends no transaction, requests no signature, and leaves
`transactionHash` empty. Chain reads are free and need no signature, so the true
on-chain cost of a run is zero. Any cost comparison must state this explicitly —
"the agent's listed price" is a price, not a charge.

---

## 2. Definition: what one "step" is

The user requirement was to define this before collecting it. Here is the
definition, and it applies **identically** to `manualSteps` and `agentSteps`.

### The counting rule

> A **step** is one discrete action a person must perform to move the task
> forward, where an action is any of the following and cannot be omitted without
> changing the required output:
>
> 1. Opening or switching to a different application, site, or page.
> 2. Typing or pasting a distinct value.
> 3. Copying a value out of one surface in order to use it in another.
> 4. Performing a calculation or judgement by hand.
> 5. Writing a result into the deliverable.

**Not counted:** scrolling, reading, waiting for a page or a request, retries
caused by the operator's own typo, and anything done out of curiosity beyond the
task's defined output.

Both figures count **human actions**. On the manual side that is the person doing
the research; on the agent side it is the person operating the agent (open
AgentHub → choose the agent → paste the address → set the threshold → confirm the
hire → press Run → read the result). Because both sides count the same kind of
thing under the same rule, the two numbers are comparable.

The exact rule text used must be copied into `advantage.stepDefinition` on every
record. The schema refuses a step count without it, because two people counting
"steps" differently produce numbers that cannot be compared.

### What `agentSteps` is explicitly NOT

It is **not** the six internal timeline steps (`hired`, `received`, `wallet`,
`query`, `analyse`, `report`). Those were considered and rejected:

- They are constant at 6 for every task, so they carry no information about task
  difficulty — a one-address lookup and a ten-address audit would both score 6.
- They measure this application's pipeline, not work a person would otherwise
  have to do. Nobody performs an "analyse" step by hand as a unit.
- Presenting them alongside `manualSteps` would imply parity ("6 agent steps vs
  6 manual steps") while each manual step costs minutes and each pipeline step
  costs milliseconds. That comparison would be actively misleading.

Nothing in the codebase derives `agentSteps`. It is counted by a human, from a
recording, using the rule above.

---

## 3. Definition: time

Three separate numbers, because conflating them is the easiest way to produce a
flattering and false result.

| Field | What it measures | Who records it |
|---|---|---|
| `durationMs` | Backend execution only — claim to completion | Automatic |
| `agentOperatorDurationMs` | Human wall-clock **using** the agent: from opening the hire form to having the answer | Stopwatch, from the recording |
| `manualDurationMs` | Human wall-clock doing the same task by hand | Stopwatch, from the recording |

**The headline comparison is `agentOperatorDurationMs` vs `manualDurationMs`.**
`durationMs` is a sub-component of the first and is reported separately so a
reader can see where the time went. Comparing `durationMs` (4.4 s) against a
human's wall-clock (14 min) would omit the part of the agent path a human
actually performs, and is not a claim this project will make.

Timing starts when the operator begins the task with the tools closed, and stops
when the required output exists in a form a third party could read.

---

## 4. Definition: cost, and its basis

| Field | Meaning |
|---|---|
| `cost` / `currency` | The agent's listed fee. Not charged — see §1. |
| `manualCost` / `manualCurrency` | Money attributable to the manual run |
| `manualCostBasis` | **Required** whenever `manualCost` is present: the rate, the source of that rate, and what it includes |

A manual cost is `manualDurationMs` × a rate the operator **declares and
sources**, plus any paid data source used. The schema will not accept a cost
without its basis, because a cost without a stated rate is unfalsifiable.

Acceptable basis: *"0.42 h at £45/h, the operator's own contract rate."*
Not acceptable: *"typical analyst time"*, or any rate not attributable to a named
source. If no defensible rate exists, leave `manualCost` null and report time
only — an absent cost is honest; an invented one is not.

Gas: zero on both sides. Reads cost nothing, and nothing is broadcast.

---

## 5. Definition: output quality

Four dimensions, each scored **0–5**, composite **0–20**, recorded in
`agentQuality` and `manualQuality`. `qualityRubric` must name this rubric and its
version (`agenthub-v1`); the schema refuses a score without it.

| # | Dimension | 0 | 5 |
|---|---|---|---|
| 1 | **Correctness** | Claims are wrong | Every factual claim independently verifiable and correct |
| 2 | **Completeness** | Does not answer the task | Answers everything asked, nothing missing |
| 3 | **Provenance** | Figures have no stated source | Every figure traceable to a named source (block, contract, page) |
| 4 | **Actionability** | Unusable without redoing the work | A competent user could act on it directly |

Scoring rules:

- Both outputs are scored against the **same** rubric in the same sitting.
- Where practical, score blind: strip anything identifying which side produced
  the output.
- Every score carries a one-line written justification in the evidence file. A
  bare number is not a score.
- A value marked `simulated` in the agent's output scores **0 on Provenance**
  for that claim. This is why two categories are currently ineligible (§7).
- The scorer is named in `qualityScoredBy` if it is not the person who ran the
  experiment.

---

## 6. Provenance of the measurement itself

Four fields are **required** by the schema whenever an `advantage` object exists
at all. A number without them is an anecdote.

| Field | Meaning |
|---|---|
| `measuredBy` | The person who ran both halves |
| `measuredAt` | When the experiment was conducted |
| `manualMethod` | Exactly what the human did: tools opened, pages visited, in order |
| `evidenceRef` | Where the raw evidence lives |

Evidence goes in `evidence/agent-advantage/<experiment-id>/` and must contain: a
screen recording of both halves, the operator's manual output verbatim, the
agent's `executionId`, the block number each side read, and the per-dimension
quality justifications.

**How records get written:** by a deliberate one-off maintenance script, run by a
human after the experiment, targeting a specific `executionId`. That script does
not exist yet and will be written when the experiments are run. No request path,
executor, or runner may ever write an `advantage` field.

---

## 7. Which categories are eligible

An experiment is only evidence if the agent's output is genuinely real. A
category whose core value is `simulated` cannot serve as Agent Advantage
evidence — the comparison would measure a model against reality.

| Category | Eligible now | Why |
|---|---|---|
| `research` | **Yes** | `eth_getCode` + `eth_getBalance`; the headline finding is a chain fact |
| `monitoring` | **Yes** | Balance, nonce and code all read live |
| `portfolio` | **Yes** | Native balance and nonce real; token positions honestly marked unavailable |
| `trading` | **Yes** | Token-contract check, wallet balance and live gas price all real; routing marked unavailable |
| `health-factor` | **No** | Health factor, collateral and borrow are a deterministic model — no verified protocol address on file |
| `yield` | **No** | Pool ranking is `unavailable`; the result cannot answer the question the category names |

---

## 8. The three experiments

Not yet run. Nothing below is a result. Each satisfies the requirement to run the
same task both ways, measure both times, record costs with a basis, preserve both
actual outputs, score quality against §5, and record the evidence.

Experiment 1 satisfies the requirement that at least one task be
security/trading/equities-related; Experiment 2 adds a trading task.

### Experiment 1 — Contract due diligence (security)

- **Agent:** `token-due-diligence` (`research`)
- **Task:** For a given BNB testnet address, establish whether a contract is
  deployed there, its bytecode size, its native balance, and the block at which
  this was true.
- **Manual method:** open testnet.bscscan.com, search the address, read the
  contract tab, read the balance, note the current block; write the four facts
  down.
- **Why this one:** the agent's headline finding — "there is / is not code at
  this address" — is a definitive chain fact from `eth_getCode`. It is the
  cleanest real comparison available, and it is a genuine security check: an
  address supplied as a token that holds no bytecode cannot be a token.

### Experiment 2 — Pre-trade affordability check (trading)

- **Agent:** `dca-scheduler` (`trading`)
- **Task:** For a given wallet and a given trade size, determine whether the
  wallet can fund the trade plus gas at the current gas price, and state the
  gas assumption used.
- **Manual method:** read the wallet balance on BscScan, read the current gas
  price, multiply by **150,000** gas units, add the trade size, compare.
- **Comparability constraint:** the manual operator **must** use the same
  150,000-unit assumption the agent uses, recorded in `note`. A different
  assumption changes the answer, and the experiment would be measuring the
  assumption rather than the tool.

### Experiment 3 — Wallet baseline (portfolio)

- **Agent:** `portfolio-xray` (`portfolio`)
- **Task:** For a given wallet, report the native balance to 6 decimal places,
  the number of transactions sent, and how many 21,000-gas transfers the balance
  could fund at the current gas price.
- **Manual method:** BscScan for balance and nonce, gas tracker for price,
  calculator for the division.
- **Note:** the agent honestly reports token positions as unavailable. The manual
  operator must be given the same scope — native only — or the outputs are not
  comparable.

### Protocol for all three

1. **Manual half first**, cold, tools closed, stopwatch running. Recording on.
   Record the block number read.
2. **Agent half second.** Stopwatch from opening the hire form. Recording on.
   Record `executionId`.
3. **Handle the block delta.** The chain moves between the two halves, so the
   outputs will not be byte-identical. Values count as agreeing if each is
   correct at the block its own side read. The block delta is recorded in `note`;
   any value that changed between blocks is called out rather than smoothed over.
4. **Score both outputs** against §5, blind where practical, with written
   justifications.
5. **Write the record** via the maintenance script, filling every §6 field.
6. **Report honestly.** If the agent loses on a dimension, that is the result.

### Known methodological limits, to be stated in the report

- **n = 3.** Three tasks on one operator is an illustration of method, not a
  statistically meaningful sample. It will be described as such.
- **Operator familiarity.** The same person runs both halves and knows what the
  agent will output, which biases the manual half. Mitigation: choose addresses
  the operator has not inspected before; state the bias.
- **Ordering effect.** Manual runs first, so the operator learns the task and the
  agent half benefits. This biases *against* the agent, which is the safer
  direction, and will be stated.
- **Scope matching.** The agent's honest "unavailable" fields must be excluded
  from the manual scope too, or the manual operator is doing more work.
- **Block delta.** See step 3.
