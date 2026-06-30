import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { CATEGORIES } from '@/lib/categories'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('receipt') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Missing receipt file' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
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
      // Fallback: try to find a JSON object in the response
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        return NextResponse.json({ error: 'Model returned unparseable response', raw: text }, { status: 422 })
      }
      extracted = JSON.parse(match[0])
    }

    // Ensure category is from the fixed list
    if (extracted.category && !CATEGORIES.includes(extracted.category)) {
      extracted.category = 'Other'
    }

    return NextResponse.json(extracted)
  } catch (err) {
    console.error('[/api/extract]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
