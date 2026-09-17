import { useId } from 'react'

interface SparklineProps {
  values: number[]
  color?: string
  width?: number
  height?: number
  strokeWidth?: number
  fill?: boolean
  className?: string
}

export function Sparkline({
  values,
  color = '#6366f1',
  width = 120,
  height = 36,
  strokeWidth = 2,
  fill = true,
  className,
}: SparklineProps) {
  const gradientId = useId()
  if (values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)

  const points = values.map((value, index) => {
    const x = index * step
    const y = height - 3 - ((value - min) / range) * (height - 6)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const line = points.join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className ? `overflow-visible ${className}` : 'overflow-visible'}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <polyline points={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}