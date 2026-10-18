import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  total?: number
  limit?: number
  offset?: number
  totalItems?: number
  pageSize?: number
  currentPage?: number
  onPageChange: (newPageOrOffset: number) => void
}

export const Pagination: React.FC<PaginationProps> = ({
  total: propTotal,
  limit: propLimit,
  offset: propOffset,
  totalItems,
  pageSize,
  currentPage: propCurrentPage,
  onPageChange,
}) => {
  const actualTotal = totalItems !== undefined ? totalItems : (propTotal ?? 0)
  const actualLimit = pageSize !== undefined ? pageSize : (propLimit ?? 25)
  const isPageMode = propCurrentPage !== undefined

  if (actualTotal === 0) return null

  const currentPage = isPageMode
    ? propCurrentPage
    : Math.floor((propOffset ?? 0) / actualLimit) + 1
  const totalPages = Math.ceil(actualTotal / actualLimit) || 1

  const currentOffset = isPageMode
    ? (currentPage - 1) * actualLimit
    : (propOffset ?? 0)

  const startItem = currentOffset + 1
  const endItem = Math.min(currentOffset + actualLimit, actualTotal)

  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  const handlePrev = () => {
    if (isPageMode) {
      onPageChange(Math.max(1, currentPage - 1))
    } else {
      onPageChange(Math.max(0, currentOffset - actualLimit))
    }
  }

  const handleNext = () => {
    if (isPageMode) {
      onPageChange(Math.min(totalPages, currentPage + 1))
    } else {
      onPageChange(currentOffset + actualLimit)
    }
  }

  return (
    <div className="pagination" role="navigation" aria-label="Pagination">
      <div>
        Showing <span style={{ fontWeight: 600 }}>{startItem}</span> to{' '}
        <span style={{ fontWeight: 600 }}>{endItem}</span> of{' '}
        <span style={{ fontWeight: 600 }}>{actualTotal}</span> entries
      </div>
      <div className="pagination-controls">
        <button
          className="btn btn-secondary btn-sm"
          disabled={!hasPrev}
          onClick={handlePrev}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span style={{ padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 500 }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={!hasNext}
          onClick={handleNext}
          aria-label="Next page"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
