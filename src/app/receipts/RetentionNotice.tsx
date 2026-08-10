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
 *   - The "30 days" backup window is UNCHANGED and still UNVERIFIED. It is
 *     scoped to extracted expense data, which is genuinely stored, so the claim
 *     is at least about a real thing now — but it must be checked against the
 *     project's actual Supabase backup lifecycle before launch. It is repeated
 *     on /legal/retention; both change together.
 *
 * ⚠ This copy was marked legally reviewed. It has been changed to stop it being
 * untrue, which is the higher duty, but it should go back past a reviewer
 * before the marketing push.
 */
export default function RetentionNotice() {
  return (
    <Card padding="none" className="px-[18px] py-4">
      <p className="text-[13px] leading-[1.55] text-text-muted text-pretty">
        <strong className="font-semibold text-text">How long we keep this.</strong>{' '}
        The receipt image is read once and discarded — we never store it. The details we pull out
        of it stay until you delete them, then sit in encrypted backups for 30 days before they are
        gone for good. Deleting your account removes everything.{' '}
        <Link href="/legal/retention" className="underline">
          Retention policy
        </Link>
      </p>
    </Card>
  )
}
