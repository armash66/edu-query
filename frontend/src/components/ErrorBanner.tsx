import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { ApiError } from '../api/types'

interface ErrorBannerProps {
  error: ApiError | Error | string | null
  onRetry?: () => void
  title?: string
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onRetry,
  title = 'An error occurred',
}) => {
  if (!error) return null

  let message = 'An unexpected error occurred.'
  let details: string[] = []
  let errorCode = ''

  if (error instanceof ApiError) {
    message = error.message
    details = error.details
    errorCode = error.errorCode
  } else if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  }

  return (
    <div className="alert alert-danger" role="alert">
      <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>
            {title} {errorCode ? `(${errorCode})` : ''}
          </strong>
          {onRetry && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onRetry}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            >
              <RefreshCw size={12} /> Retry
            </button>
          )}
        </div>
        <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>{message}</p>
        {details.length > 0 && (
          <ul style={{ marginTop: '0.4rem', paddingLeft: '1.25rem', fontSize: '0.8rem' }}>
            {details.map((detail, idx) => (
              <li key={idx}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
