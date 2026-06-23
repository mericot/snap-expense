# snapExpense

A receipt scanning expense tracker. Snap a photo of a receipt, let Claude AI extract the details, and save it to a persistent database — all in one app.

---

## Tech Stack

| Tool | Role |
|------|------|
| **Next.js 15 (App Router)** | Full-stack framework — UI and API routes in one project |
| **TypeScript** | Type safety across the entire codebase |
| **Tailwind CSS** | Utility-first styling |
| **Anthropic Claude API** | Vision AI that reads receipt images and extracts expense data |
| **Supabase** | Postgres database (free tier) — stores all expenses persistently |
| **Vercel** | Deployment — turns the project into a live public URL |
| **CSV Export** | Client-side export of expense data — no server needed |

---

## Project Structure

```
snap-expense/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Main UI (to be built)
│   │   ├── layout.tsx             # Root layout with global styles
│   │   ├── globals.css            # Tailwind base styles
│   │   └── api/
│   │       └── extract/
│   │           └── route.ts       # POST /api/extract — vision extraction
│   └── lib/
│       └── supabase.ts            # Supabase client + Expense type definition
├── supabase/
│   └── schema.sql                 # SQL to create the expenses table
├── .env.example                   # Template for required environment variables
├── .env.local                     # Your actual secrets (gitignored, never committed)
├── vercel.json                    # Vercel deployment config
├── next.config.ts                 # Next.js configuration
├── tailwind.config.ts             # Tailwind configuration
└── tsconfig.json                  # TypeScript configuration
```

---

## How It Works

### 1. Receipt Upload (UI — coming soon)
The user selects or snaps a photo of a receipt. The image is converted to base64 in the browser and sent to the API route.

### 2. AI Extraction — `POST /api/extract`
File: `src/app/api/extract/route.ts`

This API route receives the base64 image and sends it to Claude's vision model (`claude-opus-4-6`). Claude reads the receipt and returns structured JSON:

```json
{
  "date": "2026-06-23",
  "merchant": "Whole Foods",
  "amount": 47.82,
  "currency": "USD",
  "category": "Food",
  "description": "Grocery run"
}
```

The prompt instructs Claude to return only the JSON object — no extra explanation — so the response can be parsed directly.

### 3. Database — Supabase
File: `src/lib/supabase.ts` and `supabase/schema.sql`

The Supabase client is initialized once and exported for use anywhere in the app. The `Expense` TypeScript type matches the database schema exactly.

**Expenses table columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Auto-generated primary key |
| `created_at` | timestamptz | When the record was inserted |
| `date` | date | Date on the receipt |
| `merchant` | text | Store or restaurant name |
| `amount` | numeric(10,2) | Total amount |
| `currency` | text | Currency code, default `USD` |
| `category` | text | Food, Travel, Shopping, etc. |
| `description` | text | Short description |
| `image_url` | text | Optional link to stored receipt image |

### 4. CSV Export (coming soon)
Done entirely client-side using JavaScript — converts the expense list to a CSV string and triggers a download. No server call needed.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your keys. **Never commit `.env.local`.**

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|----------|----------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |

---

## Database Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Paste and run the contents of `supabase/schema.sql`

That creates the `expenses` table and enables Row Level Security with a permissive policy (tighten this later when you add auth).

---

## Local Development

```bash
# Install dependencies
npm install

# Add your environment variables
cp .env.example .env.local
# then fill in the three values in .env.local

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# Deploy
vercel
```

During the first deploy, Vercel will ask you to link a project. After that, add your environment variables in the Vercel dashboard under **Settings → Environment Variables** — the same three keys from `.env.local`.

Every `git push` to `main` will trigger an automatic redeploy.

---

## Roadmap

- [ ] Receipt upload UI with image preview
- [ ] Expense list with sorting and filtering
- [ ] Edit / delete expenses
- [ ] CSV export
- [ ] Auth (Supabase Auth) so each user sees only their expenses
- [ ] Mobile camera capture
