import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getSessionStatus,
  uploadSession,
  createSampleSession,
  confirmSession as apiConfirmSession,
  deleteSession as apiDeleteSession,
  saveSession as apiSaveSession,
  clearSessionToken,
} from '../api/client'
import type {
  SessionStatusResponse,
  SessionUploadResponse,
  SessionConfirmResponse,
  SessionSaveResponse,
  SessionPreviewData,
} from '../api/types'

export interface SessionContextType {
  session: SessionStatusResponse | null
  preview: SessionPreviewData | null
  loading: boolean
  hasActiveSession: boolean
  isPreviewReady: boolean
  uploadMarksheet: (file: File) => Promise<SessionUploadResponse>
  loadSampleSession: () => Promise<SessionUploadResponse>
  confirmSession: () => Promise<SessionConfirmResponse>
  deleteSession: () => Promise<void>
  saveSession: (datasetName?: string) => Promise<SessionSaveResponse>
  refreshStatus: () => Promise<void>
  clearPreview: () => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionStatusResponse | null>(null)
  const [preview, setPreview] = useState<SessionPreviewData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSessionStatus()
      setSession(status)
      if (status.preview) {
        setPreview(status.preview)
      }
      if (!status.active && status.state !== 'preview_ready') {
        clearSessionToken()
      }
    } catch {
      setSession(null)
      setPreview(null)
      clearSessionToken()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const uploadMarksheet = async (file: File): Promise<SessionUploadResponse> => {
    const res = await uploadSession(file)
    setPreview(res.preview)
    setSession({
      active: false,
      state: res.state,
      session_id: res.session_id,
      mode: res.mode,
      filename: res.filename,
      students_count: res.students_count,
      courses_count: res.courses_count,
      preview: res.preview,
      can_confirm: res.can_confirm,
      blocking_errors: res.blocking_errors,
    })
    return res
  }

  const loadSampleSession = async (): Promise<SessionUploadResponse> => {
    const res = await createSampleSession()
    setPreview(res.preview)
    setSession({
      active: false,
      state: res.state,
      session_id: res.session_id,
      mode: res.mode,
      filename: res.filename,
      students_count: res.students_count,
      courses_count: res.courses_count,
      preview: res.preview,
      can_confirm: res.can_confirm,
      blocking_errors: res.blocking_errors,
    })
    return res
  }

  const confirmSession = async (): Promise<SessionConfirmResponse> => {
    const res = await apiConfirmSession(session?.session_id)
    setSession((prev) => ({
      active: true,
      state: 'active',
      session_id: res.session_id,
      mode: res.mode,
      filename: prev?.filename,
      students_count: res.students_count,
      courses_count: res.courses_count,
      preview: prev?.preview,
    }))
    return res
  }

  const deleteSession = async (): Promise<void> => {
    try {
      await apiDeleteSession(session?.session_id)
    } catch {
      // Idempotent
    } finally {
      clearSessionToken()
      try {
        sessionStorage.clear()
        // Retain theme preference if stored
        const theme = localStorage.getItem('eduquery_theme')
        localStorage.clear()
        if (theme) localStorage.setItem('eduquery_theme', theme)
      } catch {
        // Ignore
      }
      setSession(null)
      setPreview(null)
    }
  }

  const saveSession = async (datasetName?: string): Promise<SessionSaveResponse> => {
    const res = await apiSaveSession(datasetName)
    setSession((prev) => ({
      ...prev,
      active: true,
      mode: 'persistent',
      session_id: res.dataset_id,
      students_count: res.students_count,
      courses_count: res.courses_count,
    }))
    return res
  }

  const clearPreview = () => {
    setPreview(null)
    if (session?.state === 'preview_ready') {
      deleteSession()
    }
  }

  const hasActiveSession = Boolean(session?.active)
  const isPreviewReady = Boolean(session?.state === 'preview_ready' && preview)

  return (
    <SessionContext.Provider
      value={{
        session,
        preview,
        loading,
        hasActiveSession,
        isPreviewReady,
        uploadMarksheet,
        loadSampleSession,
        confirmSession,
        deleteSession,
        saveSession,
        refreshStatus,
        clearPreview,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
