import type { Metadata } from "next";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "snapExpense",
  description: "Snap a receipt, track your spending. AI-powered expense tracking made simple.",
  openGraph: {
    title: "snapExpense",
    description: "Snap a receipt, track your spending. AI-powered expense tracking made simple.",
    siteName: "snapExpense",
    type: "website",
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
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
