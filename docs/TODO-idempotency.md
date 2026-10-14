# TODO: `client_event_id` retry-stability

**Status: design only — not implemented.** This document exists so the next
session (or anyone picking this up) doesn't have to re-derive the problem or
re-research n8n's retry semantics from scratch. Do not implement either
option here without re-confirming the scope with the user first.

## The problem

`nodes/Disclarion/Disclarion.node.ts` generates a fresh `client_event_id:
randomUUID()` on every `execute()` call, for every item (~line 274). This
used to be harmless: before disclarion-app's 2026-10-13 post-trial/post-
cancellation grace decision, a `402` from `/v1/logs` meant *nothing* was
ever inserted, so a retry with a brand-new `client_event_id` just inserted
once — a no-op duplicate of a no-op. Now, during a 14-day grace window
(expired trial, or a canceled/unpaid subscription — see disclarion-app's
`CLAUDE.md` idempotency-key rule and `account_state.py`), a `402` means the
row **was already inserted**. A retry that generates a new
`client_event_id` bypasses the backend's `(project_id, client_event_id)`
unique index entirely and creates a second, genuinely duplicate
`interaction_logs` row.

The Python SDK doesn't have this problem: its background worker retries
reuse the *same* dict (same `client_event_id`) on every attempt (see
disclarion-app's `docs/sdk-architecture.md`). This node has no equivalent
retry logic of its own — but n8n's own "Retry On Fail" node setting
re-executes the node from scratch, and that's exactly where this breaks.

**The naive first-instinct fix is also wrong**: a key like
`` `${executionId}-${itemIndex}` `` collides in two real situations:

1. **Loops.** `itemIndex` (`i` in the `for` loop) resets to `0` on every
   separate call to `execute()`. If this node is wrapped in a loop in the
   workflow graph (e.g. Split In Batches feeding it one batch at a time),
   `execute()` runs several times *within the same execution* — each run
   starts its own item-indexing from `0`. Two genuinely different
   interactions (batch 1's item 0, batch 2's item 0) would collide on the
   same key, and the backend's unique index would make the *second* one
   look like a retry of the first — `routers/logs.py` treats a `409` on
   that index as an idempotent success and returns the *first* row's data,
   silently dropping the second interaction's log.
2. **Two Disclarion nodes in one workflow.** Nothing stops a workflow from
   having two separate Disclarion nodes (e.g. one after an OpenAI call,
   another after an Anthropic call elsewhere in the same workflow). Both
   run inside the same `executionId`, and both independently index their
   own items from `0` — `node A`'s item 0 and `node B`'s item 0 would
   collide on `` `${executionId}-${itemIndex}` ``, again silently dropping
   one of the two real events through the same unique-index mechanism.

## Option A: richer key — `executionId` + `nodeId` + `runIndex` + `itemIndex`

Fixes both collisions above:

- `this.getNode().id` (stable per node instance in the workflow) separates
  two Disclarion nodes in the same workflow.
- `runIndex` separates genuinely different runs of the *same* node within
  one execution (e.g. each Split-In-Batches iteration), so the loop
  collision in point 1 above goes away too.

**This does NOT fix the original retry-duplication problem it was proposed
for.** I checked whether "Retry On Fail" changes the run index, since the
whole point of this key is to survive a retry unchanged: it does. n8n's own
documented pattern for per-retry exponential backoff is a "Wait Between
Tries" expression like `{{ Math.pow(2, $runIndex) * 1000 }}` to get 1s, 2s,
4s, 8s delays — which only produces different delays per attempt *because*
`$runIndex` increments on every retry attempt of the same node. (Checked via
n8n's public docs/community forum, since this repo has no local n8n-core
source to read the retry engine directly — I don't have a running n8n
instance to verify empirically either, so this is documentation/community-
sourced, not something I watched happen. Re-verify against a real
"Retry On Fail" run before relying on it for anything load-bearing.) So a
key that includes `runIndex` gets a *different* value on each retry
attempt — exactly the same failure mode as today's `randomUUID()`, just
triggered one layer up. Option A is real and worth doing regardless (it's
the correct fix for the loop/multi-node collisions, which are a distinct
bug from the retry-duplication one), but on its own it does not close the
grace-window duplicate-row gap that motivated this investigation.

## Option B: don't throw on a `402` — treat `logged: true` as success with a warning output

Matches the Python SDK's own 0.9.0 decision (see disclarion-app's
`CHANGELOG.md`/`docs/decisions-log.md`): `track()` doesn't raise on a `402`
by default, because an account being briefly non-logging (trial/grace
just ended) is a normal part of the account lifecycle, not a setup
mistake — an uncaught exception from every call during that window is
worse than the gap it prevents.

Today, `Disclarion.node.ts`'s `execute()` throws `NodeApiError` for *any*
non-2xx response (see the per-item `try`/`catch` around line 309, and the
`isApiError` flag) — identical treatment for a `402` and a real failure
(5xx, network error). That's what makes "Retry On Fail" fire at all for
this case: n8n only retries a node that threw.

The fix: read the response body's `logged`/`error`/`grace_ends_at` fields
(same shape `routers/logs.py`'s `_payment_required_detail` already returns
— see disclarion-app's `routers/logs.py`) and, specifically when
`logged: true`, push a normal output item instead of throwing — e.g.
`{ json: { ...response.data, warning: 'payment_required', payment_required_reason: detail.error, grace_ends_at: detail.grace_ends_at }, pairedItem: { item: i } }`
(possibly alongside `this.addExecutionHints(...)` for a visible-but-
non-blocking banner on the node). A `402` with `logged: false` (grace
itself has ended, nothing was persisted) is a different situation — closer
to today's behavior — and should likely still surface as an error/warning
distinct from the `logged: true` case, though exactly how is itself a
design decision for whoever implements this, not decided here.

Because the node never throws for the `logged: true` case, n8n's "Retry On
Fail" never engages for it at all — this removes the retry trigger
structurally, rather than trying to make a key survive a retry mechanism
that (per Option A's finding) doesn't keep it stable.

## Recommendation

**Option B.** It's the one that actually closes the duplicate-row gap this
investigation started from, it mirrors already-shipped, already-reasoned-
through Python SDK behavior (no new design judgment call needed about what
"should" happen on a `402` — that call was already made), and it sidesteps
the runIndex instability entirely instead of fighting it.

Option A is still worth doing *separately* — the loop/multi-node key
collision it fixes is a real, distinct bug from the retry-duplication one,
and is NOT addressed by Option B at all (Option B only changes what
happens after a `402`; the collision in a successful-response loop/multi-
node scenario is unaffected). The two are complementary, not alternatives:
ideally both ship, but if only one can ship first, Option B is the one
that matters for the grace-window duplicate-row risk specifically.

## Open questions for whoever implements this

- Exact node-settings precedence: if a user has their OWN "Retry On Fail"
  enabled on this node for *other* reasons (genuine network blips), does
  Option B's "never throw on `logged: true`" change anything about that —
  it shouldn't, since a real network/5xx error still throws exactly as
  today; only the `402`+`logged: true` path changes.
- What exactly happens today, in production n8n, to `runIndex` across a
  Split-In-Batches-wrapped loop around this node, verified empirically
  (not just from docs) — this doc's Option A section is accurate as far as
  publicly documented n8n behavior goes, but "re-verify against a real run"
  in that section is a real caveat, not boilerplate.
- Whether `logged: false` (grace truly ended, nothing persisted) should
  also avoid throwing, for workflow-ergonomics parity with Option B's
  `logged: true` case — left open deliberately, see Option B above.
