import React from 'react'
import type { ComponentState, HealthStatusLevel, SeverityLevel, SubjectResult } from '../api/types'

interface StatusBadgeProps {
  status:
    | SubjectResult
    | ComponentState
    | SeverityLevel
    | HealthStatusLevel
    | 'PASSES'
    | 'FAILS'
    | 'Good'
    | 'Needs Attention'
    | 'Critical'
    | 'activated'
    | 'preview_ready'
    | 'validation_failed'
    | string
  label?: string
  text?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, text }) => {
  const norm = String(status).toLowerCase()
  const customLabel = label || text

  let className = 'badge badge-neutral'
  let displayLabel = customLabel || status

  if (norm === 'passed' || norm === 'passes' || norm === 'good' || norm === 'activated') {
    className = 'badge badge-passed'
    if (!customLabel) displayLabel = norm === 'good' ? 'Good' : norm === 'passes' ? 'Passed' : norm === 'activated' ? 'Active' : 'Passed'
  } else if (norm === 'failed' || norm === 'fails' || norm === 'critical' || norm === 'error' || norm === 'validation_failed') {
    className = 'badge badge-failed'
    if (!customLabel) displayLabel = norm === 'critical' ? 'Critical' : norm === 'fails' ? 'Failed' : norm === 'error' ? 'Error' : 'Failed'
  } else if (norm === 'unresolved' || norm === 'warning' || norm === 'needs attention' || norm === 'preview_ready') {
    className = 'badge badge-unresolved'
    if (!customLabel) displayLabel = norm === 'needs attention' ? 'Needs Attention' : norm === 'preview_ready' ? 'Preview Ready' : norm === 'warning' ? 'Warning' : 'Unresolved'
  } else if (norm === 'info' || norm === 'marked') {
    className = 'badge badge-info'
    if (!customLabel) displayLabel = norm === 'marked' ? 'Marked' : 'Info'
  } else if (norm === 'flagged') {
    className = 'badge badge-unresolved'
    if (!customLabel) displayLabel = 'Flagged'
  } else if (norm === 'not_enrolled') {
    className = 'badge badge-neutral'
    if (!customLabel) displayLabel = 'Not Enrolled'
  } else if (norm === 'uncalculated') {
    className = 'badge badge-unresolved'
    if (!customLabel) displayLabel = 'Uncalculated'
  }

  return <span className={className}>{displayLabel}</span>
}
