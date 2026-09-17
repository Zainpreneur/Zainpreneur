import { cn } from '../../utils/cn'

interface BusinessLogoProps {
  glyph: string
  color: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  sm: 'size-9 rounded-lg text-xs',
  md: 'size-11 rounded-xl text-sm',
  lg: 'size-14 rounded-2xl text-lg',
  xl: 'size-20 rounded-2xl text-2xl',
}

export function BusinessLogo({ glyph, color, size = 'md', className }: BusinessLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 select-none items-center justify-center font-display font-extrabold tracking-tight text-white shadow-sm',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {glyph}
    </span>
  )
}