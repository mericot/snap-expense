import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The app shipped without any, which matters more here than it would in most
 * apps: the Supabase session cookies are deliberately **not** httpOnly, because
 * the browser client in SessionProvider has to read them (the reasoning is
 * written out in src/lib/supabase-server.ts). httpOnly is the usual thing
 * standing between an XSS and a stolen session, and it is intentionally not
 * available here — so a Content-Security-Policy is the compensating control,
 * not a nice-to-have.
 *
 * CSP ships as **Report-Only** on purpose. An enforcing policy that is missing
 * one Stripe domain does not degrade, it breaks embedded checkout for real
 * paying customers, and a launch is the worst moment to discover which host was
 * forgotten. Report-Only turns that same mistake into a console report. Flip
 * `CSP_ENFORCE` once real traffic has been quiet for a while; nothing else has
 * to change.
 *
 * Everything except the CSP is enforced immediately — those are unambiguous and
 * carry no comparable risk of breaking a page.
 */

/** Set to true to switch the CSP from Report-Only to enforcing. */
const CSP_ENFORCE = false;

/**
 * Supabase is contacted directly from the browser (auth, and every expense read
 * and write goes over PostgREST from the client), so its origin has to be in
 * `connect-src` or the app cannot function under an enforcing policy. Derived
 * from the env var rather than hardcoded so preview and production each get
 * their own project's URL.
 *
 * Falls back to allowing all of supabase.co when the variable is absent — that
 * only happens in a build with no Supabase configured, where a broken policy
 * would be a confusing way to find out.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "https://*.supabase.co wss://*.supabase.co";
  try {
    const { origin, host } = new URL(url);
    // Realtime and auth state changes use a websocket to the same host.
    return `${origin} wss://${host}`;
  } catch {
    return "https://*.supabase.co wss://*.supabase.co";
  }
})();

const csp = [
  `default-src 'self'`,
  // 'unsafe-inline' is required by Next's inline bootstrap and 'unsafe-eval' by
  // the dev overlay. Removing them needs a nonce-based policy wired through the
  // proxy, which is a bigger change than this pass — and one worth making before
  // flipping CSP_ENFORCE, because without a nonce the script-src is doing much
  // less than it looks like it is.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com`,
  // Tailwind v4 injects styles inline.
  `style-src 'self' 'unsafe-inline'`,
  // blob: and data: are the client-side receipt previews before upload.
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigin} https://api.stripe.com`,
  // Stripe's embedded checkout renders in an iframe from these two hosts.
  `frame-src https://js.stripe.com https://hooks.stripe.com`,
  // Nothing should ever frame us. Complements X-Frame-Options below for older
  // browsers that only understand the header.
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const securityHeaders = [
  {
    key: CSP_ENFORCE
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    value: csp,
  },
  // Two years, subdomains included. Vercel terminates TLS and will honour this.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Send the origin cross-site but never the path — receipt and checkout URLs
  // should not travel in a Referer to a third party.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // The camera is *not* disabled: receipt capture on mobile is the core of
    // the product and uses a file input with `capture`, which this governs.
    value: "geolocation=(), microphone=(), payment=(self)",
  },
];

const nextConfig: NextConfig = {
  // Do not advertise the framework and version to scanners.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  /**
   * Kept from `main`, which is the only branch that ever had them.
   *
   * These four are live on snap-expenses.com today and are the reason this
   * merge is not a straight "take ui-improvements": that branch grew the
   * security headers above while main grew these, and dropping either half
   * would be a regression. `/privacy` and `/terms` in particular are the short
   * URLs a customer is most likely to have been given, and they must keep
   * resolving rather than start 404ing the day the app ships.
   *
   * Permanent (308), so they are cached by browsers — which is also why
   * removing one later is not free.
   */
  async redirects() {
    return [
      { source: "/privacy", destination: "/legal/privacy", permanent: true },
      { source: "/terms", destination: "/legal/terms", permanent: true },
      { source: "/support", destination: "/legal/contact", permanent: true },
      { source: "/contact", destination: "/legal/contact", permanent: true },
    ];
  },

  // Dev-only: allows LAN access for phone testing. Guarded so it can never
  // widen anything in a production build, whatever the IP happens to be.
  ...(process.env.NODE_ENV === "development"
    ? { allowedDevOrigins: ["10.0.0.151"] }
    : {}),
};

export default nextConfig;
