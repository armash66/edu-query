import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        color: '#64748b',
        gap: '0.75rem',
      }}
      role="status"
    >
      <Loader2 size={32} className="spinner" style={{ color: '#2563eb' }} />
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{message}</span>
    </div>
  )
}
