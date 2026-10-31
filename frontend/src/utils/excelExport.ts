import type { AbsentStudentItem, StudentSummaryItem, SubjectStudentItem } from '../api/types'

export interface ExcelCell {
  v: string | number
  t: 's' | 'n' | 'b'
}

export interface WorkSheet {
  [cellRef: string]: ExcelCell | any
  '!cols'?: { wch: number }[]
}

export interface WorkBook {
  SheetNames: string[]
  Sheets: Record<string, WorkSheet>
}

export interface ExcelColumn<T = any> {
  header: string
  key?: keyof T | string
  width?: number
  type?: 'string' | 'number' | 'date'
  getValue?: (item: T, index: number) => any
}

export interface ExcelExportOptions<T = any> {
  filename: string
  sheetName?: string
  columns: ExcelColumn<T>[]
  data: T[]
  metadataRows?: (string | number | null | undefined)[][]
}

export function colToLetter(c: number): string {
  let s = ''
  let temp = c
  while (temp >= 0) {
    s = String.fromCharCode((temp % 26) + 65) + s
    temp = Math.floor(temp / 26) - 1
  }
  return s
}

export function encodeCell(pos: { r: number; c: number }): string {
  return `${colToLetter(pos.c)}${pos.r + 1}`
}

export function sanitizeSheetName(name: string, fallback = 'Sheet1'): string {
  if (!name || !name.trim()) return fallback
  const cleaned = name.replace(/[\\/?*[\]:]/g, '_').trim().slice(0, 31)
  return cleaned || fallback
}

export function sanitizeFilename(filename: string, fallback = 'EduQuery_Export.csv'): string {
  let name = (filename || fallback).trim().replace(/[\\/:*?"<>|]/g, '_')
  if (name.toLowerCase().endsWith('.xlsx')) {
    name = name.slice(0, -5) + '.csv'
  }
  if (!name.toLowerCase().endsWith('.csv')) {
    name += '.csv'
  }
  return name
}

/**
 * Formula-safe CSV cell escaping (RFC 4180 compliant with formula injection protection).
 * Neutralizes leading '=', '+', '-', '@', '\t', '\r' by prefixing single-quote.
 */
export function formatReason(reason?: string | null): string {
  if (!reason) return ''
  const upper = reason.trim().toUpperCase()
  if (upper === 'PASSING_LETTER_GRADE' || upper === 'PASSING_GRADE_WITH_ABSENT_COMPONENT' || upper === 'PASS' || upper === 'PASSED') {
    return 'Pass'
  }
  if (upper === 'FAILING_LETTER_GRADE' || upper === 'EXPLICIT_FAIL_FLAG' || upper === 'FAIL' || upper === 'FAILED') {
    return 'Fail'
  }
  if (upper === 'ABSENT_IN_ASSESSMENT' || upper === 'ABSENT') {
    return 'Absent'
  }
  if (upper === 'CONFLICTING_RESULT_INDICATORS') {
    return 'Conflicting Indicators'
  }
  return reason
}

export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}

export function createWorksheet<T>(
  data: T[],
  columns: ExcelColumn<T>[],
  metadataRows?: (string | number | null | undefined)[][]
): WorkSheet {
  const ws: WorkSheet = {}
  const aoa: (string | number)[][] = []

  // Add optional metadata rows (e.g. title, summary, timestamp)
  if (metadataRows && metadataRows.length > 0) {
    for (const metaRow of metadataRows) {
      aoa.push(metaRow.map((cell) => (cell === null || cell === undefined ? '' : cell)))
    }
  }

  // Header row
  aoa.push(columns.map((col) => col.header))

  // Data rows
  const dataStartRowIdx = aoa.length
  const safeData = Array.isArray(data) ? data : []

  for (let i = 0; i < safeData.length; i++) {
    const item = safeData[i]
    const rowValues = columns.map((col) => {
      let val: any
      if (col.getValue) {
        val = col.getValue(item, i)
      } else if (col.key) {
        val = (item as any)[col.key]
      } else {
        val = ''
      }

      if (val === null || val === undefined) {
        return ''
      }

      if (col.type === 'number') {
        if (typeof val === 'number') return isNaN(val) ? '' : val
        const parsed = Number(val)
        return isNaN(parsed) ? String(val) : parsed
      }

      if (col.type === 'string') {
        return String(val)
      }

      if (typeof val === 'number') {
        return val
      }
      return String(val)
    })
    aoa.push(rowValues)
  }

  // Populate cell map
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r]
    for (let c = 0; c < row.length; c++) {
      const val = row[c]
      const cellRef = encodeCell({ r, c })
      const isHeaderOrMeta = r < dataStartRowIdx
      const colDef = columns[c]

      if (isHeaderOrMeta) {
        ws[cellRef] = { v: String(val), t: 's' }
      } else {
        if (colDef && colDef.type === 'string') {
          ws[cellRef] = { v: String(val ?? ''), t: 's' }
        } else if (typeof val === 'number') {
          ws[cellRef] = { v: val, t: 'n' }
        } else {
          ws[cellRef] = { v: String(val ?? ''), t: 's' }
        }
      }
    }
  }

  // Compute column widths
  ws['!cols'] = columns.map((col, cIdx) => {
    let maxLen = col.header.length
    if (col.width) {
      maxLen = Math.max(maxLen, col.width)
    }
    const sampleLimit = Math.min(safeData.length, 50)
    for (let r = 0; r < sampleLimit; r++) {
      const rowIndex = dataStartRowIdx + r
      const cellRef = encodeCell({ r: rowIndex, c: cIdx })
      const cell = ws[cellRef]
      if (cell && cell.v !== undefined && cell.v !== null) {
        maxLen = Math.max(maxLen, String(cell.v).length)
      }
    }
    return { wch: Math.max(maxLen + 3, 10) }
  })

  return ws
}

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.position = 'fixed'
  a.style.left = '-9999px'
  a.style.top = '-9999px'
  a.style.opacity = '0'
  a.href = url
  a.download = filename
  a.setAttribute('download', filename)
  document.body.appendChild(a)

  try {
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  } catch {
    a.click()
  }

  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a)
    }
  }, 1000)

  setTimeout(() => {
    window.URL.revokeObjectURL(url)
  }, 60000)
}

/**
 * Clean UTF-8 formula-safe CSV generator (replaces legacy XML-2003 generator).
 * Produces genuine RFC 4180 CSV with UTF-8 BOM so Microsoft Excel opens it seamlessly.
 */
export function generateCsv(ws: WorkSheet): string {
  const cellKeys = Object.keys(ws).filter((k) => !k.startsWith('!'))
  const rowsMap = new Map<number, { col: number; cell: ExcelCell }[]>()

  for (const key of cellKeys) {
    const match = key.match(/^([A-Z]+)(\d+)$/)
    if (!match) continue
    const colStr = match[1]
    const rowNum = parseInt(match[2], 10) - 1

    let c = 0
    for (let i = 0; i < colStr.length; i++) {
      c = c * 26 + (colStr.charCodeAt(i) - 64)
    }
    const colIdx = c - 1

    if (!rowsMap.has(rowNum)) rowsMap.set(rowNum, [])
    rowsMap.get(rowNum)!.push({ col: colIdx, cell: ws[key] })
  }

  const sortedRowIndices = Array.from(rowsMap.keys()).sort((a, b) => a - b)
  let csv = '\uFEFF' // UTF-8 Byte Order Mark for Excel

  for (const r of sortedRowIndices) {
    const cells = rowsMap.get(r)!.sort((a, b) => a.col - b.col)
    const maxCol = cells.length > 0 ? Math.max(...cells.map((c) => c.col)) : 0
    const rowVals = new Array(maxCol + 1).fill('""')
    for (const { col, cell } of cells) {
      rowVals[col] = sanitizeCsvCell(cell.v)
    }
    csv += rowVals.join(',') + '\r\n'
  }

  return csv
}

export function exportToExcel<T>(options: ExcelExportOptions<T>): {
  workbook: WorkBook
  blob: Blob
  filename: string
} {
  const filename = sanitizeFilename(options.filename)
  const sheetName = sanitizeSheetName(options.sheetName || 'Sheet1')
  const ws = createWorksheet(options.data || [], options.columns, options.metadataRows)
  const wb: WorkBook = {
    SheetNames: [sheetName],
    Sheets: {
      [sheetName]: ws,
    },
  }

  const csv = generateCsv(ws)
  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  })

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    downloadBlobFile(blob, filename)
  }

  return { workbook: wb, blob, filename }
}

export function exportStudentsRoster(
  students: StudentSummaryItem[],
  isFiltered: boolean = false
): { workbook: WorkBook; blob: Blob; filename: string } {
  const filename = isFiltered ? 'EduQuery_Students_Filtered.csv' : 'EduQuery_Students.csv'
  const columns: ExcelColumn<StudentSummaryItem>[] = [
    { header: 'Roll No', key: 'roll_no', type: 'string', width: 14, getValue: (s) => s.roll_no ?? s.student_id },
    { header: 'Seat No', key: 'seat_no', type: 'string', width: 14, getValue: (s) => s.seat_no ?? '' },
    { header: 'Student Name', key: 'name', type: 'string', width: 30 },
    { header: 'Division', key: 'division', type: 'string', width: 10, getValue: (s) => s.division ?? '' },
    { header: 'Total Marks', key: 'total_marks', type: 'number', width: 14, getValue: (s) => s.total_marks ?? '' },
    { header: 'Overall Outcome', key: 'overall_result', type: 'string', width: 16, getValue: (s) => s.overall_result ?? '' },
    { header: 'Passed Subjects', key: 'passed_subject_count', type: 'number', width: 16, getValue: (s) => s.passed_subject_count ?? 0 },
    { header: 'Failed Subjects', key: 'failed_subject_count', type: 'number', width: 16, getValue: (s) => s.failed_subject_count ?? 0 },
    { header: 'Absent Subjects', key: 'absent_subject_count', type: 'number', width: 16, getValue: (s) => s.absent_subject_count ?? 0 },
    { header: 'SGPI', key: 'sgpi', type: 'number', width: 10, getValue: (s) => s.sgpi ?? '' },
    { header: 'CGPA', key: 'cgpa', type: 'number', width: 10, getValue: (s) => s.cgpa ?? '' },
  ]

  return exportToExcel({
    filename,
    sheetName: 'Student Roster',
    columns,
    data: students,
    metadataRows: [
      ['EduQuery — Academic Student Roster'],
      [`Exported: ${new Date().toLocaleDateString()} | Total Candidates: ${students.length}`],
      [],
    ],
  })
}

export function exportSubjectRoster(
  courseCode: string,
  courseName: string,
  reportType: 'all' | 'passed' | 'failed' | 'absent',
  students: SubjectStudentItem[],
  divisionFilter?: string | null
): { workbook: WorkBook; blob: Blob; filename: string } {
  const safeCode = (courseCode || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_')
  let suffix = 'All_Students'
  let sheetName = 'All Students'
  if (reportType === 'passed') {
    suffix = 'Passed_Students'
    sheetName = 'Passed Students'
  } else if (reportType === 'failed') {
    suffix = 'Failed_Students'
    sheetName = 'Failed Students'
  } else if (reportType === 'absent') {
    suffix = 'Absent_Students'
    sheetName = 'Absent Students'
  }

  const filename = `EduQuery_${safeCode}_${suffix}.csv`
  const columns: ExcelColumn<SubjectStudentItem>[] = [
    { header: 'Roll No', key: 'roll_no', type: 'string', width: 14, getValue: (s) => s.roll_no ?? s.student_id },
    { header: 'Seat No', key: 'seat_no', type: 'string', width: 14, getValue: (s) => s.seat_no ?? '' },
    { header: 'Student Name', key: 'name', type: 'string', width: 30 },
    { header: 'Division', key: 'division', type: 'string', width: 10, getValue: (s) => s.division ?? '' },
    {
      header: 'Component Scores',
      type: 'string',
      width: 25,
      getValue: (s) => {
        if (!s.components) return ''
        return Object.entries(s.components)
          .map(([tag, c]) => `${tag}: ${c.marks !== null ? c.marks : c.flag || 'N/A'}`)
          .join('; ')
      },
    },
    { header: 'Total Marks', key: 'total_marks', type: 'number', width: 14, getValue: (s) => s.total_marks ?? '' },
    { header: 'Grade', key: 'letter_grade', type: 'string', width: 10, getValue: (s) => s.letter_grade ?? '' },
    { header: 'Status', key: 'status', type: 'string', width: 12, getValue: (s) => s.status ?? '' },
    { header: 'Absent', type: 'string', width: 10, getValue: (s) => (s.is_absent ? 'Yes' : 'No') },
    { header: 'Failure Reason', key: 'failure_reason', type: 'string', width: 25, getValue: (s) => formatReason(s.failure_reason) },
  ]

  const divLabel = divisionFilter ? `Division: ${divisionFilter}` : 'All Divisions'
  return exportToExcel({
    filename,
    sheetName,
    columns,
    data: students,
    metadataRows: [
      [`EduQuery — Subject Analysis Roster: ${courseCode} - ${courseName}`],
      [`Cohort: ${sheetName} | ${divLabel} | Total Records: ${students.length}`],
      [],
    ],
  })
}

export function exportAbsentStudents(
  records: AbsentStudentItem[],
  isFiltered: boolean = false
): { workbook: WorkBook; blob: Blob; filename: string } {
  const filename = isFiltered ? 'EduQuery_Absent_Students_Filtered.csv' : 'EduQuery_Absent_Students_Roster.csv'
  const columns: ExcelColumn<AbsentStudentItem>[] = [
    { header: 'Roll No', key: 'roll_no', type: 'string', width: 14, getValue: (r) => r.roll_no ?? r.student_id },
    { header: 'Seat No', key: 'seat_no', type: 'string', width: 14, getValue: (r) => r.seat_no ?? '' },
    { header: 'Student ID', key: 'student_id', type: 'string', width: 16 },
    { header: 'Student Name', key: 'name', type: 'string', width: 30 },
    { header: 'Division', key: 'division', type: 'string', width: 10, getValue: (r) => r.division ?? '' },
    { header: 'Course Code', key: 'course_code', type: 'string', width: 14 },
    { header: 'Course Name', key: 'course_name', type: 'string', width: 30 },
    { header: 'Absent Component', key: 'component', type: 'string', width: 18 },
    { header: 'Absent Marker', key: 'raw_text', type: 'string', width: 14, getValue: (r) => r.raw_text ?? 'AB' },
    { header: 'Subject Total', key: 'total_marks', type: 'number', width: 14, getValue: (r) => r.total_marks ?? '' },
    { header: 'Overall Result', key: 'overall_result', type: 'string', width: 16, getValue: (r) => r.overall_result ?? '' },
    { header: 'Passed Subjects', key: 'passed_subject_count', type: 'number', width: 16, getValue: (r) => r.passed_subject_count ?? 0 },
    { header: 'Failed Subjects', key: 'failed_subject_count', type: 'number', width: 16, getValue: (r) => r.failed_subject_count ?? 0 },
    { header: 'Absent Subjects', key: 'absent_subject_count', type: 'number', width: 16, getValue: (r) => r.absent_subject_count ?? 0 },
  ]

  return exportToExcel({
    filename,
    sheetName: 'Absent Students',
    columns,
    data: records,
    metadataRows: [
      ['EduQuery — Absent Students Examination Roster'],
      [`Total Absent Records: ${records.length} | Exported: ${new Date().toLocaleDateString()}`],
      [],
    ],
  })
}
