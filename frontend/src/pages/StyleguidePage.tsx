import React from 'react'
import { useTheme } from '../context/ThemeContext'
import { CheckCircle2, AlertTriangle, XCircle, Info, Sun, Moon, Laptop } from 'lucide-react'

export const StyleguidePage: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              Design System & Styleguide
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              EduQuery "Monochrome Glass" design tokens, typography, glass surfaces, and status semantics (Active: {resolvedTheme}).
            </p>
          </div>

          {/* Theme Selector */}
          <div className="glass-2" style={{ display: 'inline-flex', padding: '4px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  background: theme === t ? 'var(--action-primary-bg)' : 'transparent',
                  color: theme === t ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                }}
              >
                {t === 'light' && <Sun size={14} />}
                {t === 'dark' && <Moon size={14} />}
                {t === 'system' && <Laptop size={14} />}
                <span>{t}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 1. Neutral Scale */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 650, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          1. Strict Neutral Scale
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px' }}>
          {[
            { label: 'neutral-0', val: '#ffffff', hex: '#FFFFFF' },
            { label: 'neutral-50', val: '#f5f5f5', hex: '#F5F5F5' },
            { label: 'neutral-100', val: '#ebebeb', hex: '#EBEBEB' },
            { label: 'neutral-300', val: '#bdbdbd', hex: '#BDBDBD' },
            { label: 'neutral-500', val: '#737373', hex: '#737373' },
            { label: 'neutral-700', val: '#404040', hex: '#404040' },
            { label: 'neutral-900', val: '#171717', hex: '#171717' },
            { label: 'neutral-1000', val: '#000000', hex: '#000000' },
          ].map((c) => (
            <div key={c.label} className="glass-1" style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ height: '48px', borderRadius: 'var(--radius-xs)', background: c.val, border: '1px solid var(--border)', marginBottom: '8px' }} />
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{c.hex}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Glass Surfaces */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 650, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          2. Frosted Glass Family
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="glass-1" style={{ padding: '24px', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>glass-1 (Subtle)</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Low opacity panel backdrop for large background surfaces and layout containers.
            </p>
          </div>

          <div className="glass-2" style={{ padding: '24px', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>glass-2 (Standard)</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Default glass card surface for dashboards, charts, metric cards, and rosters.
            </p>
          </div>

          <div className="glass-3" style={{ padding: '24px', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>glass-3 (Raised)</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Elevated high-opacity surface for modals, popovers, dropdown menus, and drawers.
            </p>
          </div>

          <div className="data-surface" style={{ padding: '24px', borderRadius: 'var(--radius-card)' }}>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>data-surface</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              High-opacity tabular background for dense marksheet tables and student rosters.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Status Semantics */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 650, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          3. Semantic Status Indicators
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--status-success-bg)',
            color: 'var(--status-success-text)',
            border: '1px solid var(--status-success-border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 650,
          }}>
            <CheckCircle2 size={14} />
            <span>Passed / Verified</span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--status-danger-bg)',
            color: 'var(--status-danger-text)',
            border: '1px solid var(--status-danger-border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 650,
          }}>
            <XCircle size={14} />
            <span>Failed / Error</span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--status-warning-bg)',
            color: 'var(--status-warning-text)',
            border: '1px solid var(--status-warning-border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 650,
          }}>
            <AlertTriangle size={14} />
            <span>Attention / Absent</span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--status-info-bg)',
            color: 'var(--status-info-text)',
            border: '1px solid var(--status-info-border)',
            fontSize: 'var(--text-xs)',
            fontWeight: 650,
          }}>
            <Info size={14} />
            <span>Information</span>
          </div>
        </div>
      </section>
    </div>
  )
}
export default StyleguidePage
