import { cx } from './cx'

type LabelProps = {
  /** Must match the id of the control it labels. */
  htmlFor: string
  size?: 'sm' | 'md'
  className?: string
  children: React.ReactNode
} & Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'htmlFor' | 'className' | 'children'>

export default function Label({ htmlFor, size = 'md', className, children, ...rest }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cx(
        'block text-text-title',
        size === 'sm' ? 'text-[13px]' : 'text-[14px]',
        className,
      )}
      {...rest}
    >
      {children}
    </label>
  )
}
