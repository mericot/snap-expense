/**
 * Usage:
 *   node test-extract.mjs path/to/receipt.jpg
 *
 * The dev server must be running: npm run dev
 */
import { readFileSync } from 'fs'
import { basename, extname } from 'path'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node test-extract.mjs path/to/receipt.jpg')
  process.exit(1)
}

const ext = extname(file).toLowerCase()
const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const mimeType = mimeTypes[ext]
if (!mimeType) {
  console.error('Unsupported file type. Use jpg, png, or webp.')
  process.exit(1)
}

const bytes = readFileSync(file)
const blob = new Blob([bytes], { type: mimeType })
const form = new FormData()
form.append('receipt', blob, basename(file))

console.log(`Sending ${basename(file)} to /api/extract...`)

const res = await fetch('http://localhost:3000/api/extract', { method: 'POST', body: form })
const json = await res.json()

console.log('\nResult:')
console.log(JSON.stringify(json, null, 2))
