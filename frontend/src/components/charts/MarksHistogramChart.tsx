import React from 'react'
import type { DistributionBucket, GradeFrequency } from '../../api/types'

interface MarksHistogramChartProps {
  buckets: DistributionBucket[]
  grades: GradeFrequency[]
  totalRecords: number
  onSelectBucket?: (bucket: DistributionBucket) => void
  onSelectGrade?: (grade: GradeFrequency) => void
}

export const MarksHistogramChart: React.FC<MarksHistogramChartProps> = ({
  buckets,
  grades,
  totalRecords,
  onSelectBucket,
  onSelectGrade,
}) => {
  if (!buckets || buckets.length === 0 || totalRecords === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No numeric marks recorded for score distribution analysis.
      </div>
    )
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Histogram Bar Chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '140px', padding: '0.5rem 0 1.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
        {buckets.map((b) => {
          const heightPercent = Math.max(4, (b.count / maxCount) * 100)
          const isFailing = b.max_val < 40

          return (
            <div
              key={b.label}
              onClick={() => onSelectBucket && onSelectBucket(b)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                position: 'relative',
                cursor: onSelectBucket ? 'pointer' : 'default',
              }}
              title={`${b.label}: ${b.count} of ${totalRecords} records (${((b.count / totalRecords) * 100).toFixed(1)}%)${onSelectBucket ? ' — Click to filter' : ''}`}
            >
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                {b.count > 0 ? b.count : ''}
              </span>
              <div
                style={{
                  width: '100%',
                  height: `${heightPercent}%`,
                  backgroundColor: isFailing ? '#fecaca' : '#bfdbfe',
                  border: `1px solid ${isFailing ? '#ef4444' : '#3b82f6'}`,
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.2s ease, opacity 0.2s ease',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1.25rem',
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {b.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Grade Letter Breakdown Strip */}
      {grades && grades.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Awarded Letter Grades
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {grades.map((g) => {
              const isFail = g.grade.toUpperCase() === 'F' || g.grade.toUpperCase() === 'FAIL'
              return (
                <div
                  key={g.grade}
                  onClick={() => onSelectGrade && onSelectGrade(g)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isFail ? '#fee2e2' : '#f1f5f9',
                    border: `1px solid ${isFail ? '#fca5a5' : '#cbd5e1'}`,
                    fontSize: '0.74rem',
                    cursor: onSelectGrade ? 'pointer' : 'default',
                  }}
                  title={`${g.grade}: ${g.count} students (${g.percentage}%)${onSelectGrade ? ' — Click to filter' : ''}`}
                >
                  <strong style={{ color: isFail ? '#991b1b' : 'var(--text-main)' }}>{g.grade}:</strong>
                  <span style={{ color: 'var(--text-sub)' }}>{g.count}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>({g.percentage}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
