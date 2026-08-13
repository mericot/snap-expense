import { cx } from './cx'

type InputProps = {
  /** Required — pair it with <Label htmlFor={id}>. */
  id: string
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>

/**
 * A real <input>. The prototype draws inputs as static divs; every one of them
 * becomes this, with a bound label, a `type` and an `autoComplete`.
 * 8px radius, 11px/13px padding, 14px text (handoff README, sign-in + checkout).
 */
export default function Input({ id, className, type = 'text', ...rest }: InputProps) {
  return (
    <input
      id={id}
      type={type}
      className={cx(
        'block w-full bg-surface border border-border rounded-lg',
        'py-[11px] px-[13px] text-[14px] text-text-muted',
        'placeholder:text-text-placeholder',
        // 44px minimum touch target on phones; 14px + 11px padding is ~40px.
        'min-h-11 sm:min-h-0',
        className,
      )}
      {...rest}
    />
  )
}
