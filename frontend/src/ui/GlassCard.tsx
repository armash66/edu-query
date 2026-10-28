import React from 'react'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass-1' | 'glass-2' | 'glass-3' | 'data-surface'
  elevation?: 1 | 2 | 3
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  headerSlot?: React.ReactNode
  footerSlot?: React.ReactNode
  children: React.ReactNode
}

export const GlassCard: React.FC<GlassCardProps> = ({
  variant,
  elevation,
  padding = 'md',
  headerSlot,
  footerSlot,
  children,
  className = '',
  style,
  ...props
}) => {
  const resolvedVariant = variant || (elevation === 1 ? 'glass-1' : elevation === 3 ? 'glass-3' : 'glass-2')
  const paddingMap = {
    none: '0',
    sm: 'var(--space-3)',
    md: 'var(--space-6)',
    lg: 'var(--space-8)',
    xl: 'var(--space-12)',
  }

  return (
    <div
      className={`${resolvedVariant} ${className}`.trim()}
      style={{
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
        ...style,
      }}
      {...props}
    >
      {headerSlot && (
        <div
          style={{
            padding: `${paddingMap[padding]} ${paddingMap[padding]} var(--space-4)`,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {headerSlot}
        </div>
      )}
      <div style={{ padding: paddingMap[padding] }}>{children}</div>
      {footerSlot && (
        <div
          style={{
            padding: `var(--space-4) ${paddingMap[padding]} ${paddingMap[padding]}`,
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
          }}
        >
          {footerSlot}
        </div>
      )}
    </div>
  )
}
