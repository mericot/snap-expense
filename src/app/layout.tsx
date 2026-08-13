import type { Metadata } from "next";
import CookieBanner from "@/components/CookieBanner";
import CookieConsentProvider from "@/components/CookieConsentProvider";
import Footer from "@/components/Footer";
import SessionProvider from "@/components/SessionProvider";
import SubscriptionProvider from "@/components/SubscriptionProvider";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  // Without this, every Open Graph and canonical URL is resolved relative and
  // Next warns on each build. It also has to be absolute for the generated
  // opengraph-image to be shareable at all — social scrapers do not resolve
  // relative image URLs.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "snapExpense",
    // Pages set only their own name; the brand is appended here rather than
    // retyped in every file.
    template: "%s — snapExpense",
  },
  description: "Snap a receipt, track your spending. AI-powered expense tracking made simple.",
  openGraph: {
    title: "snapExpense",
    description: "Snap a receipt, track your spending. AI-powered expense tracking made simple.",
    siteName: "snapExpense",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "snapExpense",
    description: "Snap a receipt, track your spending. AI-powered expense tracking made simple.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The system font stack and the page background both come from globals.css
    // tokens now; `bg-zinc-50` used to be pinned here, which overrode the token
    // and left the body light while inherited text followed the dark-mode
    // variable. The design is light-only, so both sides now agree.
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* body is the sticky-footer column: the children wrapper takes the
            slack, the footer sits under it, and the cookie banner is the last
            flex child so `position: sticky; bottom: 0` pins it to the viewport
            without ever covering the footer. */}
        <SessionProvider>
          <SubscriptionProvider>
            <CookieConsentProvider>
              <div className="flex flex-1 flex-col">{children}</div>
              <Footer />
              <CookieBanner />
            </CookieConsentProvider>
          </SubscriptionProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
