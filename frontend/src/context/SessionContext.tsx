import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  getSessionStatus,
  uploadSession,
  createSampleSession,
  confirmSession as apiConfirmSession,
  deleteSession as apiDeleteSession,
  saveSession as apiSaveSession,
  setSessionToken,
  clearSessionToken,
  ApiError,
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
  isRestoring: boolean
  restorationError: string | null
  hasActiveSession: boolean
  isPreviewReady: boolean
  uploadMarksheet: (file: File) => Promise<SessionUploadResponse>
  loadSampleSession: () => Promise<SessionUploadResponse>
  confirmSession: () => Promise<SessionConfirmResponse>
  deleteSession: () => Promise<void>
  saveSession: (datasetName?: string) => Promise<SessionSaveResponse>
  refreshStatus: (forceToken?: string) => Promise<void>
  retryRestoration: () => Promise<void>
  clearPreview: () => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionStatusResponse | null>(null)
  const [preview, setPreview] = useState<SessionPreviewData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [isRestoring, setIsRestoring] = useState<boolean>(false)
  const [restorationError, setRestorationError] = useState<string | null>(null)

  // Request generation sequence to prevent late background restoration from overwriting newer uploads
  const mutationSeqRef = useRef<number>(0)

  const refreshStatus = useCallback(async (forceToken?: string) => {
    const seq = ++mutationSeqRef.current
    setIsRestoring(true)
    setRestorationError(null)

    try {
      const options = forceToken ? { sessionToken: forceToken } : undefined
      const status = await getSessionStatus(options)

      // If user uploaded a new marksheet or initiated another mutation while this request was in flight, discard
      if (mutationSeqRef.current !== seq) return

      setSession(status)
      if (status.session_id && (status.active || status.state === 'preview_ready')) {
        setSessionToken(status.session_id)
      }
      if (status.preview) {
        setPreview(status.preview)
      }
      // If the backend explicitly returned 200 indicating session is inactive and not preview_ready, clear token
      if (!status.active && status.state !== 'preview_ready') {
        clearSessionToken()
      }
      setRestorationError(null)
    } catch (err: unknown) {
      if (mutationSeqRef.current !== seq) return

      // Do NOT clear session token on network errors or timeouts!
      // Only clear if server explicitly responded with 401 Unauthorized or 404 Not Found
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        setSession(null)
        setPreview(null)
        clearSessionToken()
        setRestorationError(null)
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        // Aborted - do nothing
      } else {
        // Temporary network or timeout error (e.g. Render spin-up)
        const msg = err instanceof ApiError ? err.message : 'Server unavailable or waking up.'
        setRestorationError(msg)
        // Keep existing token so user or background can retry
      }
    } finally {
      if (mutationSeqRef.current === seq) {
        setIsRestoring(false)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const retryRestoration = useCallback(async () => {
    await refreshStatus()
  }, [refreshStatus])

  const uploadMarksheet = async (file: File): Promise<SessionUploadResponse> => {
    // Invalidate any in-flight session restoration requests immediately
    mutationSeqRef.current++
    setIsRestoring(false)
    setRestorationError(null)

    const res = await uploadSession(file)
    if (res.session_id) {
      setSessionToken(res.session_id)
    }
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
    mutationSeqRef.current++
    setIsRestoring(false)
    setRestorationError(null)

    const res = await createSampleSession()
    if (res.session_id) {
      setSessionToken(res.session_id)
    }
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
    if (res.session_id) {
      setSessionToken(res.session_id)
    }
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
    mutationSeqRef.current++
    setIsRestoring(false)
    setRestorationError(null)
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
        isRestoring,
        restorationError,
        hasActiveSession,
        isPreviewReady,
        uploadMarksheet,
        loadSampleSession,
        confirmSession,
        deleteSession,
        saveSession,
        refreshStatus,
        retryRestoration,
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
    return {
      session: null,
      preview: null,
      loading: false,
      isRestoring: false,
      restorationError: null,
      hasActiveSession: false,
      isPreviewReady: false,
      uploadMarksheet: async () => ({} as any),
      loadSampleSession: async () => ({} as any),
      confirmSession: async () => ({} as any),
      deleteSession: async () => {},
      saveSession: async () => ({} as any),
      refreshStatus: async () => {},
      retryRestoration: async () => {},
      clearPreview: () => {},
    }
  }
  return context
}
