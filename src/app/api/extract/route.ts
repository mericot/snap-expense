import Anthropic, { APIConnectionTimeoutError, RateLimitError, APIError } from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORIES } from '@/lib/categories'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import sharp from 'sharp'
import heicConvert from 'heic-convert'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30_000,
  maxRetries: 1,
})

const HEIC_TYPES = ['image/heic', 'image/heif']
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', ...HEIC_TYPES]

const RATE_LIMIT_PER_HOUR = 20
const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB
const FREE_MONTHLY_LIMIT = 10

export async function POST(req: NextRequest) {
  // Set once the monthly quota has been consumed, so the catch block knows
  // whether there is anything to give back. See the refund note there.
  let quotaConsumedBy: string | null = null

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
    if (rlError || !allowed) {
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
    const { imageBase64, mediaType } = parsed

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Missing imageBase64 or mediaType' }, { status: 400 })
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
        return NextResponse.json(
          { error: `You have used all ${FREE_MONTHLY_LIMIT} free scans this month. Upgrade to Pro for unlimited scans.` },
          { status: 403 }
        )
      }
    }

    let finalBase64 = imageBase64
    let finalMediaType = mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    // Convert HEIC/HEIF → JPEG using heic-convert (has its own decoder, no libvips needed)
    // Then resize with sharp
    if (HEIC_TYPES.includes(mediaType)) {
      const inputBuffer = Buffer.from(imageBase64, 'base64')
      const jpegBuffer = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.9 })
      const resized = await sharp(Buffer.from(jpegBuffer))
        .resize({ width: 1500, height: 1500, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer()
      finalBase64 = resized.toString('base64')
      finalMediaType = 'image/jpeg'
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: finalMediaType, data: finalBase64 },
            },
            {
              type: 'text',
              text: `You are a receipt parser. Extract data from this receipt and return STRICT JSON only — no prose, no markdown fences, no explanation.

Return exactly this shape:
{"merchant":"string","date":"YYYY-MM-DD","total":0.00,"tax":0.00,"category":"string","confidence":"high"}

Rules:
- Return JSON only. Nothing before or after the JSON object.
- If a field is not legible, use null for that field and set confidence to "low".
- Never guess a total or tax — null beats a wrong number.
- category must be exactly one of: ${CATEGORIES.join(', ')}. Never invent a category.
- date must be YYYY-MM-DD format or null.`,
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
        return NextResponse.json({ error: 'Model returned unparseable response', raw: text }, { status: 422 })
      }
      extracted = JSON.parse(match[0])
    }

    if (extracted.category && !CATEGORIES.includes(extracted.category)) {
      extracted.category = 'Other'
    }

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
    if (quotaConsumedBy) {
      // A fresh admin client: the one above is scoped inside the try block, and
      // this path is reachable from a throw that happened before it existed.
      const { error: refundError } = await createSupabaseAdmin().rpc('refund_extraction_quota', {
        p_user_id: quotaConsumedBy,
      })
      if (refundError) console.error('[/api/extract] quota refund failed', refundError)
    }

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
