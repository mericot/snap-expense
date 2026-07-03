# snapExpense

A receipt scanning expense tracker. Snap a photo of a receipt, Claude AI extracts the details, and it saves to a persistent database you can filter and export to CSV.

---

## Tech Stack

| Tool | Role |
|------|------|
| **Next.js 15 (App Router)** | Full-stack framework — UI and API routes in one project |
| **TypeScript** | Type safety across the entire codebase |
| **Tailwind CSS** | Utility-first styling |
| **Anthropic Claude Haiku** | Vision AI — reads receipt images and extracts structured data |
| **Supabase** | Postgres database (free tier) — stores all expenses persistently |
| **Vercel** | Deployment — live public URL |
| **CSV Export** | Client-side export, no server needed |

---

## Project Structure

```
snap-expense/
├── src/
│   ├── app/
│   │   ├── page.tsx                   # Main UI (upload + table + export)
│   │   ├── layout.tsx                 # Root layout
│   │   ├── globals.css                # Tailwind base styles
│   │   └── api/
│   │       └── extract/
│   │           └── route.ts           # POST /api/extract — vision extraction
│   └── lib/
│       ├── supabase.ts                # Supabase client + Expense type
│       └── categories.ts             # Fixed category list
├── supabase/
│   └── schema.sql                     # SQL to create the expenses table
├── test-extract.mjs                   # CLI test script for /api/extract
├── .env.example                       # Template for required env vars
├── .env.local                         # Your secrets (gitignored)
└── vercel.json                        # Vercel deployment config
```

---

## How It Works

### 1. Receipt Upload
The user picks or photographs a receipt. The image is sent as `multipart/form-data` to `/api/extract`.

### 2. AI Extraction — `POST /api/extract`
`src/app/api/extract/route.ts`

Receives the image, sends it to `claude-haiku-4-5-20251001` with a strict prompt. Returns JSON only — no prose, no markdown:

```json
{
  "merchant": "Whole Foods",
  "date": "2026-06-29",
  "total": 47.82,
  "tax": 3.21,
  "category": "Meals",
  "confidence": "high"
}
```

**Extraction rules (enforced in the prompt):**
- Returns JSON only — nothing before or after the object
- `null` for any field that isn't legible on the receipt
- `confidence` is `"low"` if any field is null
- `category` is always from the fixed list — never invented
- `total` is never guessed — `null` beats a wrong number

### 3. Categories
`src/lib/categories.ts`

Fixed list used in both the prompt and enforced server-side:
`Software`, `Travel`, `Meals`, `Office`, `Hardware`, `Other`

If Claude returns anything outside this list, the route resets it to `Other`.

### 4. Database — Supabase
`src/lib/supabase.ts` + `supabase/schema.sql`

**`expenses` table:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Auto-generated primary key |
| `created_at` | timestamptz | Row insert timestamp |
| `merchant` | text | Store or restaurant name |
| `date` | date | Date printed on the receipt |
| `total` | numeric(10,2) | Receipt total |
| `tax` | numeric(10,2) | Tax amount (nullable) |
| `category` | text | One of the fixed category list |

Row Level Security is enabled with an open policy — tighten this when you add auth.

### 5. CSV Export
Done entirely client-side — converts the expense list to a CSV string and triggers a browser download. No server call needed.

---

## Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|----------|----------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / `publishable` key |

**Never commit `.env.local`.** It is gitignored.

---

## Database Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in the Supabase dashboard
3. Paste and run:

```sql
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  merchant    text not null,
  date        date not null,
  total       numeric(10, 2) not null,
  tax         numeric(10, 2),
  category    text
);

alter table expenses enable row level security;

create policy "Allow all" on expenses
  for all
  using (true)
  with check (true);
```

---

## Local Development

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

---

## Testing

### Test 1 — Database connectivity

Confirms Supabase insert, read, and delete all work:

```bash
node test-db.mjs
```

Expected output:
```
1. Inserting test expense...
   Inserted: { id: '...', merchant: 'Test Coffee Shop', ... }
2. Reading it back...
   Fetched: { id: '...', merchant: 'Test Coffee Shop', ... }
3. Deleting test row...
   Deleted successfully.
All tests passed — Supabase is working correctly.
```

### Test 2 — Vision extraction (requires dev server running)

**Step 1** — start the dev server in one terminal:
```bash
npm run dev
```

**Step 2** — in a second terminal, send a receipt image:
```bash
node test-extract.mjs path/to/receipt.jpg
```

Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`

Expected output:
```json
{
  "merchant": "Starbucks",
  "date": "2026-06-29",
  "total": 6.75,
  "tax": 0.54,
  "category": "Meals",
  "confidence": "high"
}
```

**What to check:**
- `merchant`, `date`, `total` match what's on the receipt
- `category` is one of: `Software`, `Travel`, `Meals`, `Office`, `Hardware`, `Other`
- `confidence` is `"high"` for a clear receipt, `"low"` if anything is illegible
- Any unreadable field comes back as `null` — not a guess

### Test 3 — Manual API test with curl

With the dev server running:

```bash
curl -X POST http://localhost:3000/api/extract \
  -F "receipt=@path/to/receipt.jpg" | jq
```

---

## Deploying to Vercel

```bash
npm install -g vercel
vercel
```

After the first deploy, add your three environment variables in the Vercel dashboard under **Settings → Environment Variables**. Every `git push` to `main` triggers an automatic redeploy.

---

## Build Status

| Feature | Status |
|---------|--------|
| Project scaffold (Next.js + Tailwind + TypeScript) | Done |
| Supabase schema + connectivity | Done |
| `/api/extract` — Claude vision route | Done |
| Category enforcement | Done |
| UI — upload + table + totals | In progress |
| CSV export | Pending |
| Vercel deploy | Pending |

---

## Roadmap (after ship)

- Auth — Supabase Auth so each user sees only their own expenses
- Edit/correct flow — fix wrong extractions instead of delete and re-snap
- Image storage — keep a copy of the receipt in Supabase Storage
- Monthly summary and charts
