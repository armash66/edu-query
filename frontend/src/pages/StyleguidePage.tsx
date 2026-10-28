import React, { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  GlassCard,
  Button,
  IconButton,
  Chip,
  StatusBadge,
  Tabs,
  SegmentedControl,
  Input,
  SearchField,
  Listbox,
  Modal,
  Drawer,
  useToast,
  Skeleton,
  EmptyState,
  ErrorState,
  ProgressBar,
  Stat,
  DataTable,
  OutcomeBar,
  DivisionComparison,
  FailureRateBar,
  Sparkline,
} from '../ui'
import { Sun, Moon, Laptop, Filter, Download, UserCheck } from 'lucide-react'

export const StyleguidePage: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const toast = useToast()

  // Component state demonstrations
  const [activeTab, setActiveTab] = useState('overview')
  const [segmentVal, setSegmentVal] = useState('pass')
  const [inputValue, setInputValue] = useState('')
  const [searchVal, setSearchVal] = useState('')
  const [listboxVal, setListboxVal] = useState('cse')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Demo data for DataTable
  const demoStudents = [
    { seat: 'CS101', name: 'John Doe', branch: 'Computer Science', percentage: 88.5, status: 'pass' },
    { seat: 'CS102', name: 'Jane Smith', branch: 'Computer Science', percentage: 92.0, status: 'pass' },
    { seat: 'EE201', name: 'Robert Lee', branch: 'Electrical Eng', percentage: 42.0, status: 'fail' },
    { seat: 'ME301', name: 'Emily Davis', branch: 'Mechanical Eng', percentage: 76.5, status: 'pass' },
    { seat: 'CV401', name: 'Michael Brown', branch: 'Civil Eng', percentage: 54.0, status: 'pass' },
    { seat: 'CV402', name: 'Sarah Wilson', branch: 'Civil Eng', percentage: 38.5, status: 'fail' },
  ]

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: '0.25rem',
              }}
            >
              Design System & Component Library
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              EduQuery "Monochrome Glass" design tokens, interactive UI primitives, accessible SVG charts,
              and status semantics (Active: {resolvedTheme}).
            </p>
          </div>

          {/* Theme Selector */}
          <div
            className="glass-2"
            style={{
              display: 'inline-flex',
              padding: '4px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border)',
            }}
          >
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
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          1. Strict Neutral Scale
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: '12px',
          }}
        >
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
            <div
              key={c.label}
              className="glass-1"
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  height: '48px',
                  borderRadius: 'var(--radius-xs)',
                  background: c.val,
                  border: '1px solid var(--border)',
                  marginBottom: '8px',
                }}
              />
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{c.label}</div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {c.hex}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Glass Surfaces */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          2. Frosted Glass Surfaces
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          <GlassCard variant="glass-1">
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>
              glass-1 (Subtle)
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Low opacity panel backdrop for large background surfaces and layout containers.
            </p>
          </GlassCard>

          <GlassCard variant="glass-2">
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>
              glass-2 (Standard)
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Default glass card surface for dashboards, charts, metric cards, and rosters.
            </p>
          </GlassCard>

          <GlassCard variant="glass-3">
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>
              glass-3 (Raised)
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Elevated high-opacity surface for modals, popovers, dropdown menus, and drawers.
            </p>
          </GlassCard>

          <GlassCard variant="data-surface">
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 650, marginBottom: '4px' }}>
              data-surface
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              High-opacity tabular background for dense marksheet tables and student rosters.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* 3. Buttons & Action Primitives */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          3. Buttons & Hitbox Standards (Min 44px)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <Button variant="primary" icon={<Download size={16} />}>
              Primary Action
            </Button>
            <Button variant="secondary" icon={<Filter size={16} />}>
              Secondary Action
            </Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Danger Action</Button>
            <Button variant="primary" loading>
              Loading State
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Sizes:</span>
            <Button size="sm" variant="secondary">
              Small (32px)
            </Button>
            <Button size="md" variant="secondary">
              Medium (40px)
            </Button>
            <Button size="lg" variant="secondary">
              Large (48px)
            </Button>
            <IconButton
              aria-label="Filter records"
              variant="secondary"
              icon={<Filter size={18} />}
            />
            <IconButton
              aria-label="Download records"
              variant="primary"
              icon={<Download size={18} />}
            />
          </div>
        </div>
      </section>

      {/* 4. Badges, Chips & Status Tones */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          4. Semantic Status Badges & Chips
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <StatusBadge tone="pass" label="Passed" />
            <StatusBadge tone="fail" label="Failed" />
            <StatusBadge tone="warn" label="Attention" />
            <StatusBadge tone="info" label="Verified" />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <Chip variant="default">Default Tag</Chip>
            <Chip variant="active">Active Filter</Chip>
            <Chip variant="pass" onRemove={() => toast.info('Removed Pass filter')}>
              Pass (Clearable)
            </Chip>
            <Chip variant="fail" onRemove={() => toast.info('Removed Fail filter')}>
              Fail (Clearable)
            </Chip>
            <Chip variant="warn">Warning Chip</Chip>
          </div>
        </div>
      </section>

      {/* 5. Navigation & Controls */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          5. Tabs, Segmented Controls & Selects
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <Tabs
              activeId={activeTab}
              onChange={setActiveTab}
              items={[
                { id: 'overview', label: 'Overview', count: '12' },
                { id: 'students', label: 'Students', count: '240' },
                { id: 'subjects', label: 'Subjects', count: '8' },
                { id: 'quality', label: 'Data Quality' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
            <SegmentedControl
              value={segmentVal}
              onChange={setSegmentVal}
              options={[
                { value: 'all', label: 'All' },
                { value: 'pass', label: 'Pass Only' },
                { value: 'fail', label: 'Failures' },
              ]}
            />

            <div style={{ width: '240px' }}>
              <Listbox
                value={listboxVal}
                onChange={setListboxVal}
                options={[
                  { value: 'cse', label: 'Computer Science & Eng' },
                  { value: 'ece', label: 'Electronics & Comm Eng' },
                  { value: 'mech', label: 'Mechanical Engineering' },
                  { value: 'civil', label: 'Civil Engineering' },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 6. Form Inputs & Search */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          6. Form Inputs & Search Fields
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          <SearchField
            label="Search Student Roster"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onClear={() => setSearchVal('')}
            placeholder="Search by seat or name..."
          />

          <Input
            label="Roll Number / Seat ID"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            clearable
            onClear={() => setInputValue('')}
            hint="Format: CS followed by 3 digits (e.g. CS101)"
          />

          <Input
            label="Invalid Field Demo"
            value="InvalidInput#"
            error="Only alphanumeric characters allowed"
          />
        </div>
      </section>

      {/* 7. Dialogs, Drawers & Notifications */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          7. Modals, Drawers & Toast Notifications
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
            Open Test Modal
          </Button>

          <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
            Open Test Drawer
          </Button>

          <Button
            variant="ghost"
            onClick={() => toast.success('Dataset Uploaded', 'Processed 342 records successfully.')}
          >
            Trigger Success Toast
          </Button>

          <Button
            variant="ghost"
            onClick={() => toast.error('Parsing Failed', 'Workbook missing required columns.')}
          >
            Trigger Error Toast
          </Button>
        </div>

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Student Grade Audit"
          description="Detailed breakdown of internal, external, and grace marks."
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setIsModalOpen(false)}>
                Confirm Action
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            This modal features full keyboard focus trapping, Escape key support, background scroll lock,
            and frosted glass styling.
          </p>
        </Modal>

        {/* Drawer */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Filter Roster"
          description="Refine marksheet records by division, status, or branch."
          footer={
            <Button variant="primary" fullWidth onClick={() => setIsDrawerOpen(false)}>
              Apply Filters
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Drawers are slide-over panels on desktop and bottom-sheets on mobile viewports.
            </p>
          </div>
        </Drawer>
      </section>

      {/* 8. KPI Stats & Skeletons */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          8. KPI Metrics & Skeletons
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <Stat
            label="Total Students"
            value="342"
            icon={<UserCheck size={18} />}
            subtext="Enrolled candidates in semester"
            delta={{ value: '+4.2%', direction: 'up' }}
          />

          <Stat
            label="Pass Percentage"
            value="84.6%"
            subtext="289 of 342 cleared all subjects"
            delta={{ value: '+1.8%', direction: 'up' }}
            chartSlot={<Sparkline data={[68, 72, 75, 78, 81, 84.6]} width={70} height={20} />}
          />

          <Stat
            label="Failure Rate"
            value="15.4%"
            subtext="53 students with active backlogs"
            delta={{ value: '-1.8%', direction: 'up' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Shimmer Skeletons:
          </span>
          <Skeleton variant="text" width="60%" height="20px" />
          <Skeleton variant="rectangular" width="100%" height="40px" />
        </div>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Progress Bars:
          </span>
          <ProgressBar value={68} max={100} showLabel label="Upload Progress" tone="pass" />
          <ProgressBar showLabel label="Processing Dataset (Indeterminate)..." />
        </div>
      </section>

      {/* 8b. Empty & Error States */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          8b. Feedback & Diagnostic States
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          <EmptyState
            title="No records matching filter"
            description="Try clearing search query or loosening division thresholds."
            action={<Button size="sm" variant="secondary">Clear Filters</Button>}
          />
          <ErrorState
            title="Failed to fetch marksheet"
            message="The upstream API server timed out while compiling analytics."
            onRetry={() => toast.info('Retrying connection...')}
          />
        </div>
      </section>

      {/* 9. Accessible SVG Charts */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          9. Accessible SVG Data Visualizations
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          <GlassCard variant="glass-2">
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>
              Outcome Distribution (Pass / Fail / Absent)
            </h3>
            <OutcomeBar passed={289} failed={45} absent={8} height={24} />
          </GlassCard>

          <GlassCard variant="glass-2">
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>
              Academic Division Breakdown
            </h3>
            <DivisionComparison
              divisions={[
                { division: 'First Class with Distinction', count: 98, tone: 'pass' },
                { division: 'First Class', count: 124, tone: 'pass' },
                { division: 'Second Class', count: 67, tone: 'warn' },
                { division: 'Fail / ATKT', count: 53, tone: 'fail' },
              ]}
            />
          </GlassCard>

          <GlassCard variant="glass-2" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: '16px' }}>
              Tiered Subject Failure Rates (Green &lt;5%, Amber 5-15%, Red &gt;15%)
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '12px',
              }}
            >
              <FailureRateBar
                subjectCode="CS501"
                subjectName="Database Systems"
                failureRate={3.2}
                failedStudents={11}
                totalStudents={342}
              />
              <FailureRateBar
                subjectCode="CS502"
                subjectName="Operating Systems"
                failureRate={9.6}
                failedStudents={33}
                totalStudents={342}
              />
              <FailureRateBar
                subjectCode="CS503"
                subjectName="Theory of Computation"
                failureRate={22.8}
                failedStudents={78}
                totalStudents={342}
              />
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 10. Data Table & States */}
      <section style={{ marginBottom: '3rem' }}>
        <h2
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 650,
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.5rem',
          }}
        >
          10. Accessible Data Table (Sorting, Density, Sticky Headers)
        </h2>
        <DataTable
          columns={[
            { key: 'seat', header: 'Seat ID', sortable: true, sticky: true },
            { key: 'name', header: 'Student Name', sortable: true },
            { key: 'branch', header: 'Department', sortable: true },
            {
              key: 'percentage',
              header: 'Score',
              sortable: true,
              render: (row) => (
                <span className="tabular-nums font-mono">{row.percentage.toFixed(1)}%</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (row) => (
                <StatusBadge
                  tone={row.status === 'pass' ? 'pass' : 'fail'}
                  label={row.status === 'pass' ? 'Pass' : 'Fail'}
                  size="sm"
                />
              ),
            },
          ]}
          data={demoStudents}
          keyExtractor={(row) => row.seat}
          onRowClick={(row) => toast.info(`Selected student: ${row.name} (${row.seat})`)}
        />
      </section>
    </div>
  )
}

export default StyleguidePage
