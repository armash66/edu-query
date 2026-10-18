import React, { createContext, useContext, useState, type ReactNode } from 'react'

interface AdminKeyContextType {
  adminKey: string | null
  setAdminKey: (key: string) => void
  clearAdminKey: () => void
  hasAdminKey: boolean
}

const AdminKeyContext = createContext<AdminKeyContextType | undefined>(undefined)

export const AdminKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Kept in memory only for current browser session (never persisted to localStorage/sessionStorage)
  const [adminKey, setAdminKeyState] = useState<string | null>(null)

  const setAdminKey = (key: string) => {
    setAdminKeyState(key.trim())
  }

  const clearAdminKey = () => {
    setAdminKeyState(null)
  }

  return (
    <AdminKeyContext.Provider
      value={{
        adminKey,
        setAdminKey,
        clearAdminKey,
        hasAdminKey: Boolean(adminKey && adminKey.length > 0),
      }}
    >
      {children}
    </AdminKeyContext.Provider>
  )
}

export function useAdminKey(): AdminKeyContextType {
  const context = useContext(AdminKeyContext)
  if (!context) {
    throw new Error('useAdminKey must be used within an AdminKeyProvider')
  }
  return context
}
