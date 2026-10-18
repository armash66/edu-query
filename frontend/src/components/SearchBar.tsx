import React, { useState, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (newValue: string) => void
  placeholder?: string
  loading?: boolean
  debounceMs?: number
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search by name, roll no, seat no, or ID...',
  loading = false,
  debounceMs = 300,
}) => {
  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (internalValue !== value) {
        onChange(internalValue)
      }
    }, debounceMs)

    return () => clearTimeout(handler)
  }, [internalValue, onChange, value, debounceMs])

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
      <Search
        size={18}
        style={{
          position: 'absolute',
          left: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#94a3b8',
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        className="form-control"
        style={{ paddingLeft: '2.4rem', paddingRight: '2.2rem' }}
        placeholder={placeholder}
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        aria-label={placeholder}
      />
      {loading ? (
        <Loader2
          size={16}
          className="spinner"
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#64748b',
          }}
        />
      ) : internalValue ? (
        <button
          type="button"
          onClick={() => {
            setInternalValue('')
            onChange('')
          }}
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  )
}
