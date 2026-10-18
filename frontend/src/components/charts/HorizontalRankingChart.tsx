import React from 'react'
import type { TopFailingCourseItem } from '../../api/types'

interface HorizontalRankingChartProps {
  data: TopFailingCourseItem[]
  onSelectCourse?: (courseCode: string) => void
}

export const HorizontalRankingChart: React.FC<HorizontalRankingChartProps> = ({
  data,
  onSelectCourse,
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No course failure records detected in this marksheet cohort.
      </div>
    )
  }

  // Find max rate for relative scaling
  const maxRate = Math.max(...data.map((c) => c.failure_rate_percent), 10.0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
      {data.map((course) => {
        const barWidthPercent = Math.min(100, Math.max(4, (course.failure_rate_percent / maxRate) * 100))

        return (
          <div
            key={course.course_code}
            onClick={() => onSelectCourse?.(course.course_code)}
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              cursor: onSelectCourse ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
            className="hover-card"
          >
            {/* Header: Course Code & Name, and Metrics */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', gap: '0.5rem' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.82rem', marginRight: '0.4rem', fontFamily: 'monospace' }}>
                  {course.course_code}
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 500 }} title={course.course_name}>
                  {course.course_name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#991b1b',
                    backgroundColor: '#fee2e2',
                    padding: '0.15rem 0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'monospace',
                  }}
                >
                  {course.failed_count} fails ({course.failure_rate_percent}%)
                </span>
              </div>
            </div>

            {/* Visual Bar Track */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  flexGrow: 1,
                  height: '8px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${barWidthPercent}%`,
                    height: '100%',
                    backgroundColor: course.failure_rate_percent >= 20 ? '#ef4444' : '#f59e0b',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                {course.failed_count} of {course.enrolled_count}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
