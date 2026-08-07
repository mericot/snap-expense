import { cx } from './cx'

/** 'card' = 10px (cards, list containers), 'panel' = 12px (plan cards, hero). */
export type CardRadius = 'card' | 'panel'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const RADIUS: Record<CardRadius, string> = {
  card: 'rounded-card',
  panel: 'rounded-xl',
}

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

type CardProps = {
  radius?: CardRadius
  padding?: CardPadding
  className?: string
  children?: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'children'>

export default function Card({
  radius = 'card',
  padding = 'lg',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx('bg-surface border border-border', RADIUS[radius], PADDING[padding], className)}
      {...rest}
    >
      {children}
    </div>
  )
}
