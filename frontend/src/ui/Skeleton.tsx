import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  radius?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  radius,
  className = '',
  style,
  ...props
}) => {
  const getRadius = () => {
    if (radius) return radius
    if (variant === 'circular') return '50%'
    if (variant === 'text') return 'var(--radius-xs)'
    return 'var(--radius-sm)'
  }

  const getHeight = () => {
    if (height) return typeof height === 'number' ? `${height}px` : height
    if (variant === 'text') return '1rem'
    if (variant === 'circular') return '40px'
    return '100px'
  }

  const getWidth = () => {
    if (width) return typeof width === 'number' ? `${width}px` : width
    if (variant === 'circular') return getHeight()
    if (variant === 'text') return '100%'
    return '100%'
  }

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer ${className}`.trim()}
      style={{
        display: 'block',
        width: getWidth(),
        height: getHeight(),
        borderRadius: getRadius(),
        background: 'var(--surface-hover)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...props}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(90deg, transparent 0%, var(--surface-active) 50%, transparent 100%)',
          animation: 'shimmerPulse 1.6s infinite ease-in-out',
        }}
      />
    </div>
  )
}
