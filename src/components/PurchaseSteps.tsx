import { cx } from '@/components/ui'

/**
 * Account → Payment → Done, shown on every screen between the pricing page and
 * a working subscription.
 *
 * It earns its place by being true rather than decorative: buying really is
 * three stages, and the middle one throws the buyer out of the browser to fetch
 * a magic link. Without a stepper that detour reads as the flow breaking down.
 * With one, the sign-in page is visibly step one of something the visitor
 * started on purpose.
 *
 * Which is also the rule for using it: only render it when a purchase is
 * actually underway. On the ordinary `/login` — someone signing in to look at
 * their receipts — there is no step two, and a stepper would invent one.
 */

const STEPS = ['Account', 'Payment', 'Done'] as const

/** 1-based, matching the numbers on screen. */
export type PurchaseStep = 1 | 2 | 3

export default function PurchaseSteps({
  current,
  className,
}: {
  current: PurchaseStep
  className?: string
}) {
  return (
    // A list, because that is what it is. `aria-label` names the whole thing;
    // the per-step state is spelled out in visually-hidden text below rather
    // than left to a checkmark glyph, which a screen reader would either skip
    // or read as the word "check".
    // Three equal grid columns, not a flex row. Flex sizes each step by its
    // label, and the labels are different lengths ("Account" against "Done"),
    // so the connecting rails came out different lengths and the circles sat at
    // uneven intervals. A grid pins the circles to fixed centres and lets the
    // labels be whatever width they are.
    <ol
      aria-label="Purchase progress"
      className={cx('grid w-full max-w-[360px] grid-cols-3', className)}
    >
      {STEPS.map((label, index) => {
        const step = index + 1
        const isCurrent = step === current
        const isDone = step < current

        return (
          <li key={label} className="relative flex flex-col items-center gap-1.5">
            {/* Reaches back from this circle to the previous one: -50% of a
                column lands on the neighbouring centre, and 17px clears the
                24px circle at each end. `top-3` is that circle's vertical
                middle. */}
            {index > 0 && (
              <span
                aria-hidden
                className="absolute top-3 left-[calc(-50%+17px)] right-[calc(50%+17px)] h-px bg-border-strong"
              />
            )}

            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden
                className={cx(
                  'grid h-6 w-6 place-items-center rounded-full border text-[12px] font-semibold',
                  isCurrent && 'border-text bg-text text-surface',
                  isDone && 'border-text bg-surface text-text',
                  !isCurrent && !isDone && 'border-border-strong bg-surface text-text-faint',
                )}
              >
                {isDone ? '✓' : step}
              </span>
              <span
                className={cx(
                  'text-[10.5px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap',
                  isCurrent && 'text-text',
                  isDone && 'text-text-muted',
                  !isCurrent && !isDone && 'text-text-faint',
                )}
              >
                {label}
              </span>
              <span className="sr-only">
                {isDone ? '(completed)' : isCurrent ? '(current step)' : '(not started)'}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
