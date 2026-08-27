import Anthropic, { APIConnectionTimeoutError, RateLimitError, APIError } from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORIES } from '@/lib/categories'
import { MAX_TILES, planTiles } from '@/lib/receipt-tiles'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { track, latencyBucket, sizeBucket } from '@/lib/analytics'
import sharp from 'sharp'
import heicConvert from 'heic-convert'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30_000,
  maxRetries: 1,
})

/**
 * Function timeout, in seconds.
 *
 * The Anthropic client above is configured with `timeout: 30_000` and the catch
 * block maps its timeout error to a 504 with a useful message. None of that can
 * run if the platform kills the function first — left unset this inherits the
 * deployment default, and if that default is under 30s the SDK timeout is
 * unreachable and the handling below is dead code.
 *
 * Tiling makes this matter more than it did: requests carry several images
 * instead of one, and the HEIC path now decodes and slices rather than doing a
 * single resize. 60 gives the 30s call room to finish or to fail the way the
 * error handling expects.
 */
export const maxDuration = 60

const HEIC_TYPES = ['image/heic', 'image/heif']
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', ...HEIC_TYPES]

/**
 * The extraction prompt.
 *
 * Module level so scripts/eval-extraction.mjs can read it out of this file at
 * runtime instead of keeping its own copy. If the two drift, the eval stops
 * measuring what ships — so the harness parses this exact declaration and
 * aborts if it cannot find it. Renaming or reshaping it means updating
 * readRouteConfig() there.
 */
const EXTRACTION_PROMPT = `You are a receipt parser. Extract data from this receipt and return STRICT JSON only — no prose, no markdown fences, no explanation.

Return exactly this shape:
{"merchant":"string","date":"YYYY-MM-DD","total":0.00,"tax":0.00,"category":"string","confidence":"high"}

Rules:
- Return JSON only. Nothing before or after the JSON object.
- If a field is not legible, use null for that field and set confidence to "low".
- Never guess a total or tax — null beats a wrong number.
- category must be exactly one of: ${CATEGORIES.join(', ')}. Never invent a category.
- date must be YYYY-MM-DD format or null.
- Refunds and returns are negative. If this is a return, refund or credit — REFUND, RETURN, CREDIT, or amounts already printed with a minus sign — then total and tax must both be negative. Never drop the minus sign.`

/**
 * Prepended when a receipt arrives as several tiles. Without it the model has
 * no reason to think three images are one document and may read them as three
 * separate receipts.
 */
const tiledPreamble = (count: number) =>
  `The ${count} images above are consecutive, slightly overlapping vertical slices of ONE receipt, ordered top to bottom. Read them together as a single document. Ignore any duplicated lines caused by the overlap.\n\n`

const RATE_LIMIT_PER_HOUR = 20
const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB
const FREE_MONTHLY_LIMIT = 10

export async function POST(req: NextRequest) {
  // Set once the monthly quota has been consumed, so the catch block knows
  // whether there is anything to give back. See the refund note there.
  let quotaConsumedBy: string | null = null

  // Analytics bookkeeping. Both are read by the catch block, which is the only
  // place that knows an extraction failed for an infrastructure reason, and
  // which runs after the `try` scope has gone.
  const startedAt = Date.now()
  let trackingUserId: string | null = null

  try {
    // Fail closed on a missing or unparseable Content-Length.
    //
    // This used to be `parseInt(header ?? '')` compared with `>`, which does
    // nothing at all when the header is absent: parseInt('') is NaN, and
    // `NaN > anything` is false, so a chunked request walked straight through
    // the one check that was supposed to bound it. The body was then read in
    // full — into memory — before its size was looked at.
    const rawContentLength = req.headers.get('content-length')
    const contentLength = Number(rawContentLength)
    if (!rawContentLength || !Number.isFinite(contentLength)) {
      return NextResponse.json({ error: 'Content-Length required.' }, { status: 411 })
    }
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large. Maximum 10 MB.' }, { status: 413 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const isPaid = sub && sub.plan !== 'free' && (sub.status === 'active' || sub.status === 'trialing')

    trackingUserId = user.id
    // Recorded on nearly every event below, because "how often does this happen"
    // is almost always the wrong question without it — free and paid accounts
    // fail, retry and hit limits in completely different proportions.
    const planProps = { plan: sub?.plan ?? 'free', paid: Boolean(isPaid) }

    // Metering runs on the service role, not the caller's session.
    //
    // PostgREST publishes every public function as /rest/v1/rpc/<name>, and
    // Supabase grants EXECUTE to `authenticated` by default. These functions are
    // `security definer` and take the user id as an argument, so called with the
    // caller's own session they are just an HTTP endpoint anyone can hit with
    // any id — which makes the quota unenforceable. `refund_extraction_quota` is
    // the sharp end: a loop against it zeroes your own counter and buys
    // unlimited extractions.
    //
    // EXECUTE has been revoked from anon and authenticated (see
    // db/migrations/2026-08-10-restrict-rpc-execute.sql). The service role is
    // exempt from that, and it is the only context where `p_user_id` is a value
    // this server decided rather than one a caller supplied.
    const admin = createSupabaseAdmin()

    // Burst brake, applied to everyone including paid accounts. Kept ahead of
    // reading the body so a flood costs as little as possible.
    const { data: allowed, error: rlError } = await admin.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_max_requests: RATE_LIMIT_PER_HOUR,
    })
    if (rlError) {
      console.error('[/api/extract] rate limit check failed', rlError)
      return NextResponse.json(
        { error: 'Could not verify rate limit. Please try again.' },
        { status: 503 }
      )
    }
    if (!allowed) {
      track('rate_limited', {
        userId: user.id,
        props: { ...planProps, limit_per_hour: RATE_LIMIT_PER_HOUR },
      })
      return NextResponse.json(
        { error: `Rate limit exceeded. Maximum ${RATE_LIMIT_PER_HOUR} extractions per hour.` },
        { status: 429 }
      )
    }

    const bodyText = await req.text()
    if (bodyText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large. Maximum 10 MB.' }, { status: 413 })
    }

    let parsed
    try { parsed = JSON.parse(bodyText) } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    // `images` is an array of tiles; `imageBase64` is the old single-image shape.
    // Both are accepted because a browser tab left open across a deploy will
    // still be running the previous client, and rejecting it would turn a
    // routine release into a failed scan for anyone mid-session.
    const { imageBase64, images, mediaType } = parsed
    const inputImages: unknown[] = Array.isArray(images)
      ? images
      : imageBase64 != null
        ? [imageBase64]
        : []

    if (inputImages.length === 0 || !mediaType) {
      return NextResponse.json({ error: 'Missing images or mediaType' }, { status: 400 })
    }
    if (!inputImages.every((i) => typeof i === 'string' && i.length > 0)) {
      return NextResponse.json({ error: 'images must be non-empty base64 strings' }, { status: 400 })
    }
    // Input tokens scale with pixel area, so an unbounded array is an unbounded
    // bill. The client never exceeds MAX_TILES; anything that does is not ours.
    if (inputImages.length > MAX_TILES) {
      return NextResponse.json(
        { error: `Too many image tiles. Maximum ${MAX_TILES}.` },
        { status: 400 },
      )
    }

    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: 'Unsupported media type' }, { status: 400 })
    }

    // Free-tier metering.
    //
    // This used to count rows in `expenses` for the current month, which meant
    // it was measuring the wrong thing entirely: Anthropic is paid for here,
    // and saving the result is the client's decision. Extract-and-never-save
    // was free and uncounted, so the only real ceiling on a free account was
    // the hourly rate limit — several hundred vision calls a day, on a signup
    // that costs nothing to create. (It was also wrong in the mundane
    // direction: soft-deleted receipts still counted against the allowance.)
    //
    // Now the metered event is the extraction itself. Deliberately placed here
    // — after the request has been proven well-formed, before any real work is
    // done — so a malformed request cannot burn someone's allowance and a
    // rejected one costs no CPU.
    if (!isPaid) {
      const { data: withinQuota, error: quotaError } = await admin.rpc('check_extraction_quota', {
        p_user_id: user.id,
        p_max_extractions: FREE_MONTHLY_LIMIT,
      })

      if (quotaError) {
        console.error('[/api/extract] quota check failed', quotaError)
        return NextResponse.json({ error: 'Could not verify your plan usage. Please try again.' }, { status: 503 })
      }

      // Consumed whether or not it was within the limit — the increment is the
      // check. Recorded so the catch block can hand it back if what follows
      // fails for a reason that is ours.
      quotaConsumedBy = user.id

      if (!withinQuota) {
        // The upgrade prompt the user is about to see. Counting it is the only
        // way to know whether the free tier converts or just annoys — and it
        // pairs with `checkout_started` to answer that directly.
        track('free_quota_exhausted', {
          userId: user.id,
          props: { ...planProps, monthly_limit: FREE_MONTHLY_LIMIT },
        })
        return NextResponse.json(
          { error: `You have used all ${FREE_MONTHLY_LIMIT} free scans this month. Upgrade to Pro for unlimited scans.` },
          { status: 403 }
        )
      }
    }

    // The upload itself: past validation, past both limits, about to cost money.
    // Everything that follows either succeeds or fails, so this is the
    // denominator for the funnel on /admin/analytics.
    track('receipt_uploaded', {
      userId: user.id,
      props: {
        ...planProps,
        media_type: mediaType,
        size: sizeBucket(contentLength),
        heic: HEIC_TYPES.includes(mediaType),
      },
    })

    let finalImages = inputImages as string[]
    let finalMediaType = mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    // HEIC/HEIF arrives whole: the browser cannot decode it into a canvas, so
    // it cannot tile it either. Convert with heic-convert (own decoder, no
    // libvips needed), then slice here with the same geometry the client uses —
    // this path used to `fit: 'inside'` at 1500px, which is exactly the
    // long-edge squash that corrupted digits on long receipts.
    if (HEIC_TYPES.includes(mediaType)) {
      const jpegBuffer = Buffer.from(
        await heicConvert({ buffer: Buffer.from(finalImages[0], 'base64'), format: 'JPEG', quality: 0.9 }),
      )
      const { width, height } = await sharp(jpegBuffer).metadata()
      if (!width || !height) {
        return NextResponse.json({ error: 'Could not read image dimensions.' }, { status: 400 })
      }
      finalImages = await Promise.all(
        planTiles(width, height).map(async (tile) =>
          (
            await sharp(jpegBuffer)
              .extract({ left: 0, top: tile.srcTop, width, height: tile.srcHeight })
              .resize(tile.outWidth, tile.outHeight)
              .jpeg({ quality: 92 })
              .toBuffer()
          ).toString('base64'),
        ),
      )
      finalMediaType = 'image/jpeg'
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      // Reading a receipt is transcription, not composition — there is no
      // upside to sampling. Left unset this defaults to 1.0, which showed up as
      // the same image returning a different total between runs: the 60-item
      // fixture gave 10035.62 twice and 910035.62 once, a leading digit
      // sampled out of an ambiguous glyph.
      //
      // Worth being clear about what this does not fix. On that same fixture
      // the date and tax were wrong *identically* on all three passes
      // (2026->2025, 590.33->550.23) — deterministic misreads of an image that
      // had been squashed, not sampling noise. Temperature only ever made those
      // consistent; the tiling in the previous commit is what made them right.
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            ...finalImages.map((data) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: finalMediaType, data },
            })),
            {
              type: 'text' as const,
              text:
                (finalImages.length > 1 ? tiledPreamble(finalImages.length) : '') +
                EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    let extracted
    try {
      extracted = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        // A model failure, not an infrastructure one, so it never reaches the
        // catch block — and it is the failure mode most worth watching, because
        // it moves when the prompt or the model changes.
        track('extraction_failed', {
          userId: user.id,
          props: { ...planProps, reason: 'unparseable_response', status: 422 },
        })
        return NextResponse.json({ error: 'Model returned unparseable response', raw: text }, { status: 422 })
      }
      extracted = JSON.parse(match[0])
    }

    const coercedCategory = Boolean(
      extracted.category && !CATEGORIES.includes(extracted.category),
    )
    if (coercedCategory) {
      extracted.category = 'Other'
    }

    track('extraction_succeeded', {
      userId: user.id,
      props: {
        ...planProps,
        latency: latencyBucket(Date.now() - startedAt),
        // The model's own confidence, and whether the fields that matter came
        // back at all. Together these are the quality signal — a "success" that
        // returns a null total is not much of one, and without this the
        // dashboard would call it a win.
        confidence: typeof extracted.confidence === 'string' ? extracted.confidence : 'unknown',
        category: typeof extracted.category === 'string' ? extracted.category : 'none',
        has_total: extracted.total !== null && extracted.total !== undefined,
        has_date: extracted.date !== null && extracted.date !== undefined,
        // True when the model invented a category and the server had to force it
        // to 'Other'. A rise here means the prompt's category list has drifted
        // from what receipts actually contain.
        category_coerced: coercedCategory,
      },
    })

    return NextResponse.json(extracted)
  } catch (err) {
    console.error('[/api/extract]', err)

    // Everything reaching this handler is an infrastructure failure — a
    // timeout, Anthropic being unavailable, a decode that blew up. None of it
    // is the user's doing, and on a ten-a-month allowance, silently keeping the
    // unit would make every transient blip cost someone a tenth of their plan.
    //
    // Note what does *not* refund: a legitimate over-quota response returns
    // 403 directly rather than throwing, so it never lands here. Best effort by
    // design — if the refund itself fails there is nothing useful left to do,
    // and failing the request twice helps nobody.
    // Three-valued for the event below: null = there was nothing to refund (a
    // paid account, or a throw before the quota was touched), true = the unit
    // went back, false = the refund was attempted and itself failed.
    let quotaRefunded: boolean | null = null
    if (quotaConsumedBy) {
      // A fresh admin client: the one above is scoped inside the try block, and
      // this path is reachable from a throw that happened before it existed.
      const { error: refundError } = await createSupabaseAdmin().rpc('refund_extraction_quota', {
        p_user_id: quotaConsumedBy,
      })
      if (refundError) console.error('[/api/extract] quota refund failed', refundError)
      quotaRefunded = !refundError
    }

    // Named buckets rather than the error message. Messages from an SDK carry
    // request ids and occasionally echo input back, which is exactly the kind of
    // thing that must not accumulate in a reporting table; these four are what
    // anyone would actually group by.
    //
    // `trackingUserId` is null when the throw happened before authentication —
    // a malformed body, or Supabase being unreachable. The event is still worth
    // recording; it simply has no actor.
    const reason =
      err instanceof APIConnectionTimeoutError ? 'anthropic_timeout'
      : err instanceof RateLimitError ? 'anthropic_rate_limit'
      : err instanceof APIError ? 'anthropic_api_error'
      : 'internal_error'

    track('extraction_failed', {
      userId: trackingUserId,
      props: {
        reason,
        latency: latencyBucket(Date.now() - startedAt),
        // The refund's *outcome*, not the attempt — false here is the signal
        // that matters, because a refund that stops working is invisible
        // otherwise: the request fails identically either way, and only the
        // free user's counter quietly drifts. Null means nothing was consumed.
        quota_refunded: quotaRefunded,
      },
    })

    if (err instanceof APIConnectionTimeoutError) {
      return NextResponse.json({ error: 'Request timed out. Please try again.' }, { status: 504 })
    }
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: 'Service is busy. Please wait a moment and try again.' }, { status: 503 })
    }
    if (err instanceof APIError) {
      return NextResponse.json({ error: 'Service temporarily unavailable. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
