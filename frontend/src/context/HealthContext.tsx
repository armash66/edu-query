import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getHealth } from '../api/client'
import { ApiError, type HealthResponse } from '../api/types'

interface HealthContextType {
  health: HealthResponse | null
  loading: boolean
  error: ApiError | null
  refreshHealth: () => Promise<void>
}

const HealthContext = createContext<HealthContextType | undefined>(undefined)

export const HealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<ApiError | null>(null)

  const refreshHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHealth()
      setHealth(data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err)
      } else {
        setError(new ApiError(0, 'UNKNOWN_ERROR', 'Failed to retrieve system status'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshHealth()
  }, [refreshHealth])

  return (
    <HealthContext.Provider value={{ health, loading, error, refreshHealth }}>
      {children}
    </HealthContext.Provider>
  )
}

export function useHealth(): HealthContextType {
  const context = useContext(HealthContext)
  if (!context) {
    throw new Error('useHealth must be used within a HealthProvider')
  }
  return context
}
