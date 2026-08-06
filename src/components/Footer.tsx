import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300">
          Terms of Service
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300">
          Privacy Policy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/support" className="hover:text-zinc-600 dark:hover:text-zinc-300">
          Support
        </Link>
      </nav>
      <p className="mt-2">
        &copy; {new Date().getFullYear()} snapExpense. All rights reserved.
      </p>
    </footer>
  );
}
