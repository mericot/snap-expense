import { cx } from './cx'

/**
 * Status pill for the receipt list. Status is carried by the text, never by
 * colour alone — `tone="warning"` only darkens the label that already reads
 * "Needs category".
 */
type PillProps = {
  tone?: 'default' | 'warning'
  className?: string
  children: React.ReactNode
}

export default function Pill({ tone = 'default', className, children }: PillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center border border-border rounded-full',
        'py-[3px] px-[9px] text-[12px] leading-none',
        tone === 'warning' ? 'text-warning' : 'text-text-tertiary',
        className,
      )}
    >
      {children}
    </span>
  )
}
