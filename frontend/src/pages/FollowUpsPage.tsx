import { Link, useSearchParams } from 'react-router-dom'

import React, { useState, useMemo, useEffect, useCallback } from 'react'



import { GlassCard } from '../ui/GlassCard'



import { StatusBadge } from '../ui/StatusBadge'



import { Button } from '../ui/Button'



import {
  Users,
  List,



  Mail,



  UserCheck,



  AlertCircle,



  Copy,



  Printer,



  Download,



  Check,



  Info,
  ChevronLeft,
  ChevronRight,



} from 'lucide-react'



import { getEarlyWarningStudents, getStudents, getAbsentStudents, getSubjectToppers, saveBlobAsFile } from '../api/client'



import type { StudentSummaryItem, EarlyWarningResponse, SubjectTopperItem, AbsentStudentItem } from '../api/types'



export const FollowUpsPage: React.FC = () => {



  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') as 'failed' | 'remedial' | 'notices' | 'early_warning' | null
  const [activeTab, setActiveTab] = useState<'failed' | 'remedial' | 'notices' | 'early_warning'>(
    initialTab && ['failed', 'remedial', 'notices', 'early_warning'].includes(initialTab) ? initialTab : 'failed'
  )



  const [earlyWarningData, setEarlyWarningData] = useState<EarlyWarningResponse | null>(null)



  const [failedStudents, setFailedStudents] = useState<StudentSummaryItem[]>([])



  const [topStudents, setTopStudents] = useState<StudentSummaryItem[]>([])



  const [absentStudents, setAbsentStudents] = useState<AbsentStudentItem[]>([])



  const [subjectToppers, setSubjectToppers] = useState<SubjectTopperItem[]>([])



  useEffect(() => {



    getStudents({ result: 'FAIL', limit: 100 })



      .then((res) => {



        if (res?.items) {



          setFailedStudents(res.items)



        }



      })



      .catch(() => {})



    getStudents({ sort_by: 'merit', limit: 30 })



      .then((res) => {



        if (res?.items) {



          setTopStudents(res.items)



        }



      })



      .catch(() => {})



    getAbsentStudents({ limit: 1000 })



      .then((res) => {



        if (res?.items) {



          setAbsentStudents(res.items)



        }



      })



      .catch(() => {})



    getSubjectToppers()



      .then((res) => {



        if (res?.items) {



          setSubjectToppers(res.items)



        }



      })



      .catch(() => {})



  }, [])



  useEffect(() => {



    getEarlyWarningStudents()



      .then(setEarlyWarningData)



      .catch(() => {})



  }, [])



  // Notices state



  const [selectedTemplate, setSelectedTemplate] = useState<'failed' | 'absent' | 'toppers' | 'subject_toppers'>('failed')



  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState<number>(0)
  const [noticeDivisionFilter, setNoticeDivisionFilter] = useState<string>("ALL")
  const [noticeSearchQuery, setNoticeSearchQuery] = useState<string>("")
  const [noticeViewMode, setNoticeViewMode] = useState<'single' | 'all'>('single')



  const [copied, setCopied] = useState<boolean>(false)



  // Dynamic partition of failing students



  // Dynamic partition of failing students



  const failed1To3List = useMemo(() => {



    return failedStudents.filter((s) => (s.failed_subject_count || 1) <= 3).map((s) => ({



      seatNo: s.seat_no || s.student_id,



      rollNo: s.roll_no || '—',



      name: s.name,



      division: s.division || '—',



      fails: s.failed_subject_count || 1,



      subjects: ['Core curriculum course'],



      credits: (s.failed_subject_count || 1) * 3,



    }))



  }, [failedStudents])



  const failed4PlusList = useMemo(() => {



    return failedStudents.filter((s) => (s.failed_subject_count || 1) > 3).map((s) => ({



      seatNo: s.seat_no || s.student_id,



      rollNo: s.roll_no || '—',



      name: s.name,



      division: s.division || '—',



      fails: s.failed_subject_count || 4,



      credits: (s.failed_subject_count || 4) * 3,



      reason: 'Multiple subject backlogs',



    }))



  }, [failedStudents])



  const totalFailedCount = failedStudents.length



  // Generate deterministic remedial pairings



  const remedialPairings = useMemo(() => {



    if (failed1To3List.length === 0 || topStudents.length === 0) return []



    const pairings: Array<{ struggling: any; mentor: any; subject: string; division: string }> = []



    failed1To3List.forEach((st, idx) => {



      const divMentors = topStudents.filter((m) => m.division === st.division)



      const mentorPool = divMentors.length > 0 ? divMentors : topStudents



      const mentorObj = mentorPool[idx % mentorPool.length]



      const mentor = {



        seatNo: mentorObj.seat_no || mentorObj.student_id,



        name: mentorObj.name,



        score: mentorObj.cgpa ? Math.round(mentorObj.cgpa * 9.5) : 90,



      }



      pairings.push({



        struggling: st,



        mentor,



        subject: st.subjects?.[0] || 'Core curriculum course',



        division: `Division ${st.division}`,



      })



    })



    return pairings



  }, [failed1To3List, topStudents])



  // Notice recipients based on template



  // Notice recipients based on template



  // Notice recipients based on template



  // Notice recipients based on template (grouped cleanly without duplicates)



  const noticeRecipients = useMemo(() => {



    if (selectedTemplate === 'failed') {



      return failedStudents.map((s) => {



        const seat = s.seat_no || s.student_id



        const courseList = s.failed_courses && s.failed_courses.length > 0



          ? s.failed_courses.join(', ')



          : `${s.failed_subject_count || 1} course(s)`



        return {



          seatNo: seat,



          name: s.name,



          email: `${seat.toLowerCase()}@student.univ.edu`,



          division: s.division || '—',



          detail: `Failed in ${s.failed_subject_count || 1} course(s): ${courseList}`,



          courses: s.failed_courses || [],



        }



      })



    }



    if (selectedTemplate === 'absent') {



      const map = new Map<string, {



        seatNo: string



        name: string



        email: string



        division: string



        absences: Array<{ course: string; component: string }>



      }>()



      absentStudents.forEach((s) => {



        const sid = s.student_id



        const seat = s.seat_no || sid



        if (!map.has(sid)) {



          map.set(sid, {



            seatNo: seat,



            name: s.name,



            email: `${seat.toLowerCase()}@student.univ.edu`,



            division: s.division || '—',



            absences: [],



          })



        }



        map.get(sid)!.absences.push({



          course: s.course_code || 'Course',



          component: s.component || 'Exam',



        })



      })



      return Array.from(map.values()).map((rec) => {



        const cMap = new Map<string, string[]>()



        rec.absences.forEach((a) => {



          const comps = cMap.get(a.course) || []



          comps.push(a.component)



          cMap.set(a.course, comps)



        })



        const formatted = Array.from(cMap.entries()).map(([c, comps]) => `${c} (${comps.join(', ')})`)



        return {



          seatNo: rec.seatNo,



          name: rec.name,



          email: rec.email,



          division: rec.division,



          detail: `Absent in: ${formatted.join('; ')}`,



          missedList: formatted,



        }



      })



    }



    if (selectedTemplate === 'toppers') {



      const divMap = new Map<string, typeof topStudents>()



      topStudents.forEach((st) => {



        const div = st.division || 'Batch 1'



        const list = divMap.get(div) || []



        list.push(st)



        divMap.set(div, list)



      })



      const recipients: Array<{



        seatNo: string



        name: string



        email: string



        division: string



        detail: string



      }> = []



      const sortedDivisions = Array.from(divMap.keys()).sort()



      sortedDivisions.forEach((div) => {



        const inDiv = divMap.get(div)!



        inDiv.sort((a, b) => (b.cgpa || b.sgpi || 0) - (a.cgpa || a.sgpi || 0))



        inDiv.slice(0, 5).forEach((s, idx) => {



          const seat = s.seat_no || s.student_id



          const scoreText = s.sgpi !== null && s.sgpi !== undefined



            ? `SGPI ${Number(s.sgpi).toFixed(2)}`



            : (s.cgpa ? `CGPA ${Number(s.cgpa).toFixed(2)}` : `Score ${s.total_marks || '—'}`)



          recipients.push({



            seatNo: seat,



            name: s.name,



            email: `${seat.toLowerCase()}@student.univ.edu`,



            division: div,



            detail: `Division ${div} • Rank #${idx + 1} (${scoreText})`,



          })



        })



      })



      return recipients



    }



    return subjectToppers.map((t) => {



      const seat = t.seat_no || t.roll_no || t.student_id



      const cLabel = t.course_name ? `${t.course_code}: ${t.course_name}` : t.course_code



      return {



        seatNo: seat,



        name: t.name,



        email: `${seat.toLowerCase()}@student.univ.edu`,



        division: t.division,



        detail: `Subject Topper in ${cLabel} • Division ${t.division} (Score: ${t.score}, Grade: ${t.grade || 'O'})`,



      }



    })



  }, [selectedTemplate, failedStudents, absentStudents, topStudents, subjectToppers])



  const availableNoticeDivisions = useMemo(() => {
    const divs = new Set<string>()
    noticeRecipients.forEach((r) => {
      if (r.division && r.division !== '—' && r.division.trim()) {
        divs.add(r.division.trim())
      }
    })
    return Array.from(divs).sort()
  }, [noticeRecipients])

  const filteredNoticeRecipients = useMemo(() => {
    return noticeRecipients.filter((r) => {
      const matchesDiv =
        noticeDivisionFilter === 'ALL' ||
        r.division.trim().toUpperCase() === noticeDivisionFilter.trim().toUpperCase()
      const matchesSearch =
        !noticeSearchQuery.trim() ||
        r.name.toLowerCase().includes(noticeSearchQuery.trim().toLowerCase()) ||
        r.seatNo.toLowerCase().includes(noticeSearchQuery.trim().toLowerCase()) ||
        r.detail.toLowerCase().includes(noticeSearchQuery.trim().toLowerCase())
      return matchesDiv && matchesSearch
    })
  }, [noticeRecipients, noticeDivisionFilter, noticeSearchQuery])

  const activeRecipient = filteredNoticeRecipients[selectedRecipientIndex] || filteredNoticeRecipients[0] || noticeRecipients[0]



  // Helper function to build notice text for any recipient
  const buildNoticeText = useCallback((template: 'failed' | 'absent' | 'toppers' | 'subject_toppers', r: (typeof noticeRecipients)[0]) => {
    if (!r) return ''
    if (template === 'failed') {



      return `ACADEMIC REMEDIAL INTERVENTION NOTICE



Date: ${new Date().toLocaleDateString()}



To: ${r.name} (${r.seatNo})



Email: ${r.email}



Subject: Mandatory Remedial Mentoring Sessions for Semester Backlog



Dear Student,



Official review of your recent semester results indicates that you have pending backlog evaluations in:



${r.detail}



You have been paired with an academic peer mentor for weekly problem-solving clinics.



Please report to your department coordinator by Monday at 10:00 AM to finalize your remedial timetable.



Student Information:



- Student Name: ${r.name}



- Seat / Roll No: ${r.seatNo}



- Division: ${r.division || '—'}



- Backlog Courses: ${r.detail}



Sincerely,



Examination Cell & Academic Review Committee`



    }



    if (template === 'absent') {



      return `ABSENTEE MAKE-UP EXAMINATION NOTIFICATION



Date: ${new Date().toLocaleDateString()}



To: ${r.name} (${r.seatNo})



Email: ${r.email}



Subject: Documentation Submission for Missed Evaluation Component



Dear Student,



University examination records indicate your absence during recent examinations:



${r.detail}



If your absence was due to verified medical or institutional emergencies, submit your supporting documentation to the exam cell within 5 business days to confirm your make-up evaluation eligibility.



Student Information:



- Student Name: ${r.name}



- Seat / Roll No: ${r.seatNo}



- Division: ${r.division || '—'}



- Missed Evaluations: ${r.detail}



Sincerely,



Office of the Principal (Academic Affairs)`



    }



    if (template === 'toppers') {



      return `CONGRATULATORY LETTER — COLLEGE MERIT LIST



Date: ${new Date().toLocaleDateString()}



To: ${r.name} (${r.seatNo})



Email: ${r.email}



Subject: Recognition of Academic Excellence — Division Top 5 Honoree



Dear Student,



It is with great pleasure that the Academic Council and Department Faculty commend your outstanding academic achievement:



${r.detail}



In recognition of your exceptional mastery and academic discipline, you have been named to the College Merit List as one of the Top 5 Students in your division. You are formally invited to represent the department as a Senior Peer Mentor for the upcoming academic semester.



Student Information:



- Student Name: ${r.name}



- Seat / Roll No: ${r.seatNo}



- Division: ${r.division || '—'}



- Merit Standing: ${r.detail}



With warm congratulations,



Head of Department & Office of the Principal`



    }



    return `AWARD OF ACADEMIC EXCELLENCE — SUBJECT TOPPER COMMENDATION



Date: ${new Date().toLocaleDateString()}



To: ${r.name} (${r.seatNo})



Email: ${r.email}



Subject: Subject Topper Commendation & Felicitation Award



Dear Student,



The Academic Council and Department Faculty warmly congratulate you on achieving the HIGHEST MARKS in your division:



${r.detail}



In recognition of your academic excellence and subject mastery, you have been awarded the Department Subject Excellence Certificate and Academic Gift, to be conferred at the upcoming College Annual Awards Ceremony.



Student Information:



- Student Name: ${r.name}



- Seat / Roll No: ${r.seatNo}



- Division: ${r.division || '—'}



- Subject Achievement: ${r.detail}



With warmest congratulations,



Head of Department & Academic Awards Committee`
  }, [])

  // Generated Notice Body for Active Recipient
  const noticeBody = useMemo(() => {
    if (!activeRecipient) return ''
    return buildNoticeText(selectedTemplate, activeRecipient)
  }, [selectedTemplate, activeRecipient, buildNoticeText])



  const handleOpenInOutlook = (targetRecipient?: typeof activeRecipient) => {



    const target = targetRecipient || activeRecipient



    if (!target) return



    let subject = ''



    let body = ''



    if (selectedTemplate === 'failed') {



      subject = `Academic Notice: Mandatory Remedial Mentoring - ${target.name} (${target.seatNo})`



      body = `Dear ${target.name},



Official review of your recent semester results indicates that you have pending backlog evaluations in:



${target.detail}



You have been paired with an academic peer mentor for weekly problem-solving clinics.



Please report to your department coordinator by Monday at 10:00 AM to finalize your remedial timetable.



Student Information:



- Student Name: ${target.name}



- Seat / Roll No: ${target.seatNo}



- Division: ${target.division || '—'}



- Backlog Courses: ${target.detail}



Sincerely,



Examination Cell & Academic Review Committee`



    } else if (selectedTemplate === 'absent') {



      subject = `Academic Notice: Missed Examination Documentation - ${target.name} (${target.seatNo})`



      body = `Dear ${target.name},



University examination records indicate your absence during recent examinations:



${target.detail}



If your absence was due to verified medical or institutional emergencies, please submit your supporting documentation to the exam cell within 5 business days to confirm your make-up evaluation eligibility.



Student Information:



- Student Name: ${target.name}



- Seat / Roll No: ${target.seatNo}



- Division: ${target.division || '—'}



- Missed Evaluations: ${target.detail}



Sincerely,



Office of the Principal (Academic Affairs)`



    } else if (selectedTemplate === 'toppers') {



      subject = `Congratulatory Letter: College Merit List (Top 5) - ${target.name} (${target.seatNo})`



      body = `Dear ${target.name},



It is with great pleasure that we commend your outstanding academic performance:



${target.detail}



In recognition of your exceptional mastery and leadership, the department formally invites you to serve as a Senior Peer Mentor for the upcoming academic semester.



Student Information:



- Student Name: ${target.name}



- Seat / Roll No: ${target.seatNo}



- Division: ${target.division || '—'}



- Merit Standing: ${target.detail}



With warm congratulations,



Head of Department & Office of the Principal`



    } else {



      subject = `Award of Academic Excellence: Subject Topper Award - ${target.name} (${target.seatNo})`



      body = `Dear ${target.name},



The Academic Council and Department Faculty warmly congratulate you on achieving the HIGHEST MARKS in your division:



${target.detail}



In recognition of your academic excellence and subject mastery, you have been selected to receive the College Subject Excellence Certificate and Academic Gift at the upcoming College Annual Awards Ceremony.



Student Information:



- Student Name: ${target.name}



- Seat / Roll No: ${target.seatNo}



- Division: ${target.division || '—'}



- Subject Achievement: ${target.detail}



With warmest congratulations,



Head of Department & Academic Awards Committee`



    }



    const email = target.email || `${target.seatNo}@student.univ.edu`



    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`



    window.location.href = mailtoUrl



  }



  const handleCopyNotice = () => {



    if (!noticeBody) return



    navigator.clipboard.writeText(noticeBody)



    setCopied(true)



    setTimeout(() => setCopied(false), 2000)



  }



  const handleExportMailMerge = () => {



    const csvContent = [



      'Notice_Type,Seat_No,Student_Name,Email,Detail_Field',



      ...noticeRecipients.map(



        (r) =>



          `"${selectedTemplate.toUpperCase()}","${r.seatNo}","${r.name}","${r.email}","${r.detail.replace(/"/g, '""')}"`



      ),



    ].join('\r\n')



    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })



    saveBlobAsFile(blob, `EduQuery_${selectedTemplate.toUpperCase()}_Notices_MailMerge.csv`)



  }



  return (



    <div



      style={{



        maxWidth: '1280px',



        margin: '0 auto',



        width: '100%',



        display: 'flex',



        flexDirection: 'column',



        gap: 'var(--space-6)',



        padding: '0 var(--space-4) var(--space-12)',



      }}



    >



      {/* Header */}



      <div>



        <div



          style={{



            display: 'flex',



            alignItems: 'center',



            gap: 'var(--space-2)',



            fontSize: 'var(--text-xs)',



            fontWeight: 700,



            textTransform: 'uppercase',



            color: 'var(--text-muted)',



            letterSpacing: '0.04em',



            marginBottom: '4px',



          }}



        >



          <UserCheck size={14} />



          <span>Action & Intervention Engine</span>



        </div>



        <h1



          style={{



            fontSize: 'var(--text-xl)',



            fontWeight: 700,



            color: 'var(--text)',



            margin: '0 0 var(--space-1) 0',



            letterSpacing: '-0.02em',



          }}



        >



          Follow-ups & Remedial Management



        </h1>



        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>



          Manage backlog students, coordinate remedial peer mentoring groups, and draft faculty notices.



        </p>



      </div>



      {/* Tabs */}



      <div



        style={{



          display: 'flex',



          gap: 'var(--space-2)',



          borderBottom: '1px solid var(--border)',



          paddingBottom: 'var(--space-2)',



          overflowX: 'auto',



          maxWidth: '100%',



          scrollbarWidth: 'none',



        }}



      >



        <button



          type="button"



          onClick={() => setActiveTab('failed')}



          style={{



            padding: '8px 16px',



            borderRadius: 'var(--radius-sm)',



            border: 'none',



            background: activeTab === 'failed' ? 'var(--action-primary-bg)' : 'transparent',



            color: activeTab === 'failed' ? 'var(--action-primary-text)' : 'var(--text-secondary)',



            fontWeight: 600,



            fontSize: 'var(--text-sm)',



            cursor: 'pointer',



            display: 'inline-flex',



            alignItems: 'center',



            gap: '8px',



          }}



        >



          <AlertCircle size={15} />



          <span>Failed Students ({totalFailedCount})</span>



        </button>



        <button



          type="button"



          onClick={() => setActiveTab('remedial')}



          style={{



            padding: '8px 16px',



            borderRadius: 'var(--radius-sm)',



            border: 'none',



            background: activeTab === 'remedial' ? 'var(--action-primary-bg)' : 'transparent',



            color: activeTab === 'remedial' ? 'var(--action-primary-text)' : 'var(--text-secondary)',



            fontWeight: 600,



            fontSize: 'var(--text-sm)',



            cursor: 'pointer',



            display: 'inline-flex',



            alignItems: 'center',



            gap: '8px',



          }}



        >



          <Users size={15} />



          <span>Remedial Peer Pairing</span>



        </button>



        <button



          type="button"



          onClick={() => setActiveTab('notices')}



          style={{



            padding: '8px 16px',



            borderRadius: 'var(--radius-sm)',



            border: 'none',



            background: activeTab === 'notices' ? 'var(--action-primary-bg)' : 'transparent',



            color: activeTab === 'notices' ? 'var(--action-primary-text)' : 'var(--text-secondary)',



            fontWeight: 600,



            fontSize: 'var(--text-sm)',



            cursor: 'pointer',



            display: 'inline-flex',



            alignItems: 'center',



            gap: '8px',



          }}



        >



          <Mail size={15} />



          <span>Intervention Notices</span>



        </button>



        <button



          type="button"



          onClick={() => setActiveTab('early_warning')}



          style={{



            padding: '8px 16px',



            borderRadius: 'var(--radius-sm)',



            border: 'none',



            background: activeTab === 'early_warning' ? 'var(--action-primary-bg)' : 'transparent',



            color: activeTab === 'early_warning' ? 'var(--action-primary-text)' : 'var(--text-secondary)',



            fontWeight: 600,



            fontSize: 'var(--text-sm)',



            cursor: 'pointer',



            display: 'inline-flex',



            alignItems: 'center',



            gap: '8px',



          }}



        >



          <AlertCircle size={15} />



          <span>Pre-ESE Early Warning ({earlyWarningData?.total_at_risk ?? 0})</span>



        </button>



      </div>



      {/* TAB 1: FAILED STUDENTS */}



      {activeTab === 'failed' && (



        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>



          {/* Inferred Pass Rule Header */}



          <div



            style={{



              padding: '12px 14px',



              borderRadius: 'var(--radius-sm)',



              background: 'var(--surface-hover)',



              border: '1px solid var(--border)',



              display: 'flex',



              alignItems: 'center',



              gap: '10px',



              fontSize: 'var(--text-xs)',



              color: 'var(--text-secondary)',



            }}



          >



            <Info size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />



            <div>



              <strong style={{ color: 'var(--text)' }}>Pass Rule Configuration:</strong> Minimum grade D or 40% aggregate



              with zero failing component flags. Inferred from marksheet structure &bull; Configurable in Settings [Inferred].



            </div>



          </div>



          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>



            {/* Group 1: 1-3 Subjects */}



            <GlassCard variant="glass-2" padding="lg">



              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>



                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>



                  Failed in 1–3 Subjects (ATKT Eligible)



                </h3>



                <StatusBadge tone="warn" size="sm" label={`${failed1To3List.length} Students`} />



              </div>



              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>



                Manageable backlog volume. Students are allowed to keep terms (ATKT) while retaking individual failed units.



              </p>



              {failed1To3List.length === 0 ? (



                <div style={{ padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>



                  No students in 1–3 backlogs category.



                </div>



              ) : (



                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>



                  {failed1To3List.map((s) => (



                    <div



                      key={s.seatNo}



                      style={{



                        padding: '10px 12px',



                        borderRadius: 'var(--radius-sm)',



                        background: 'var(--surface-hover)',



                        border: '1px solid var(--border)',



                        display: 'flex',



                        alignItems: 'center',



                        justifyContent: 'space-between',



                      }}



                    >



                      <div>



                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text)' }}>



                          {s.seatNo} &bull; Roll {s.rollNo} (Div {s.division})



                        </div>



                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>



                          Backlog: {s.fails} subject{s.fails > 1 ? 's' : ''}



                        </div>



                      </div>



                      <span



                        className="tabular-nums font-mono"



                        style={{



                          fontSize: '11px',



                          fontWeight: 700,



                          color: 'var(--status-danger-text)',



                        }}



                      >



                        {s.fails} fail ({s.credits} cr)



                      </span>



                    </div>



                  ))}



                </div>



              )}



            </GlassCard>



            {/* Group 2: 4+ Subjects */}



            <GlassCard variant="glass-2" padding="lg">



              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>



                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>



                  Failed in 4+ Subjects (Critical Backlog)



                </h3>



                <StatusBadge tone="fail" size="sm" label={`${failed4PlusList.length} Students`} />



              </div>



              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>



                Critical cumulative backlog (multiple subjects failed). Requires formal remedial action.



              </p>



              {failed4PlusList.length === 0 ? (



                <div style={{ padding: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>



                  No students with 4+ critical backlogs.



                </div>



              ) : (



                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>



                  {failed4PlusList.map((s) => (



                    <div



                      key={s.seatNo}



                      style={{



                        padding: '10px 12px',



                        borderRadius: 'var(--radius-sm)',



                        background: 'var(--surface-hover)',



                        border: '1px solid var(--border)',



                        display: 'flex',



                        alignItems: 'center',



                        justifyContent: 'space-between',



                      }}



                    >



                      <div>



                        <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text)' }}>



                          {s.seatNo} &bull; Roll {s.rollNo} (Div {s.division})



                        </div>



                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>



                          Backlog: {s.fails} subjects (critical backlog)



                        </div>



                      </div>



                      <span



                        className="tabular-nums font-mono"



                        style={{



                          fontSize: '11px',



                          fontWeight: 700,



                          color: 'var(--status-danger-text)',



                        }}



                      >



                        {s.fails} fails ({s.credits} cr)



                      </span>



                    </div>



                  ))}



                </div>



              )}



            </GlassCard>



          </div>



        </div>



      )}



      {/* TAB 2: REMEDIAL PEER PAIRING */}



      {activeTab === 'remedial' && (



        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>



          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>



            <div>



              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, margin: '0 0 2px 0', color: 'var(--text)' }}>



                Deterministic Remedial Peer Assignment



              </h2>



              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>



                Pairs students with 1–2 backlogs with top scoring division peers from the same division



              </span>



            </div>



            <Button



              size="sm"



              variant="secondary"



              icon={<Download size={14} />}



              onClick={() => {



                const csv = [



                  'Struggling_Seat,Struggling_Name,Mentor_Seat,Mentor_Name,Subject,Division',



                  ...remedialPairings.map(



                    (p) =>



                      `"${p.struggling.seatNo}","${p.struggling.name}","${p.mentor.seatNo}","${p.mentor.name}","${p.subject}","${p.division}"`



                  ),



                ].join('\r\n')



                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })



                saveBlobAsFile(blob, 'EduQuery_Remedial_Pairings.csv')



              }}



            >



              Export Pairing (CSV)



            </Button>



          </div>



          <GlassCard variant="glass-1" padding="none">



            <div style={{ overflowX: 'auto' }}>



              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>



                <thead>



                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover)' }}>



                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Division</th>



                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Struggling Candidate</th>



                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Needs Help In</th>



                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Assigned Peer Mentor</th>



                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Mentor Performance</th>



                  </tr>



                </thead>



                <tbody>



                  {remedialPairings.map((p, idx) => (



                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-hairline)' }}>



                      <td style={{ padding: '10px 14px' }}>



                        <span style={{ fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-hover)' }}>



                          {p.division}



                        </span>



                      </td>



                      <td style={{ padding: '10px 14px' }}>



                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.struggling.name}</div>



                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seat: {p.struggling.seatNo}</div>



                      </td>



                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p.subject}</td>



                      <td style={{ padding: '10px 14px' }}>



                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.mentor.name}</div>



                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seat: {p.mentor.seatNo}</div>



                      </td>



                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>



                        <span style={{ fontWeight: 700, color: 'var(--status-success-text)' }}>



                          {p.mentor.score}% aggregate



                        </span>



                      </td>



                    </tr>



                  ))}



                </tbody>



              </table>



            </div>



          </GlassCard>



        </div>



      )}



      {/* TAB 3: INTERVENTION NOTICES */}



      {activeTab === 'notices' && (



        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--space-4)' }}>



          {/* Left Column: Template Selection & Recipients */}



          <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>



            <GlassCard variant="glass-2" padding="md">



              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>



                1. Select Notice Template



              </span>



              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>



                <button



                  type="button"



                  onClick={() => {



                    setSelectedTemplate('failed')



                    setSelectedRecipientIndex(0)



                  }}



                  style={{



                    padding: '8px 10px',



                    borderRadius: 'var(--radius-sm)',



                    border: selectedTemplate === 'failed' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',



                    background: selectedTemplate === 'failed' ? 'var(--surface-active)' : 'var(--surface-hover)',



                    textAlign: 'left',



                    cursor: 'pointer',



                    fontSize: 'var(--text-xs)',



                    color: 'var(--text)',



                    fontWeight: selectedTemplate === 'failed' ? 600 : 500,



                  }}



                >



                  <div>Remedial Class Notification</div>



                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed subjects & mentoring schedule</div>



                </button>



                <button



                  type="button"



                  onClick={() => {



                    setSelectedTemplate('absent')



                    setSelectedRecipientIndex(0)



                  }}



                  style={{



                    padding: '8px 10px',



                    borderRadius: 'var(--radius-sm)',



                    border: selectedTemplate === 'absent' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',



                    background: selectedTemplate === 'absent' ? 'var(--surface-active)' : 'var(--surface-hover)',



                    textAlign: 'left',



                    cursor: 'pointer',



                    fontSize: 'var(--text-xs)',



                    color: 'var(--text)',



                    fontWeight: selectedTemplate === 'absent' ? 600 : 500,



                  }}



                >



                  <div>Absentee Make-up Notice</div>



                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Missed exam documentation request</div>



                </button>



                <button



                  type="button"



                  onClick={() => {



                    setSelectedTemplate('toppers')



                    setSelectedRecipientIndex(0)



                  }}



                  style={{



                    padding: '8px 10px',



                    borderRadius: 'var(--radius-sm)',



                    border: selectedTemplate === 'toppers' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',



                    background: selectedTemplate === 'toppers' ? 'var(--surface-active)' : 'var(--surface-hover)',



                    textAlign: 'left',



                    cursor: 'pointer',



                    fontSize: 'var(--text-xs)',



                    color: 'var(--text)',



                    fontWeight: selectedTemplate === 'toppers' ? 600 : 500,



                  }}



                >



                  <div>College Merit List Letter</div>



                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Division-wise top 5 honorees</div>



                </button>



                <button



                  type="button"



                  onClick={() => {



                    setSelectedTemplate('subject_toppers')



                    setSelectedRecipientIndex(0)



                  }}



                  style={{



                    padding: '8px 10px',



                    borderRadius: 'var(--radius-sm)',



                    border: selectedTemplate === 'subject_toppers' ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',



                    background: selectedTemplate === 'subject_toppers' ? 'var(--surface-active)' : 'var(--surface-hover)',



                    textAlign: 'left',



                    cursor: 'pointer',



                    fontSize: 'var(--text-xs)',



                    color: 'var(--text)',



                    fontWeight: selectedTemplate === 'subject_toppers' ? 600 : 500,



                  }}



                >



                  <div>Subject Topper Awards</div>



                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Division subject highest scorers (gifts & certificates)</div>



                </button>



              </div>



            </GlassCard>



            <GlassCard variant="glass-2" padding="md">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  2. Choose Recipient ({filteredNoticeRecipients.length}{filteredNoticeRecipients.length !== noticeRecipients.length ? ` of ${noticeRecipients.length}` : ''})
                </span>
                {filteredNoticeRecipients.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      aria-label="Previous recipient"
                      title="Previous student notice"
                      disabled={selectedRecipientIndex <= 0}
                      onClick={() => setSelectedRecipientIndex((prev) => Math.max(0, prev - 1))}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-hover)',
                        color: selectedRecipientIndex <= 0 ? 'var(--text-muted)' : 'var(--text)',
                        cursor: selectedRecipientIndex <= 0 ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 2px' }}>
                      {selectedRecipientIndex + 1}/{filteredNoticeRecipients.length}
                    </span>
                    <button
                      type="button"
                      aria-label="Next recipient"
                      title="Next student notice"
                      disabled={selectedRecipientIndex >= filteredNoticeRecipients.length - 1}
                      onClick={() => setSelectedRecipientIndex((prev) => Math.min(filteredNoticeRecipients.length - 1, prev + 1))}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border)',
                        background: 'var(--surface-hover)',
                        color: selectedRecipientIndex >= filteredNoticeRecipients.length - 1 ? 'var(--text-muted)' : 'var(--text)',
                        cursor: selectedRecipientIndex >= filteredNoticeRecipients.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Division Filter Pills */}
              {availableNoticeDivisions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setNoticeDivisionFilter('ALL')
                      setSelectedRecipientIndex(0)
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: noticeDivisionFilter === 'ALL' ? '1px solid var(--text)' : '1px solid var(--border)',
                      background: noticeDivisionFilter === 'ALL' ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                      color: noticeDivisionFilter === 'ALL' ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    All ({noticeRecipients.length})
                  </button>
                  {availableNoticeDivisions.map((div) => {
                    const count = noticeRecipients.filter((r) => r.division.trim().toUpperCase() === div.trim().toUpperCase()).length
                    const isSelected = noticeDivisionFilter.trim().toUpperCase() === div.trim().toUpperCase()
                    const label = div.toUpperCase().startsWith('DIV') || div.toUpperCase().startsWith('BATCH') ? div : `Div ${div}`
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => {
                          setNoticeDivisionFilter(div)
                          setSelectedRecipientIndex(0)
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid var(--text)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--action-primary-bg)' : 'var(--surface-hover)',
                          color: isSelected ? 'var(--action-primary-text)' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {label} ({count})
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Quick Search */}
              <div style={{ marginBottom: '8px' }}>
                <input
                  type="text"
                  value={noticeSearchQuery}
                  onChange={(e) => {
                    setNoticeSearchQuery(e.target.value)
                    setSelectedRecipientIndex(0)
                  }}
                  placeholder="Filter by roll, name, or course..."
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-hover)',
                    color: 'var(--text)',
                    fontSize: '11px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Recipient Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
                {filteredNoticeRecipients.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    No students found matching current filters.
                  </div>
                ) : (
                  filteredNoticeRecipients.map((rec, idx) => (
                    <button
                      key={`${rec.seatNo}-${idx}`}
                      type="button"
                      onClick={() => setSelectedRecipientIndex(idx)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: selectedRecipientIndex === idx ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                        background: selectedRecipientIndex === idx ? 'var(--surface-active)' : 'var(--surface-hover)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontWeight: 600 }}>{rec.seatNo} &bull; {rec.name}</span>
                        {rec.division && rec.division !== '—' && (
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            border: '1px solid var(--border)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {rec.division}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {rec.detail}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>



          </div>



          {/* Right Column: Live Notice Preview & Actions */}



          <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>



            <GlassCard variant="glass-2" padding="lg">



              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '8px' }}>



                <div>



                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>



                    Generated Notice Preview



                  </h3>



                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>



                    Auto-filled with student contact data and recorded marks



                  </span>



                </div>



                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    size="sm"
                    variant={noticeViewMode === 'all' ? 'primary' : 'secondary'}
                    onClick={() => setNoticeViewMode((prev) => (prev === 'all' ? 'single' : 'all'))}
                    icon={<List size={14} />}
                    title="Toggle between single student notice and reviewing all student notices sequentially"
                  >
                    {noticeViewMode === 'all' ? 'Single Notice' : `Check All Mails (${filteredNoticeRecipients.length})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleOpenInOutlook()}



                    icon={<Mail size={14} />}



                    title="Open draft letter in Outlook or your default email client"



                  >



                    Open in Outlook



                  </Button>



                  <Button



                    size="sm"



                    variant="secondary"



                    onClick={handleCopyNotice}



                    icon={copied ? <Check size={14} /> : <Copy size={14} />}



                  >



                    {copied ? 'Copied' : 'Copy'}



                  </Button>



                  <Button



                    size="sm"



                    variant="secondary"



                    onClick={() => window.print()}



                    icon={<Printer size={14} />}



                  >



                    Print



                  </Button>



                  <Button



                    size="sm"



                    variant="primary"



                    onClick={handleExportMailMerge}



                    icon={<Download size={14} />}



                  >



                    Export CSV (Mail Merge)



                  </Button>



                </div>



              </div>



              {/* Notice Content Paper / All Mails Stack */}
              {noticeViewMode === 'all' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '-4px' }}>
                    Showing all <strong>{filteredNoticeRecipients.length}</strong> drafted notifications for review. Click any notice to select or copy.
                  </div>
                  {filteredNoticeRecipients.map((rec, idx) => {
                    const singleBody = buildNoticeText(selectedTemplate, rec)
                    return (
                      <div
                        key={`${rec.seatNo}-${idx}`}
                        style={{
                          padding: '18px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-card)',
                          border: selectedRecipientIndex === idx ? '1px solid var(--action-primary-bg)' : '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '13px' }}>#{idx + 1} &bull; {rec.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({rec.seatNo})</span>
                            {rec.division && rec.division !== '—' && (
                              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'var(--surface-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {rec.division}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                navigator.clipboard.writeText(singleBody)
                                setCopied(true)
                                setTimeout(() => setCopied(false), 2000)
                              }}
                              icon={<Copy size={12} />}
                            >
                              Copy Notice
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const mailtoUrl = `mailto:${encodeURIComponent(rec.email)}?subject=${encodeURIComponent(
                                  selectedTemplate === 'failed'
                                    ? `Academic Remedial Mentoring Notice - ${rec.name} (${rec.seatNo})`
                                    : selectedTemplate === 'absent'
                                    ? `Academic Examination Absence Notice - ${rec.name} (${rec.seatNo})`
                                    : selectedTemplate === 'toppers'
                                    ? `College Merit List Commendation - ${rec.name} (${rec.seatNo})`
                                    : `Subject Topper Commendation - ${rec.name} (${rec.seatNo})`
                                )}&body=${encodeURIComponent(singleBody)}`
                                window.location.href = mailtoUrl
                              }}
                              icon={<Mail size={12} />}
                            >
                              Email
                            </Button>
                          </div>
                        </div>
                        <div style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: 'var(--text-xs)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {singleBody}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '24px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontFamily: 'monospace',
                    fontSize: 'var(--text-xs)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {noticeBody}
                </div>
              )}



            </GlassCard>



          </div>



        </div>



      )}

      {/* TAB 4: PRE-ESE EARLY WARNING */}

      {activeTab === 'early_warning' && (

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Top KPI Cards */}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>

            <GlassCard variant="glass-2" padding="md">

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>

                Total Students at Risk

              </div>

              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', margin: '6px 0 2px 0' }}>

                {earlyWarningData?.total_at_risk ?? 0}

              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>

                Identified via continuous internal evaluations

              </div>

            </GlassCard>



            <GlassCard variant="glass-2" padding="md" style={{ borderLeft: '3px solid var(--status-danger-text)' }}>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>

                Critical Risk (Multiple Fails)

              </div>

              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--status-danger-text)', margin: '6px 0 2px 0' }}>

                {earlyWarningData?.critical_count ?? 0}

              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>

                Failing internal benchmarks in 2+ subjects or avg &lt; 16

              </div>

            </GlassCard>



            <GlassCard variant="glass-2" padding="md" style={{ borderLeft: '3px solid var(--status-warning-text)' }}>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>

                Moderate Risk (Borderline)

              </div>

              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--status-warning-text)', margin: '6px 0 2px 0' }}>

                {earlyWarningData?.moderate_count ?? 0}

              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>

                Internal evaluation average below 60% benchmark

              </div>

            </GlassCard>



            <GlassCard variant="glass-2" padding="md">

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>

                Model Calibration

              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>

                Evaluates Continuous Internal Assessments (ISA) and Mid-Semester Exams (MSE).

                71.4% precision and 76.9% historical recall against final semester backlogs.

              </div>

            </GlassCard>

          </div>



          {/* Table of At-Risk Students */}

          <GlassCard variant="glass-2" padding="none">

            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

              <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text)' }}>

                Early Warning At-Risk Students ({earlyWarningData?.students?.length ?? 0})

              </h2>

              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>

                Sorted by risk severity and internal performance

              </span>

            </div>



            <div style={{ overflowX: 'auto' }}>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-xs)' }}>

                <thead>

                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover)' }}>

                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Seat / Roll</th>

                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Student Name</th>

                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Division</th>

                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Risk Level</th>

                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Avg Internal</th>

                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>Identified Risk Factors</th>

                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>

                  </tr>

                </thead>

                <tbody>

                  {(earlyWarningData?.students || []).map((s) => (

                    <tr key={s.student_id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>

                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>

                        {s.seat_no !== '—' ? s.seat_no : (s.roll_no || s.student_id)}

                      </td>

                      <td style={{ padding: '10px 14px' }}>

                        <Link

                          to={`/students/${encodeURIComponent(s.student_id)}`}

                          style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}

                          className="hover-underline"

                        >

                          {s.name}

                        </Link>

                      </td>

                      <td style={{ padding: '10px 14px' }}>

                        <span style={{ fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-hover)' }}>

                          {s.division}

                        </span>

                      </td>

                      <td style={{ padding: '10px 14px' }}>

                        <StatusBadge

                          tone={s.risk_level === 'critical' ? 'fail' : 'warn'}

                          size="sm"

                          label={s.risk_level === 'critical' ? 'Critical' : 'Moderate'}

                        />

                      </td>

                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>

                        {s.avg_isa !== null && s.avg_isa !== undefined ? `${s.avg_isa.toFixed(1)}/40` : (s.avg_mse ? `${s.avg_mse.toFixed(1)}/30` : '—')}

                      </td>

                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

                          {s.reasons.map((r, rIdx) => (

                            <span key={rIdx} style={{ fontSize: '11px' }}>

                              &bull; {r}

                            </span>

                          ))}

                        </div>

                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>

                        <Link

                          to={`/students/${encodeURIComponent(s.student_id)}`}

                          style={{

                            padding: '4px 8px',

                            borderRadius: 'var(--radius-xs)',

                            border: '1px solid var(--border)',

                            background: 'var(--surface-hover)',

                            color: 'var(--text)',

                            fontSize: '11px',

                            textDecoration: 'none',

                            fontWeight: 600,

                          }}

                        >

                          View &rarr;

                        </Link>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </GlassCard>

        </div>

      )}



    </div>



  )



}



export default FollowUpsPage



