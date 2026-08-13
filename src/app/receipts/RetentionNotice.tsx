import Link from 'next/link'
import { Card } from '@/components/ui'

/**
 * Retention notice.
 *
 * The previous copy said: "Receipt images and the data we read from them stay
 * until you delete them, then sit in encrypted backups for 30 days before they
 * are gone for good."
 *
 * The comment that used to sit here already recorded why that was wrong —
 * receipt images are never stored at all, they are posted to /api/extract and
 * discarded — and then reproduced the sentence anyway, on the grounds that it
 * was legally reviewed and the branch was not the place to resolve it. Shipping
 * it to the public is the place, so it is resolved now: the notice describes
 * what the app actually does.
 *
 * Two things changed and one deliberately did not.
 *
 *   - Images: stated as never stored. True, and a stronger promise than the
 *     one it replaces. Revisit the moment image storage ships.
 *   - Account deletion: still promised, and now actually implemented. The route
 *     behind it used to delete nothing at all (see /api/account/delete).
 *   - The "30 days in encrypted backups" window is GONE, because it was not
 *     true either. It was checked against the real project rather than left
 *     open: the Supabase organisation is on the **free plan**, and Supabase
 *     only takes customer-accessible daily backups on Pro and above — their
 *     docs tell free-tier projects to export their own data. Thirty days is the
 *     *Enterprise* ceiling; Pro is seven and Team is fourteen. So the sentence
 *     promised a restore window that does not exist at any tier this project
 *     could be on.
 *
 * Rather than swap in a different number, that claim is gone. A retention
 * promise has to survive someone checking it. If a paid plan or PITR is ever
 * enabled, this is where a real *backup* window would go.
 *
 * The 30 days now stated is a different figure and a real one. Deleting an
 * expense only stamps `deleted_at`; the row itself used to survive forever, so
 * the draft that replaced the backup sentence ("deleting removes them straight
 * away") was false in turn — the second wrong claim in the same paragraph in
 * two days. A nightly pg_cron job now purges soft-deleted rows after 30 days,
 * which is what makes this sentence true. See
 * db/migrations/2026-08-11-purge-deleted-expenses.sql; the window lives in that
 * function's default and this copy tracks it.
 *
 * ⚠ This copy was marked legally reviewed. It has been changed twice now to
 * stop it being untrue, which is the higher duty, but it should go back past a
 * reviewer before the marketing push.
 */
export default function RetentionNotice() {
  return (
    <Card padding="none" className="px-[18px] py-4">
      <p className="text-[13px] leading-[1.55] text-text-muted text-pretty">
        <strong className="font-semibold text-text">How long we keep this.</strong>{' '}
        The receipt image is read once and discarded — we never store it. The details we pull out
        of it stay until you delete them, then leave our database within 30 days. Deleting your
        account removes everything at once.{' '}
        <Link href="/legal/retention" className="underline">
          Retention policy
        </Link>
      </p>
    </Card>
  )
}
