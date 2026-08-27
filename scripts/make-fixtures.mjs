#!/usr/bin/env node
/**
 * Generates the receipt fixtures that the eval set was missing.
 *
 * The original eight fixtures isolate receipt *length* well and nothing else:
 * they are one Home Depot template, one unambiguous date, no tips, no refunds,
 * and `TOTAL` always equals `VISA TENDERED`. That is enough to find and fix the
 * long-receipt digit corruption, and useless for the prompt rules that follow —
 * total-vs-subtotal-vs-tendered, date ambiguity, refunds — because the set
 * contains no case where those rules change the answer.
 *
 * These are rendered rather than photographed so the answer key is exact: the
 * numbers are chosen first and drawn second, so ground truth is known by
 * construction rather than by squinting at an image.
 *
 * Run: node scripts/make-fixtures.mjs
 */
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-fixtures', 'receipts')
const W = 700
const PAD = 32
const MONO = 'Menlo, DejaVu Sans Mono, Courier New, monospace'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const usd = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2)

function render(spec) {
  const el = []
  let y = 0
  const L = (x, t, o = {}) =>
    el.push(
      `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${o.size ?? 16}"` +
        ` fill="${o.fill ?? '#111'}" font-weight="${o.weight ?? 'normal'}"` +
        `${o.anchor ? ` text-anchor="${o.anchor}"` : ''}` +
        `${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}>${esc(t)}</text>`,
    )
  const rule = (w = 1) => {
    el.push(`<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="#111" stroke-width="${w}"/>`)
  }

  y += 52
  L(W / 2, spec.merchant, { size: 27, weight: 'bold', anchor: 'middle', spacing: 2 })
  for (const line of spec.address) { y += 25; L(W / 2, line, { size: 14, anchor: 'middle' }) }
  y += 28; rule()
  y += 26
  L(PAD, spec.meta.left, { size: 14 })
  L(W - PAD, spec.meta.right, { size: 14, anchor: 'end' })
  y += 14; rule()

  for (const it of spec.items ?? []) {
    y += 32; L(PAD, it.name, { size: 16 })
    y += 24
    L(PAD + 22, `${it.qty} @ ${usd(it.unit)}`, { size: 13 })
    L(W - PAD, usd(it.amount), { size: 16, anchor: 'end' })
  }

  y += 30; rule()
  for (const t of spec.totals) {
    if (t.ruleBefore) { y += 18; rule(t.ruleBefore) }
    y += t.big ? 40 : 30
    L(PAD, t.label, { size: t.big ? 19 : 16, weight: t.big ? 'bold' : 'normal' })
    L(W - PAD, usd(t.amount), { size: t.big ? 19 : 16, weight: t.big ? 'bold' : 'normal', anchor: 'end' })
  }

  y += 44
  for (const f of spec.footer) { L(W / 2, f, { size: 13, anchor: 'middle' }); y += 22 }
  y += 18

  const H = Math.round(y)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#fff"/>${el.join('')}</svg>`
}

const HD = { merchant: 'THE HOME DEPOT', address: ['350 WINTHROP AVENUE', 'N. ANDOVER, MA 01845', '(978) 688-6322'] }
const THANKS = ['THANK YOU FOR SHOPPING', 'WITH US!']

const specs = {
  // A tip line is the classic total-vs-subtotal trap: three plausible numbers
  // stacked, and the largest is the one actually charged.
  'receipt_tip_line.png': {
    merchant: 'THE GRANARY TABLE',
    address: ['118 ESSEX STREET', 'SALEM, MA 01970', '(978) 744-0100'],
    meta: { left: '04/12/2026  7:58 PM', right: 'SVR 12  CHK 4471' },
    items: [
      { name: 'ROASTED CHICKEN', qty: 2, unit: 26.0, amount: 52.0 },
      { name: 'WINTER SALAD', qty: 1, unit: 14.5, amount: 14.5 },
      { name: 'BREAD SERVICE', qty: 1, unit: 6.0, amount: 6.0 },
      { name: 'SPARKLING WATER', qty: 2, unit: 5.0, amount: 10.0 },
    ],
    totals: [
      { label: 'SUBTOTAL', amount: 82.5 },
      { label: 'MEALS TAX 6.25%', amount: 5.16 },
      { label: 'TIP', amount: 17.0 },
      { label: 'TOTAL', amount: 104.66, big: true, ruleBefore: 2 },
      { label: 'VISA TENDERED', amount: 104.66 },
    ],
    footer: ['THANK YOU — PLEASE COME AGAIN'],
    answer: { merchant: 'THE GRANARY TABLE', date: '2026-04-12', subtotal: 82.5, tax: 5.16, total: 104.66, tip: 17.0,
      note: 'tip line — total is subtotal + tax + tip; returning 82.50 or 87.66 is the failure' },
  },

  // A card slip carries AMOUNT and TOTAL as separate lines, differing by the
  // written-in tip. Picking AMOUNT gives a believable number that is not the charge.
  'receipt_card_slip.png': {
    merchant: 'BLUE DORY COFFEE',
    address: ['22 CHESTNUT STREET', 'PORTSMOUTH, NH 03801', 'MERCHANT #  4417 0092'],
    meta: { left: '05/03/2026  9:14 AM', right: 'VISA ****3318' },
    items: [],
    totals: [
      { label: 'AMOUNT', amount: 18.4 },
      { label: 'TIP', amount: 3.6 },
      { label: 'TOTAL', amount: 22.0, big: true, ruleBefore: 2 },
    ],
    footer: ['CARDHOLDER COPY', 'X ____________________'],
    answer: { merchant: 'BLUE DORY COFFEE', date: '2026-05-03', subtotal: 18.4, tax: null, total: 22.0, tip: 3.6,
      note: 'card slip — AMOUNT 18.40 is the pre-tip charge, TOTAL 22.00 is what was taken. No tax line.' },
  },

  // 03/04 is genuinely ambiguous. The US address and state are the cues that
  // resolve it to March 4 rather than April 3.
  'receipt_ambiguous_date.png': {
    ...HD,
    meta: { left: '03/04/2026  11:26 AM', right: 'REG 02 TRANS 1180' },
    items: [
      { name: 'SPACKLE 1QT', qty: 2, unit: 9.480, amount: 18.96 },
      { name: 'SANDING SPONGE', qty: 4, unit: 3.250, amount: 13.0 },
      { name: 'PAINTERS TAPE 2IN', qty: 3, unit: 7.980, amount: 23.94 },
    ],
    totals: [
      { label: 'SUBTOTAL', amount: 55.9 },
      { label: 'SALES TAX 6.25%', amount: 3.49 },
      { label: 'TOTAL', amount: 59.39, big: true, ruleBefore: 2 },
      { label: 'VISA TENDERED', amount: 59.39 },
    ],
    footer: THANKS,
    answer: { merchant: 'THE HOME DEPOT', date: '2026-03-04', subtotal: 55.9, tax: 3.49, total: 59.39,
      note: 'ambiguous 03/04/2026 — US address resolves it to March 4. 2026-04-03 is the failure.' },
  },

  // Refunds are legitimately negative. Returning 48.67 instead of -48.67 turns
  // a credit into a charge.
  'receipt_refund.png': {
    ...HD,
    meta: { left: '06/19/2026  2:05 PM', right: 'RETURN  TRANS 6620' },
    items: [
      { name: 'CORDLESS DRILL 18V', qty: -1, unit: 45.8, amount: -45.8 },
    ],
    totals: [
      { label: 'SUBTOTAL', amount: -45.8 },
      { label: 'SALES TAX 6.25%', amount: -2.87 },
      { label: 'REFUND TOTAL', amount: -48.67, big: true, ruleBefore: 2 },
      { label: 'CREDIT TO VISA', amount: -48.67 },
    ],
    footer: ['RETURNED MERCHANDISE', 'CREDIT ISSUED TO ORIGINAL CARD'],
    answer: { merchant: 'THE HOME DEPOT', date: '2026-06-19', subtotal: -45.8, tax: -2.87, total: -48.67,
      note: 'refund — total is negative. Returning +48.67 is the failure.' },
  },

  // Deliberately inconsistent arithmetic. Nothing is misprinted-looking; the
  // numbers simply do not add up, which is the only thing the subtotal + tax
  // check keys on.
  'receipt_inconsistent.png': {
    ...HD,
    meta: { left: '07/08/2026  4:40 PM', right: 'REG 07 TRANS 3391' },
    items: [
      { name: 'LED SHOP LIGHT 4FT', qty: 3, unit: 32.0, amount: 96.0 },
      { name: 'EXTENSION CORD 25FT', qty: 1, unit: 24.0, amount: 24.0 },
    ],
    totals: [
      { label: 'SUBTOTAL', amount: 120.0 },
      { label: 'SALES TAX 6.25%', amount: 7.5 },
      { label: 'TOTAL', amount: 227.5, big: true, ruleBefore: 2 },
      { label: 'VISA TENDERED', amount: 227.5 },
    ],
    footer: THANKS,
    answer: { merchant: 'THE HOME DEPOT', date: '2026-07-08', subtotal: 120.0, tax: 7.5, total: 227.5,
      expectLowConfidence: true,
      note: 'printed arithmetic is wrong on purpose: 120.00 + 7.50 = 127.50, not 227.50. Reading it faithfully is correct; the subtotal+tax check must force confidence low.' },
  },
}

const keys = {}
for (const [file, spec] of Object.entries(specs)) {
  const svg = render(spec)
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  writeFileSync(join(OUT, file), png)
  const { width, height } = await sharp(png).metadata()
  keys[file] = spec.answer
  console.log(`  ${file.padEnd(30)} ${width}x${height}`)
}
console.log('\nanswer-key fragment:\n')
console.log(JSON.stringify(keys, null, 2))
