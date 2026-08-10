import { ImageResponse } from 'next/og'

/**
 * The card that renders when a snapExpense link is shared.
 *
 * The app declared `openGraph` metadata but shipped no image, so every shared
 * link — every one in a launch announcement — rendered as a bare text card.
 *
 * Generated rather than a static PNG because there is no `public/` directory in
 * this project and no design asset to put in one. It is built at build time and
 * cached, so it costs nothing per request.
 *
 * Colours are the tokens from globals.css, by value: this runs in Satori, which
 * renders inline styles only and knows nothing about CSS custom properties or
 * Tailwind. The design is light-only, so there is no dark variant to match.
 */

export const alt = 'snapExpense — snap a receipt, track your spending'

export const size = { width: 1200, height: 630 }

export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          // --color-surface
          backgroundColor: '#ffffff',
          padding: '80px',
          // No custom font is loaded, so this resolves to Satori's default.
          // Naming the family anyway keeps the metrics predictable.
          fontFamily: 'sans-serif',
        }}
      >
        {/* Stand-in for the app icon: the same rounded dark square, which is
            the one shape the brand is currently recognisable by. */}
        <div
          style={{
            display: 'flex',
            width: '84px',
            height: '84px',
            borderRadius: '18px',
            // --color-text, which doubles as the primary button background
            backgroundColor: '#18181b',
            marginBottom: '48px',
          }}
        />

        <div
          style={{
            fontSize: '76px',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#18181b',
            lineHeight: 1.05,
          }}
        >
          snapExpense
        </div>

        <div
          style={{
            marginTop: '24px',
            fontSize: '36px',
            // --color-text-muted
            color: '#52525b',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          Snap a receipt, track your spending.
        </div>

        <div
          style={{
            marginTop: '56px',
            fontSize: '26px',
            // --color-text-tertiary
            color: '#71717a',
          }}
        >
          Receipt images are read once, then discarded — never stored.
        </div>
      </div>
    ),
    { ...size },
  )
}
