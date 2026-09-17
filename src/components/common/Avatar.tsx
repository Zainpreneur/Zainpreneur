import { cn } from '../../utils/cn'

interface AvatarProps {
  name: string
  initials: string
  color: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
}

export function Avatar({ name, initials, color, size = 'md', className }: AvatarProps) {
  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold text-white shadow-[var(--sh-raised-sm)]',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials || name.charAt(0)?.toUpperCase()}
    </span>
  )
}