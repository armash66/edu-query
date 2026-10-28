import React, { useState } from 'react'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { SegmentedControl } from './SegmentedControl'
import { Button } from './Button'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T, index: number) => React.ReactNode
  sortable?: boolean
  sortValue?: (row: T) => string | number
  width?: string | number
  align?: 'left' | 'center' | 'right'
  sticky?: boolean
  hideOnMobile?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T, index: number) => string | number
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  initialSortKey?: string
  initialSortDirection?: 'asc' | 'desc'
  pageSize?: number
  showDensityToggle?: boolean
  defaultDensity?: 'comfortable' | 'compact'
  showPagination?: boolean
  className?: string
  style?: React.CSSProperties
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No data available',
  emptyDescription = 'There are no records matching your criteria.',
  onRowClick,
  initialSortKey,
  initialSortDirection = 'asc',
  pageSize = 25,
  showDensityToggle = true,
  defaultDensity = 'comfortable',
  showPagination = true,
  className = '',
  style,
}: DataTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDirection)
  const [density, setDensity] = useState<'comfortable' | 'compact'>(defaultDensity)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Handle column sort toggle
  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return
    if (sortKey === col.key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col.key)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  // Sorting
  const sortedData = React.useMemo(() => {
    if (!sortKey) return data

    const column = columns.find((c) => c.key === sortKey)
    if (!column) return data

    return [...data].sort((a, b) => {
      let valA: any
      let valB: any

      if (column.sortValue) {
        valA = column.sortValue(a)
        valB = column.sortValue(b)
      } else {
        valA = (a as any)[column.key]
        valB = (b as any)[column.key]
      }

      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })
  }, [data, sortKey, sortDir, columns])

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1
  const paginatedData = React.useMemo(() => {
    if (!showPagination) return sortedData
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize, showPagination])

  const rowHeight = density === 'comfortable' ? '54px' : '38px'
  const cellPadding =
    density === 'comfortable' ? 'var(--space-3) var(--space-4)' : 'var(--space-1) var(--space-3)'

  return (
    <div
      className={`glass-2 ${className}`.trim()}
      style={{
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* Controls Bar */}
      {showDensityToggle && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-hover)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            {sortedData.length} records
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Density:</span>
            <SegmentedControl<'comfortable' | 'compact'>
              size="sm"
              value={density}
              onChange={setDensity}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Table Container */}
      <div
        style={{
          overflowX: 'auto',
          position: 'relative',
          width: '100%',
        }}
      >
        <table className="responsive-data-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            fontSize: density === 'comfortable' ? 'var(--text-sm)' : 'var(--text-xs)',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-strong)',
                background: 'var(--surface-hover)',
              }}
            >
              {columns.map((col, cIdx) => {
                const isSticky = col.sticky !== undefined ? col.sticky : cIdx === 0
                const isSorted = sortKey === col.key
                const sortAria = isSorted
                  ? sortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : col.sortable
                  ? 'none'
                  : undefined

                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={sortAria}
                    onClick={() => handleSort(col)}
                    className={isSticky ? 'table-sticky-col' : undefined}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: isSticky ? 4 : 2,
                      left: isSticky ? 0 : undefined,
                      padding: cellPadding,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontSize: 'var(--text-xs)',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      width: col.width,
                      textAlign: col.align || 'left',
                      background: 'var(--surface-hover)',
                      boxShadow: isSticky ? '2px 0 4px var(--border)' : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                      }}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span
                          style={{
                            display: 'inline-flex',
                            color: isSorted ? 'var(--text)' : 'var(--text-muted)',
                            opacity: isSorted ? 1 : 0.4,
                          }}
                          aria-hidden="true"
                        >
                          {isSorted && sortDir === 'asc' ? '▲' : isSorted ? '▼' : '⇅'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, rIdx) => (
                <tr
                  key={`skeleton-row-${rIdx}`}
                  style={{
                    borderBottom: '1px solid var(--border-hairline)',
                    height: rowHeight,
                  }}
                >
                  {columns.map((_, cIdx) => (
                    <td key={`sk-${rIdx}-${cIdx}`} style={{ padding: cellPadding }}>
                      <Skeleton variant="text" width={cIdx === 0 ? '60%' : '80%'} height="16px" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 'var(--space-8)' }}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => {
                const rowKey = keyExtractor(row, rIdx)

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    style={{
                      borderBottom: '1px solid var(--border-hairline)',
                      height: rowHeight,
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (onRowClick) e.currentTarget.style.background = 'var(--surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (onRowClick) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {columns.map((col, cIdx) => {
                      const isSticky = col.sticky !== undefined ? col.sticky : cIdx === 0
                      return (
                        <td
                          key={col.key}
                          data-label={col.header}
                          className={isSticky ? 'table-sticky-col' : undefined}
                          style={{
                            padding: cellPadding,
                            color: 'var(--text)',
                            textAlign: col.align || 'left',
                            whiteSpace: 'nowrap',
                            position: isSticky ? 'sticky' : undefined,
                            left: isSticky ? 0 : undefined,
                            zIndex: isSticky ? 1 : undefined,
                            background: isSticky ? 'var(--surface-card)' : 'transparent',
                            boxShadow: isSticky ? '2px 0 4px var(--border)' : undefined,
                          }}
                        >
                          {col.render
                            ? col.render(row, rIdx)
                            : (row as any)[col.key] !== undefined
                            ? String((row as any)[col.key])
                            : '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {showPagination && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <span
            className="tabular-nums"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
            }}
          >
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              Previous
            </Button>
            <span
              className="tabular-nums"
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text)',
                padding: '0 var(--space-2)',
              }}
            >
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
