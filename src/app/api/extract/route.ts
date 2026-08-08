import Anthropic, { APIConnectionTimeoutError, RateLimitError, APIError } from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORIES } from '@/lib/categories'
import { createSupabaseServerClient } from '@/lib/supabase-server'
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
  try {
    const contentLength = parseInt(req.headers.get('content-length') ?? '', 10)
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

    if (!isPaid) {
      const now = new Date()
      const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00`
      const { count } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart)
      if ((count ?? 0) >= FREE_MONTHLY_LIMIT) {
        return NextResponse.json(
          { error: `You have used all ${FREE_MONTHLY_LIMIT} free receipts this month. Upgrade to Pro for unlimited scans.` },
          { status: 403 }
        )
      }
    }

    const { data: allowed, error: rlError } = await supabase.rpc('check_rate_limit', {
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
