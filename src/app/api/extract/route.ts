import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Missing imageBase64 or mediaType' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Extract the expense details from this receipt image and return ONLY a JSON object with these fields:
{
  "date": "YYYY-MM-DD",
  "merchant": "store or restaurant name",
  "amount": 0.00,
  "currency": "USD",
  "category": "Food | Travel | Shopping | Utilities | Other",
  "description": "brief description"
}
If a field cannot be determined, use null. Return only the JSON, no explanation.`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse expense from image' }, { status: 422 })
    }

    const expense = JSON.parse(jsonMatch[0])
    return NextResponse.json(expense)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
