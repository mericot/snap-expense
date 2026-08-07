import Link from 'next/link'
import { Card } from '@/components/ui'

/**
 * Retention notice.
 *
 * The sentence below is legally reviewed copy and is reproduced verbatim. Do
 * not reword it, resegment it, or swap the em dashes.
 *
 * ⚠ The "30 days" figure is an OPEN QUESTION, flagged in
 * `design_handoff_snapexpense_paid/README.md` and in
 * `docs/design-tasks/README.md`: it must match the real Supabase backup
 * lifecycle before launch, or the copy changes. It is reproduced here as
 * specified and deliberately not resolved on this branch. The global footer
 * makes the same promise ("Deleted 30 days after you delete the expense"), so
 * whatever the real window turns out to be, both places change together.
 *
 * There is a second, larger problem behind it: receipt *images* are never
 * stored at all today — they are posted to /api/extract and discarded. The
 * first clause is currently true only vacuously. It becomes load-bearing the
 * moment image storage ships. See the PR.
 *
 * `/legal/retention` does not exist yet. It is wired as a real href, following
 * the convention task 00 set for the footer's /legal/* links, so the gap stays
 * visible instead of being papered over with "#".
 */
export default function RetentionNotice() {
  return (
    <Card padding="none" className="px-[18px] py-4">
      <p className="text-[13px] leading-[1.55] text-text-muted text-pretty">
        <strong className="font-semibold text-text">How long we keep this.</strong>{' '}
        Receipt images and the data we read from them stay until you delete them, then sit in
        encrypted backups for 30 days before they are gone for good. Deleting your account removes
        everything.{' '}
        <Link href="/legal/retention" className="underline">
          Retention policy
        </Link>
      </p>
    </Card>
  )
}
