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

## Attribution — which change did the work

Both changes were measured independently, 3 passes each, so the gain is not
attributed to the wrong one.

| Geometry | `temperature` | Date | Total | Tax | Stable across 3 passes |
|---|---|---|---|---|---|
| long-edge (old) | unset (1.0) | 88% | 96% | 88% | 2/8 |
| long-edge (old) | **0** | 88% | **100%** | 88% | 7/8 |
| **tiled** | unset (1.0) | **100%** | **100%** | **100%** | 2/8 |
| **tiled** | **0** | **100%** | **100%** | **100%** | **8/8** |

Read the second row carefully, because it is the trap. Setting `temperature: 0`
without tiling moves total 96% -> 100% and stability 2/8 -> 7/8. It looks like a
fix. It is not: date and tax stay at 88%, and the failing fixture goes from
*intermittently* wrong to *reliably* wrong —

```
old geometry, temperature 0, all three passes identical:
  date 2025-08-20   total 10035.62   tax 590.23   confidence "high"
  truth: date 2026-08-20, total 10035.62, tax 590.33
```

`2026`->`2025` and `590.33`->`590.23` are misreads of a squashed image. Sampling
never caused them, so removing sampling never fixed them — it only stopped them
moving. Shipped alone, this change would have improved two headline numbers and
left the money wrong, with the model still reporting `confidence: "high"`.

Tiling is what makes them correct. `temperature: 0` is worth keeping — it removes
the intermittent leading digit and makes the eval reproducible — but it is the
second-order change, and the commits are split so the record shows that.

## Cost

Input tokens rise 2.33x (1,048 → 2,484 per call averaged over the set; only tall receipts
tile at all). `NOTES.md` puts current extraction at ~$0.0025/receipt, so this is roughly a
half-cent per long receipt.

## Edge-case fixtures (added 2026-08-27)

The original eight isolate receipt *length* and nothing else — one template, one
unambiguous date, no tips, no refunds, `TOTAL` always equal to `VISA TENDERED`.
Five generated fixtures cover the cases the prompt rules are actually aimed at.
Scored against the post-tiling code, 3 passes:

| Fixture | Tests | Merchant | Date | Total | Tax |
|---|---|---|---|---|---|
| `receipt_card_slip` | `AMOUNT` vs `TOTAL`, no tax line | 3/3 | 3/3 | 3/3 | 3/3 |
| `receipt_tip_line` | total = subtotal + tax + tip | 3/3 | 3/3 | 3/3 | 3/3 |
| `receipt_ambiguous_date` | `03/04/2026` resolved by US address | 3/3 | 3/3 | 3/3 | 3/3 |
| `receipt_inconsistent` | printed arithmetic deliberately wrong | 3/3 | 3/3 | 3/3 | 3/3 |
| **`receipt_refund`** | **negative total** | 3/3 | 3/3 | **0/3** | **0/3** |

**Overall across all 13: merchant 100%, date 100%, total 92%, tax 92%.**

### The refund bug — found here, fixed

As found:

```
truth   total -48.67   tax -2.87
pass0   total  48.67   tax  2.87   confidence "high"
pass1   total  48.67   tax  2.87   confidence "high"
pass2   total  48.67   tax  2.87   confidence "high"
```

The receipt reads `REFUND TOTAL  -$48.67` and `CREDIT TO VISA  -$48.67`; the sign
was dropped on every pass. A credit was recorded as a charge, so one refund put the
ledger out by twice its value, with `confidence` `"high"` throughout. Stable across
passes, so a prompt gap rather than sampling.

Fixed by one prompt rule naming refunds explicitly, plus removing a client-side
`total < 0` rejection that would otherwise have made a correctly-read refund
permanently uneditable. Now `-48.67 / -2.87` on all three passes, with no other
fixture changing sign.

**All 13 fixtures now score 100% on merchant, date, total and tax, 13/13 stable.**

### What the other four settle

Three of the prompt rules planned for §1.5 turn out to be **already handled**: the
card slip picks `TOTAL 22.00` over `AMOUNT 18.40` and correctly returns `tax: null`;
the restaurant receipt picks `104.66` over the `82.50` subtotal; the ambiguous date
resolves to March 4 from the US address. Writing rules for those would be
belt-and-braces against a failure that does not occur. Worth keeping the fixtures as
regression cover, not worth prompt text.

`receipt_inconsistent` reads `227.50` faithfully — correct behaviour — and is the
case that justifies the arithmetic check: `120.00 + 7.50 = 127.50`, so
`subtotal + tax != total`, and nothing in the current output marks it. `confidence`
is `"high"`.

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
