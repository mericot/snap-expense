import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 px-4 py-6">
      <div className="mx-auto max-w-3xl flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-zinc-400">
          &copy; {new Date().getFullYear()} snapExpense
        </p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
          <Link href="/terms" className="hover:text-zinc-600">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-zinc-600">
            Privacy Policy
          </Link>
          <Link href="/support" className="hover:text-zinc-600">
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
