import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createWorksheet,
  exportToExcel,
  exportStudentsRoster,
  exportSubjectRoster,
  exportAbsentStudents,
  sanitizeFilename,
  sanitizeSheetName,
  sanitizeCsvCell,
  generateCsv,
} from './excelExport'
import type { AbsentStudentItem, StudentSummaryItem, SubjectStudentItem } from '../api/types'

describe('Shared Lightweight Excel Export Utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sanitizes filename to always end in .csv and strip illegal characters', () => {
    expect(sanitizeFilename('EduQuery_Students')).toBe('EduQuery_Students.csv')
    expect(sanitizeFilename('Test:Export*File?.csv')).toBe('Test_Export_File_.csv')
    expect(sanitizeFilename('')).toBe('EduQuery_Export.csv')
  })

  it('neutralizes spreadsheet formula injection with sanitizeCsvCell', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`)
    expect(sanitizeCsvCell('+cmd|')).toBe(`"'+cmd|"`)
    expect(sanitizeCsvCell('-100')).toBe(`"'-100"`)
    expect(sanitizeCsvCell('@threat')).toBe(`"'@threat"`)
    expect(sanitizeCsvCell('Normal Name')).toBe(`"Normal Name"`)
    expect(sanitizeCsvCell(42)).toBe(`"42"`)
    expect(sanitizeCsvCell(null)).toBe(`""`)
  })

  it('generates valid UTF-8 BOM CSV with RFC 4180 escaping', () => {
    const ws = {
      '!ref': 'A1:B2',
      A1: { v: 'Header,One', t: 's' as const },
      B1: { v: 'Header "Two"', t: 's' as const },
      A2: { v: 'Data 1', t: 's' as const },
      B2: { v: 99.5, t: 'n' as const },
    }
    const csv = generateCsv(ws)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"Header,One","Header ""Two"""')
    expect(csv).toContain('"Data 1","99.5"')
  })

  it('sanitizes sheet names to be <= 31 chars and remove illegal characters', () => {
    expect(sanitizeSheetName('Valid Name')).toBe('Valid Name')
    expect(sanitizeSheetName('Invalid:Name*With?Chars')).toBe('Invalid_Name_With_Chars')
    expect(sanitizeSheetName('A Very Long Sheet Name Exceeding Thirty One Characters In Total')).toHaveLength(31)
    expect(sanitizeSheetName('')).toBe('Sheet1')
  })

  it('creates worksheet with string formatting for identifiers and numeric formatting for scores', () => {
    const data = [
      { roll_no: '000123', seat_no: '098765', name: 'Alpha Student', score: 88.5, count: 5 },
      { roll_no: '000456', seat_no: '054321', name: 'Beta Student', score: 92, count: 0 },
    ]

    const columns = [
      { header: 'Roll No', key: 'roll_no', type: 'string' as const },
      { header: 'Seat No', key: 'seat_no', type: 'string' as const },
      { header: 'Name', key: 'name', type: 'string' as const },
      { header: 'Score', key: 'score', type: 'number' as const },
      { header: 'Passed Count', key: 'count', type: 'number' as const },
    ]

    const ws = createWorksheet(data, columns)

    // Row 1 is header, Row 2 is first data row
    expect(ws['A1'].v).toBe('Roll No')
    expect(ws['A2'].v).toBe('000123')
    expect(ws['A2'].t).toBe('s') // preserved as string

    expect(ws['B2'].v).toBe('098765')
    expect(ws['B2'].t).toBe('s') // preserved as string

    expect(ws['D2'].v).toBe(88.5)
    expect(ws['D2'].t).toBe('n') // preserved as number

    expect(ws['E2'].v).toBe(5)
    expect(ws['E2'].t).toBe('n') // preserved as number
  })

  it('handles empty dataset gracefully without throwing', () => {
    const columns = [
      { header: 'Roll No', key: 'roll_no', type: 'string' as const },
      { header: 'Name', key: 'name', type: 'string' as const },
    ]

    const result = exportToExcel({
      filename: 'Empty_Test.xlsx',
      sheetName: 'Empty Sheet',
      columns,
      data: [],
    })

    expect(result.filename).toBe('Empty_Test.xlsx')
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.workbook.SheetNames).toContain('Empty Sheet')
  })

  it('exports student roster with correct columns and metadata', () => {
    const students: StudentSummaryItem[] = [
      {
        student_id: 'S01',
        roll_no: '001',
        seat_no: 'SEAT01',
        name: 'Student One',
        division: 'A',
        level: 'UG',
        total_marks: 450,
        overall_result: 'PASS',
        sgpi: 8.5,
        cgpa: 8.2,
        passed_subject_count: 5,
        failed_subject_count: 0,
        absent_subject_count: 0,
      },
    ]

    const result = exportStudentsRoster(students, false)
    expect(result.filename).toBe('EduQuery_Students.csv')
    expect(result.workbook.SheetNames).toContain('Student Roster')
    expect(result.blob.type).toContain('text/csv')
    expect(result.blob.size).toBeGreaterThan(0)

    const ws = result.workbook.Sheets['Student Roster']
    expect(ws).toBeDefined()
    expect(ws['A1'].v).toContain('EduQuery — Academic Student Roster')
    expect(ws['A4'].v).toBe('Roll No')
    expect(ws['C4'].v).toBe('Student Name')
    expect(ws['C5'].v).toBe('Student One')
  })

  it('exports subject roster with status-aware filename and sheet name', () => {
    const students: SubjectStudentItem[] = [
      {
        student_id: 'S01',
        roll_no: '001',
        seat_no: 'SEAT01',
        name: 'Student One',
        division: 'A',
        total_marks: 45,
        letter_grade: 'O',
        status: 'passed',
        is_absent: false,
        components: {
          ISA: { component: 'ISA', marks: 45, flag: null, state: 'marked', raw_text: null },
        },
      },
    ]

    const passedExport = exportSubjectRoster('MDM01', 'Skill Development', 'passed', students, 'A')
    expect(passedExport.filename).toBe('EduQuery_MDM01_Passed_Students.csv')
    expect(passedExport.workbook.SheetNames).toContain('Passed Students')

    const failedExport = exportSubjectRoster('MDM01', 'Skill Development', 'failed', [], null)
    expect(failedExport.filename).toBe('EduQuery_MDM01_Failed_Students.csv')
    expect(failedExport.workbook.SheetNames).toContain('Failed Students')
  })

  it('exports absent students roster with component markers and subject counts', () => {
    const absentRecords: AbsentStudentItem[] = [
      {
        student_id: 'S02',
        roll_no: '002',
        seat_no: 'SEAT02',
        name: 'Absent Student',
        division: 'B',
        course_code: 'MDM01',
        course_name: 'Skill Development',
        component: 'ESE',
        raw_text: 'AB',
        marks: null,
        total_marks: null,
        overall_result: 'FAIL',
        passed_subject_count: 4,
        failed_subject_count: 1,
        absent_subject_count: 1,
      },
    ]

    const result = exportAbsentStudents(absentRecords, true)
    expect(result.filename).toBe('EduQuery_Absent_Students_Filtered.csv')
    expect(result.workbook.SheetNames).toContain('Absent Students')
  })
})
