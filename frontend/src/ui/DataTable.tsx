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
  minWidth?: string | number
  maxWidth?: string | number
  align?: 'left' | 'center' | 'right'
  sticky?: boolean
  hideOnMobile?: boolean
  wrap?: boolean
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
  onSortChange?: (sortKey: string, sortDir: 'asc' | 'desc') => void
  pageSize?: number
  showDensityToggle?: boolean
  defaultDensity?: 'comfortable' | 'compact'
  showPagination?: boolean
  serverTotal?: number
  currentPage?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
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
  onSortChange,
  pageSize = 25,
  showDensityToggle = true,
  defaultDensity = 'comfortable',
  showPagination = true,
  serverTotal,
  currentPage: propsCurrentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className = '',
  style,
}: DataTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialSortDirection)
  const [density, setDensity] = useState<'comfortable' | 'compact'>(defaultDensity)
  const [internalPage, setInternalPage] = useState<number>(1)

  const isServerPaged = serverTotal !== undefined
  const activePage = isServerPaged && propsCurrentPage !== undefined ? propsCurrentPage : internalPage

  const handlePageChange = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage)
    }
    setInternalPage(newPage)
  }

  // Handle column sort toggle
  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return
    const nextDir = sortKey === col.key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
    setSortKey(col.key)
    setSortDir(nextDir)
    if (onSortChange) {
      onSortChange(col.key, nextDir)
    }
    handlePageChange(1)
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
  const totalCount = isServerPaged ? serverTotal : sortedData.length
  const totalPages = Math.ceil(totalCount / pageSize) || 1
  const paginatedData = React.useMemo(() => {
    if (isServerPaged || !showPagination) return sortedData
    const start = (activePage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [isServerPaged, sortedData, activePage, pageSize, showPagination])

  const rowHeight = density === 'comfortable' ? '54px' : '38px'
  const cellPadding =
    density === 'comfortable' ? '12px 12px' : '8px 10px'

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
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
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
            {isServerPaged ? `${totalCount} total records` : `${sortedData.length} records`}
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
        className="glass-scrollbar"
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
                      ...(cIdx === 0 ? { paddingLeft: '18px' } : {}),
                      ...(cIdx === columns.length - 1 ? { paddingRight: '18px' } : {}),
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontSize: 'var(--text-xs)',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      width: col.width,
                      minWidth: col.minWidth || col.width,
                      maxWidth: col.maxWidth,
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
                      ...(cIdx === 0 ? { paddingLeft: '18px' } : {}),
                      ...(cIdx === columns.length - 1 ? { paddingRight: '18px' } : {}),
                            color: 'var(--text)',
                            width: col.width,
                            minWidth: col.minWidth || col.width,
                            maxWidth: col.maxWidth,
                            textAlign: col.align || 'left',
                            whiteSpace: col.wrap ? 'normal' : 'nowrap',
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
      {showPagination && (totalPages > 1 || isServerPaged) && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span
              className="tabular-nums"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}
            >
              Showing {totalCount === 0 ? 0 : (activePage - 1) * pageSize + 1}–
              {Math.min(activePage * pageSize, totalCount)} of {totalCount} records
            </span>

            {onPageSizeChange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-card)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                  aria-label="Records per page"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={activePage <= 1}
              onClick={() => handlePageChange(Math.max(1, activePage - 1))}
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
              Page {activePage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={activePage >= totalPages}
              onClick={() => handlePageChange(Math.min(totalPages, activePage + 1))}
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
