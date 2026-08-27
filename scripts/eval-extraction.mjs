#!/usr/bin/env node
/**
 * Receipt extraction accuracy harness.
 *
 * Scores the extraction pipeline against hand-verified fixtures and prints a
 * per-field accuracy table. Written for one question: does receipt *length*
 * degrade money accuracy, and does tiling fix it?
 *
 * Run:
 *   node --env-file=.env.local scripts/eval-extraction.mjs
 *   node --env-file=.env.local scripts/eval-extraction.mjs --mode=tiled --passes=3
 *
 * Modes decide how the image reaches the model:
 *   current  what the app does today — downscale so the LONG edge is 1500px,
 *            re-encode JPEG q85. On a tall receipt this crushes the width.
 *   native   the original PNG, untouched. Note Claude still downscales
 *            anything over ~1568px on the long edge, so this is not a fix,
 *            only a control.
 *   tiled    the proposed fix — a tall receipt is sliced into overlapping
 *            horizontal bands, each kept at native width.
 *
 * It does NOT go through /api/extract: that route needs a Supabase session and
 * meters against a 20/hour rate limit, and a single run here is 24 calls. It
 * instead reproduces the same request the route builds — and to stop the two
 * drifting apart, the model, token cap and prompt are parsed out of route.ts
 * at runtime rather than copied. If that parse fails, the run aborts.
 */
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
// Imported, not reimplemented: `tiled` must measure the geometry that actually
// ships. Node strips the type annotations at load time.
import { planTiles, JPEG_QUALITY as TILE_QUALITY } from '../src/lib/receipt-tiles.ts'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES = join(ROOT, 'test-fixtures/receipts')
const ROUTE = join(ROOT, 'src/app/api/extract/route.ts')

const arg = (n, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${n}=`))
  return m ? m.split('=')[1] : d
}
const MODE = arg('mode', 'current')
const PASSES = Number(arg('passes', 3))
const CONCURRENCY = Number(arg('concurrency', 4))
// `current` deliberately keeps the OLD constants: it is the baseline being
// compared against, so it must not follow the shipped module forward.
const MAX_PX = 1500          // the old resizeImage(file, 1500) long-edge cap
const JPEG_QUALITY = 85      // the old toDataURL('image/jpeg', 0.85)

/** Pull the live model, token cap and prompt out of the route so this can't drift. */
function readRouteConfig() {
  const src = readFileSync(ROUTE, 'utf8')
  const model = src.match(/model:\s*'([^']+)'/)?.[1]
  const maxTokens = Number(src.match(/max_tokens:\s*(\d+)/)?.[1])
  const temperature = src.match(/temperature:\s*([\d.]+)/)?.[1]
  let prompt = src.match(/const EXTRACTION_PROMPT = `([\s\S]*?)`\n/)?.[1]
  const preamble = src.match(/const tiledPreamble = [^`]*`([\s\S]*?)`\n/)?.[1]
  if (!model || !maxTokens || !prompt || !preamble) {
    throw new Error(
      'Could not parse model/max_tokens/prompt out of route.ts — its shape changed. ' +
      'Fix the regexes in readRouteConfig() rather than hardcoding, or the eval ' +
      'silently stops measuring what ships.'
    )
  }
  const categories = readFileSync(join(ROOT, 'src/lib/categories.ts'), 'utf8')
    .match(/\[([^\]]+)\]/)[1].split(',').map((s) => s.trim().replace(/'/g, ''))
  prompt = prompt.replace('${CATEGORIES.join(\', \')}', categories.join(', '))
  return { model, maxTokens, temperature, prompt, preamble }
}

/** Build the image block(s) exactly as the chosen mode would send them. */
async function buildImages(file, mode) {
  const path = join(FIXTURES, file)
  const { width, height } = await sharp(path).metadata()

  if (mode === 'native') {
    const b = await sharp(path).jpeg({ quality: JPEG_QUALITY }).toBuffer()
    return { blocks: [b], meta: { sent: `${width}x${height}`, widthKept: 1 } }
  }

  if (mode === 'tiled') {
    const tiles = planTiles(width, height)
    const blocks = []
    for (const t of tiles) {
      blocks.push(
        await sharp(path)
          .extract({ left: 0, top: t.srcTop, width, height: t.srcHeight })
          .resize(t.outWidth, t.outHeight)
          .jpeg({ quality: Math.round(TILE_QUALITY * 100) })
          .toBuffer(),
      )
    }
    const label = tiles.length === 1
      ? `${tiles[0].outWidth}x${tiles[0].outHeight}`
      : `${tiles.length} x ${tiles[0].outWidth}x~${tiles[0].outHeight}`
    return { blocks, meta: { sent: label, widthKept: tiles[0].outWidth / width } }
  }

  // `current`: the old long-edge scale, kept verbatim as the baseline.
  const scale = Math.min(1, MAX_PX / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const b = await sharp(path).resize(w, h).jpeg({ quality: JPEG_QUALITY }).toBuffer()
  return { blocks: [b], meta: { sent: `${w}x${h}`, widthKept: w / width } }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 })

async function extract(file, cfg, mode) {
  const { blocks, meta } = await buildImages(file, mode)
  const content = blocks.map((b) => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: b.toString('base64') },
  }))
  let prompt = cfg.prompt
  if (blocks.length > 1) {
    prompt = cfg.preamble.replace('${count}', String(blocks.length)).replace(/\\n/g, '\n') + prompt
  }
  content.push({ type: 'text', text: prompt })

  const req = { model: cfg.model, max_tokens: cfg.maxTokens, messages: [{ role: 'user', content }] }
  if (cfg.temperature !== undefined) req.temperature = Number(cfg.temperature)

  const msg = await anthropic.messages.create(req)
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''

  // Same parse the route does, including the unguarded regex fallback.
  let parsed, parseError = null
  try {
    parsed = JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) parseError = 'unparseable_response'
    else {
      try { parsed = JSON.parse(m[0]) } catch { parseError = 'fallback_parse_threw' }
    }
  }
  return { parsed, parseError, meta, usage: msg.usage }
}

const money = (a, b) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005
const str = (a, b) => a != null && b != null &&
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) }
  }))
  return out
}

const answers = JSON.parse(readFileSync(join(FIXTURES, 'answers.json'), 'utf8'))
const files = Object.keys(answers).filter((k) => !k.startsWith('_'))
const cfg = readRouteConfig()

console.log(`\nmode=${MODE}  passes=${PASSES}  model=${cfg.model}  max_tokens=${cfg.maxTokens}` +
            `  temperature=${cfg.temperature ?? 'UNSET (defaults to 1.0)'}\n`)

const jobs = []
for (const f of files) for (let p = 0; p < PASSES; p++) jobs.push({ f, p })

const raw = await pool(jobs, CONCURRENCY, async ({ f, p }) => {
  try { return { f, p, ...(await extract(f, cfg, MODE)) } }
  catch (e) { return { f, p, error: e.message?.slice(0, 120) } }
})

const FIELDS = ['merchant', 'date', 'total', 'tax']
const rows = []
const totals = Object.fromEntries(FIELDS.map((k) => [k, { ok: 0, n: 0 }]))

for (const f of files) {
  const runs = raw.filter((r) => r.f === f)
  const want = answers[f]
  const score = {}
  for (const k of FIELDS) {
    const ok = runs.filter((r) => {
      if (!r.parsed) return false
      return k === 'merchant' || k === 'date'
        ? str(r.parsed[k], want[k])
        : money(r.parsed[k], want[k])
    }).length
    score[k] = ok
    totals[k].ok += ok
    totals[k].n += runs.length
  }
  const seen = new Set(runs.map((r) => JSON.stringify(r.parsed ?? r.error ?? null)))
  rows.push({
    file: f,
    items: want.lineItems,
    widthKept: runs[0]?.meta ? Math.round(runs[0].meta.widthKept * 100) + '%' : '-',
    sent: runs[0]?.meta?.sent ?? '-',
    score,
    stable: seen.size === 1,
    gotTotals: [...new Set(runs.map((r) => r.parsed?.total ?? (r.parseError || r.error || 'null')))],
    errors: runs.filter((r) => r.parseError || r.error).length,
  })
}

rows.sort((a, b) => a.items - b.items)
const pad = (s, n) => String(s).padEnd(n)
console.log(pad('FIXTURE', 26) + pad('ITEMS', 6) + pad('WIDTH', 7) + pad('SENT', 14) +
            pad('MERCH', 6) + pad('DATE', 6) + pad('TOTAL', 6) + pad('TAX', 6) + pad('STABLE', 7) + 'TOTALS SEEN')
console.log('-'.repeat(118))
for (const r of rows) {
  console.log(
    pad(r.file.replace('.png', ''), 26) + pad(r.items, 6) + pad(r.widthKept, 7) + pad(r.sent, 14) +
    pad(`${r.score.merchant}/${PASSES}`, 6) + pad(`${r.score.date}/${PASSES}`, 6) +
    pad(`${r.score.total}/${PASSES}`, 6) + pad(`${r.score.tax}/${PASSES}`, 6) +
    pad(r.stable ? 'yes' : 'NO', 7) + r.gotTotals.join(', ').slice(0, 40)
  )
}
console.log('-'.repeat(118))
const pct = (o, n) => n ? Math.round((o / n) * 100) + '%' : '-'
console.log('OVERALL  ' + FIELDS.map((k) => `${k} ${pct(totals[k].ok, totals[k].n)}`).join('   '))
const unstable = rows.filter((r) => !r.stable).length
console.log(`STABILITY  ${files.length - unstable}/${files.length} fixtures identical across ${PASSES} passes`)
const inTok = raw.reduce((s, r) => s + (r.usage?.input_tokens ?? 0), 0)
console.log(`TOKENS  ${inTok} input across ${raw.length} calls\n`)

const outfile = join(ROOT, `eval-${MODE}.json`)
const { writeFileSync } = await import('node:fs')
writeFileSync(outfile, JSON.stringify({ mode: MODE, passes: PASSES, cfg, rows, totals, raw }, null, 2))
console.log(`detail -> ${outfile}\n`)
