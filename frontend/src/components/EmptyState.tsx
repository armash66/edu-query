import React from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  message?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description,
  message,
  icon,
  action,
}) => {
  const text = description || message || 'No items matched your current filter criteria.'
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <Inbox size={48} />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-text">{text}</p>
      {action && <div>{action}</div>}
    </div>
  )
}
