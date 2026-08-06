import { cx } from './cx'

/** Compliance chip: 11px, 1px border, 4px radius, 3px/7px padding. */
type BadgeProps = {
  className?: string
  children: React.ReactNode
}

export default function Badge({ className, children }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center border border-border rounded-sm',
        'py-[3px] px-[7px] text-[11px] leading-normal text-text-tertiary',
        className,
      )}
    >
      {children}
    </span>
  )
}
