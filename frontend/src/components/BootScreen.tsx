import React, { useState, useEffect } from 'react'
import { GlassCard } from '../ui/GlassCard'
import { ProgressBar } from '../ui/ProgressBar'
import { Button } from '../ui/Button'
import { RefreshCw, Server } from 'lucide-react'

export interface BootScreenProps {
  onRetry: () => Promise<void>
  errorMessage?: string
}

export const BootScreen: React.FC<BootScreenProps> = ({ onRetry, errorMessage }) => {
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [retrying, setRetrying] = useState(false)
  const estimatedColdStartTime = 50 // Render free tier cold-start average: 50s

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1)
    }, 1000)

    // Auto retry every 4 seconds
    const retryInterval = setInterval(() => {
      onRetry()
    }, 4000)

    return () => {
      clearInterval(timer)
      clearInterval(retryInterval)
    }
  }, [onRetry])

  const handleManualRetry = async () => {
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  const progressPct = Math.min(95, Math.round((secondsElapsed / estimatedColdStartTime) * 100))

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <GlassCard
        variant="glass-3"
        padding="xl"
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--surface-hover)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text)',
            border: '1px solid var(--border-strong)',
            position: 'relative',
          }}
        >
          <Server size={30} />
          <span
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'var(--status-warning-text)',
              border: '2px solid var(--bg-base)',
              animation: 'spin 2s linear infinite',
            }}
          />
        </div>

        <div>
          <h2
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 'var(--space-2)',
            }}
          >
            EduQuery Backend is Waking Up
          </h2>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '420px',
            }}
          >
            The backend is hosted on a serverless container that sleeps when inactive. It takes
            approximately 45–55 seconds to spin up on cold start.
          </p>
        </div>

        <div style={{ width: '100%', marginTop: 'var(--space-2)' }}>
          <ProgressBar
            value={progressPct}
            showLabel
            label={`Waking up... ${secondsElapsed}s elapsed`}
          />
        </div>

        {errorMessage && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              background: 'var(--surface-hover)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={errorMessage}
          >
            Status: {errorMessage}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-2)',
          }}
        >
          <Button
            variant="primary"
            size="md"
            loading={retrying}
            onClick={handleManualRetry}
            icon={<RefreshCw size={16} />}
          >
            Check Status Now
          </Button>
        </div>

        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          Re-checking automatically every 4 seconds. No need to refresh the page.
        </span>
      </GlassCard>
    </div>
  )
}
