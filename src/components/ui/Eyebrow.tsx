import { cx } from './cx'

/** Uppercase section label: 13px / 600 / 0.08em tracking / #a1a1aa. */
type EyebrowProps = {
  as?: 'p' | 'span' | 'div'
  className?: string
  children: React.ReactNode
}

export default function Eyebrow({ as: Tag = 'p', className, children }: EyebrowProps) {
  return (
    <Tag
      className={cx(
        'text-[13px] font-semibold uppercase tracking-[0.08em] text-text-faint',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
