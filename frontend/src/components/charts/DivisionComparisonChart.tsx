import React from 'react'
import type { DivisionMetricItem } from '../../api/types'

interface DivisionComparisonChartProps {
  data: DivisionMetricItem[]
  onSelectDivision?: (division: string) => void
}

export const DivisionComparisonChart: React.FC<DivisionComparisonChartProps> = ({
  data,
  onSelectDivision,
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No division groupings recorded in active dataset.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {data.map((div) => {
        const passPercent = div.student_count > 0 ? (div.passed_count / div.student_count) * 100 : 0
        const failPercent = div.student_count > 0 ? (div.failed_count / div.student_count) * 100 : 0
        const unresPercent = div.student_count > 0 ? (div.unresolved_count / div.student_count) * 100 : 0

        return (
          <div
            key={div.division}
            onClick={() => onSelectDivision?.(div.division)}
            style={{
              padding: '0.65rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              cursor: onSelectDivision ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
            className="hover-card"
          >
            {/* Division Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  Div {div.division}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {div.student_count} enrolled
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: div.pass_rate_percent >= 90 ? '#065f46' : '#92400e' }}>
                  {div.pass_rate_percent}% Pass
                </span>
              </div>
            </div>

            {/* Stacked Ratio Bar */}
            <div
              style={{
                display: 'flex',
                height: '10px',
                width: '100%',
                borderRadius: '5px',
                overflow: 'hidden',
                backgroundColor: '#f1f5f9',
                marginBottom: '0.35rem',
              }}
            >
              {passPercent > 0 && (
                <div
                  style={{
                    width: `${passPercent}%`,
                    backgroundColor: '#10b981',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Passed: ${div.passed_count} (${div.pass_rate_percent}%)`}
                />
              )}
              {failPercent > 0 && (
                <div
                  style={{
                    width: `${failPercent}%`,
                    backgroundColor: '#ef4444',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Failed: ${div.failed_count}`}
                />
              )}
              {unresPercent > 0 && (
                <div
                  style={{
                    width: `${unresPercent}%`,
                    backgroundColor: '#f59e0b',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Unresolved: ${div.unresolved_count}`}
                />
              )}
            </div>

            {/* Sub-counts */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>
                <strong style={{ color: '#065f46' }}>{div.passed_count}</strong> passed
              </span>
              <span>
                <strong style={{ color: '#991b1b' }}>{div.failed_count}</strong> failed
              </span>
              {div.unresolved_count > 0 && (
                <span>
                  <strong style={{ color: '#92400e' }}>{div.unresolved_count}</strong> unresolved
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
