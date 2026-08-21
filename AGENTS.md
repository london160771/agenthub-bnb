# AgentHub BNB Hackathon — AGENTS.md

## Purpose and authority

This file defines the working rules for the AgentHub BNB hackathon repository. Read it completely:

1. At the beginning of every new coding day or session.
2. Again immediately before starting every phase.
3. Again if this file, the product specification, or the user’s instructions change.

The product specification is the source of truth for what to build. The user’s explicit instructions and approval gates take precedence over convenience, speed, or assumptions.

## Phase-by-phase workflow

- Work on one phase at a time, in the order defined by the specification.
- Before coding a phase, state its goal, acceptance criteria, expected files or components, dependencies, required environment variables, and verification plan.
- Implement only the current phase. Do not quietly begin later phases, add unrelated features, or expand the scope.
- Keep the application runnable after each phase.
- At the end of every phase, stop completely. Do not start the next phase, make “small improvements,” or continue in the background until the user explicitly reviews the result and approves moving forward. Silence or a vague acknowledgment is not approval.

## Required end-of-phase handoff

Every phase must end with a clear handoff containing all of the following:

1. **What was built:** an exact summary of features, routes, components, APIs, database changes, contracts, scripts, and files changed.
2. **Verification:** tests, checks, build results, and any known limitations or unresolved issues.
3. **VS Code review reminder:** tell the user to open and inspect the relevant project files in VS Code, and name the most important files or folders to review.
4. **Run and preview:** launch the client/frontend and backend in separate terminals or processes when possible. Report the commands, ports, URLs, and any login or wallet steps. Preview the application and tell the user exactly what to test.
5. **Learning section:** explain the new concepts introduced in this phase in beginner-friendly language, including what each important file or flow does and why the design was chosen. For blockchain phases, explicitly explain BNB Chain, networks and chain IDs, RPCs, wallets and addresses, gas, contract addresses and ABIs, signing, transactions, confirmations, events, and ERC-8004 concepts as they arise. Distinguish verified facts from assumptions.
6. **Environment check:** inspect the configuration, `.env.example`, startup output, and the current phase requirements. List every missing variable or secret by exact name, explain where the user should obtain it and what it is used for, and tell the user when it has been added. Never expose secret values.
7. **Approval gate:** finish by stating that the phase is complete and that work is paused, waiting for the user to review, test, ask questions, and explicitly approve the next phase.

If a required environment variable, secret, account, API key, RPC URL, contract address, or other configuration is missing, stop at that point. Do not invent it, bypass it, hardcode it, use a credential substitute, silently disable the integration, or pretend the phase is complete. You may continue only with clearly isolated work that does not depend on the missing value, and must still stop before the next phase.

## Blockchain and transaction safety

- Develop and test on the intended BNB testnet first. Mainnet and real funds are prohibited unless the user gives explicit, informed approval for that specific action.
- Default all transaction flows to simulation, dry-run, mocked signing, or testnet behavior where appropriate.
- Never send, sign, or broadcast a real transaction without clearly showing the network, chain ID, contract, recipient, amount, gas implications, and expected effect and receiving explicit user confirmation.
- Never request, print, store in source code, commit, or expose private keys, seed phrases, wallet secrets, signed payloads, API tokens, or RPC credentials. Do not log them or include them in screenshots, error reports, or phase summaries.
- Verify BNB Chain and ERC-8004 details against current official documentation before implementing them. Do not guess chain IDs, RPC endpoints, contract addresses, ABI methods, event names, or standards behavior.
- Do not claim blockchain integration is working until the relevant testnet flow has been verified end to end. Clearly label mocked, local, partially wired, and verified behavior.
- Add or confirm appropriate safeguards against wrong-network use, accidental mainnet use, unintended recipients, duplicate submissions, and unbounded amounts.

## Configuration and repository safety

- Keep secrets in ignored local environment files or the approved secret manager. Never commit `.env` or secret-bearing files; maintain a safe `.env.example` containing names and non-secret examples only.
- Do not replace missing credentials with guessed values or a different provider without telling the user and receiving approval.
- Do not weaken authentication, authorization, validation, transaction checks, or security controls just to make a phase pass.
- Preserve existing user changes and inspect the repository before editing. Keep changes focused and reversible.
- Update documentation and examples when a phase changes setup, commands, environment variables, APIs, or user-visible behavior.

## Communication standard

Explain decisions in plain language and teach while building. If blocked, identify the exact blocker, the safest next action, and what the user must provide. Never hide a blocker in a long progress message. The required stop-and-review gate applies even when the implementation appears straightforward.
