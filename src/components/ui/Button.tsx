import Link from 'next/link'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'outline'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-text text-surface border border-text hover:bg-text-secondary hover:border-text-secondary',
  outline: 'bg-surface text-text-secondary border border-border-strong hover:border-text',
}

const SIZE: Record<ButtonSize, string> = {
  // 13px / 8px vertical / 14px horizontal / 7px radius
  sm: 'text-[13px] py-[8px] px-[14px] rounded-btn',
  // 15px / 13px padding / 8px radius
  md: 'text-[15px] p-[13px] rounded-lg',
}

/**
 * 44px minimum touch target, applied below the `sm` breakpoint only. Several of
 * the design's 13px/8px buttons are ~29px tall and would otherwise miss the
 * target on a phone; above 640px they collapse back to the designed height.
 */
const TOUCH_TARGET = 'min-h-11 min-w-11 sm:min-h-0 sm:min-w-0'

const BASE = cx(
  'inline-flex items-center justify-center gap-2 text-center font-medium',
  'cursor-pointer select-none',
  'disabled:cursor-not-allowed disabled:opacity-50',
  TOUCH_TARGET,
)

type ButtonOwnProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Render as a link. A disabled href degrades to a disabled <button>. */
  href?: string
  className?: string
  children?: React.ReactNode
}

export type ButtonProps = ButtonOwnProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps>

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  href,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cx(BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className)

  // A disabled link is a contradiction: <a> has no disabled state, and
  // `pointer-events: none` removes it from the keyboard as well as the mouse.
  // Task 04's "Current plan" CTA is exactly this case, so a disabled `href`
  // degrades to a real disabled <button>, which keyboards and screen readers
  // both already understand.
  if (href !== undefined && !rest.disabled) {
    const { type: _type, ...anchorProps } = rest
    void _type
    return (
      <Link
        href={href}
        className={classes}
        {...(anchorProps as React.ComponentPropsWithoutRef<'a'>)}
      >
        {children}
      </Link>
    )
  }

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  )
}
