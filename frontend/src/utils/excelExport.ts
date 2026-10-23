import * as XLSX from 'xlsx'
import type { AbsentStudentItem, StudentSummaryItem, SubjectStudentItem } from '../api/types'

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

export function sanitizeSheetName(name: string, fallback = 'Sheet1'): string {
  if (!name || !name.trim()) return fallback
  const cleaned = name.replace(/[\\/?*[\]:]/g, '_').trim().slice(0, 31)
  return cleaned || fallback
}

export function sanitizeFilename(filename: string, fallback = 'EduQuery_Export.xlsx'): string {
  let name = (filename || fallback).trim().replace(/[\\/:*?"<>|]/g, '_')
  if (!name.toLowerCase().endsWith('.xlsx')) {
    name += '.xlsx'
  }
  return name
}

export function createWorksheet<T>(
  data: T[],
  columns: ExcelColumn<T>[],
  metadataRows?: (string | number | null | undefined)[][]
): XLSX.WorkSheet {
  const aoa: any[][] = []

  // Add optional metadata rows (e.g. title, summary, timestamp)
  if (metadataRows && metadataRows.length > 0) {
    for (const metaRow of metadataRows) {
      aoa.push(metaRow)
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

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Enforce cell types (specifically 's' to preserve leading zeros in roll/seat numbers)
  for (let r = 0; r < safeData.length; r++) {
    const rowIndex = dataStartRowIdx + r
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c]
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c })
      const cell = ws[cellRef]
      if (cell) {
        if (col.type === 'string') {
          cell.t = 's'
          cell.v = String(cell.v ?? '')
        } else if (col.type === 'number' && typeof cell.v === 'number') {
          cell.t = 'n'
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
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: cIdx })
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
  // Ensure rel is NOT set to 'noopener'
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

export function exportToExcel<T>(options: ExcelExportOptions<T>): {
  workbook: XLSX.WorkBook
  blob: Blob
  filename: string
} {
  const filename = sanitizeFilename(options.filename)
  const sheetName = sanitizeSheetName(options.sheetName || 'Sheet1')
  const wb = XLSX.utils.book_new()
  const ws = createWorksheet(options.data || [], options.columns, options.metadataRows)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    downloadBlobFile(blob, filename)
  }

  return { workbook: wb, blob, filename }
}

export function exportStudentsRoster(
  students: StudentSummaryItem[],
  isFiltered: boolean = false
): { workbook: XLSX.WorkBook; blob: Blob; filename: string } {
  const filename = isFiltered ? 'EduQuery_Students_Filtered.xlsx' : 'EduQuery_Students.xlsx'
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
): { workbook: XLSX.WorkBook; blob: Blob; filename: string } {
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

  const filename = `EduQuery_${safeCode}_${suffix}.xlsx`
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
    { header: 'Failure Reason', key: 'failure_reason', type: 'string', width: 25, getValue: (s) => s.failure_reason ?? '' },
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
): { workbook: XLSX.WorkBook; blob: Blob; filename: string } {
  const filename = isFiltered ? 'EduQuery_Absent_Students_Filtered.xlsx' : 'EduQuery_Absent_Students_Roster.xlsx'
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
