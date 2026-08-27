# Extraction accuracy baseline

Measured 2026-08-27 with `scripts/eval-extraction.mjs`, 3 passes per fixture,
`claude-haiku-4-5-20251001`, `max_tokens: 256`, `temperature` unset (defaults to 1.0).

Reproduce:

```
node --env-file=.env.local scripts/eval-extraction.mjs --mode=current --passes=3
node --env-file=.env.local scripts/eval-extraction.mjs --mode=tiled   --passes=3
```

## `current` — what the app does today

Downscales so the long edge is 1500px, re-encodes JPEG q85. On a tall receipt this
crushes the width, which is the dimension the digits live in.

| Fixture | Items | Width kept | Sent | Merchant | Date | Total | Tax |
|---|---|---|---|---|---|---|---|
| receipt_hard_faded | 12 | 100% | 700x1200 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_hard_crumpled | 12 | 100% | 700x1200 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_hard_combo | 12 | 100% | 752x1230 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_verified | 15 | 74% | 515x1500 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_35items | 35 | 58% | 407x1500 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_45items | 45 | 47% | 330x1500 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_50items | 50 | 43% | 302x1500 | 3/3 | 3/3 | 3/3 | 3/3 |
| **receipt_verified_v2** | **60** | **37%** | **257x1500** | 3/3 | **0/3** | **2/3** | **0/3** |

**Overall: merchant 100%, date 88%, total 96%, tax 88%.**

Every failure is on the single fixture whose width falls to 37%. Everything at 43% and
above is perfect. The cliff is between 50 and 60 line items, exactly where the long-edge
downscale pushes horizontal resolution below the legibility floor for digits.

Raw output for the failing fixture (truth: date `2026-08-20`, total `10035.62`, tax `590.33`):

```
pass0  date 2025-08-20   total 10035.62   tax 550.23   confidence "high"
pass1  date 2025-08-20   total 910035.62  tax 550.23   confidence "high"
pass2  date 2025-08-20   total 10035.62   tax 590.23   confidence "high"
```

Three things worth noting:

1. **The date and tax errors are stable across all three passes.** `2026`→`2025` and
   `590.33`→`550.23` are deterministic misreads of a degraded image, not sampling noise.
   Setting `temperature: 0` would make these *consistent*, not *correct*.
2. **Only the leading `9` on `910035.62` is intermittent** — that one is sampling variance
   on top of an already-ambiguous glyph.
3. **`confidence` is `"high"` on every corrupted run.** The model's self-reported confidence
   does not detect this failure, which is why the arithmetic cross-check is needed instead.

## `tiled` — the proposed fix

Receipts with aspect ratio > 2.2 are sliced into overlapping horizontal bands, each kept at
native width, sent as consecutive image blocks in one request.

| Fixture | Items | Width kept | Sent | Merchant | Date | Total | Tax |
|---|---|---|---|---|---|---|---|
| receipt_hard_faded | 12 | 100% | 700x1200 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_hard_crumpled | 12 | 100% | 700x1200 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_hard_combo | 12 | 100% | 752x1230 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_verified | 15 | 100% | 2 x 700x~1020 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_35items | 35 | 100% | 2 x 700x~1290 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_45items | 45 | 100% | 3 x 700x~1060 | 3/3 | 3/3 | 3/3 | 3/3 |
| receipt_50items | 50 | 100% | 3 x 700x~1160 | 3/3 | 3/3 | 3/3 | 3/3 |
| **receipt_verified_v2** | **60** | **100%** | **3 x 700x~1360** | 3/3 | 3/3 | 3/3 | 3/3 |

**Overall: merchant 100%, date 100%, total 100%, tax 100%.**

The failing fixture returns `date 2026-08-20, total 10035.62, tax 590.33` on all three passes.

## Cost

Input tokens rise 2.37x (1,048 → 2,484 per call averaged over the set; only tall receipts
tile at all). `NOTES.md` puts current extraction at ~$0.0025/receipt, so this is roughly a
half-cent per long receipt.

## Caveats

- The harness resizes with `sharp`; the browser uses canvas `drawImage`. Resampling differs
  slightly, so absolute numbers may shift a little in the real client. The
  dimensions and JPEG quality — the variables that matter here — are matched.
- The eval calls Anthropic directly rather than going through `/api/extract`, which needs a
  Supabase session and would exhaust the 20/hour rate limit (one run is 24 calls). Model,
  token cap and prompt are parsed out of `route.ts` at runtime so the two cannot drift.
- All eight fixtures are the same synthetic Home Depot receipt template. They isolate
  receipt *length* well, and say nothing about real-world variety — the tip-line, card-slip,
  ambiguous-date and refund cases in the plan are still missing.
