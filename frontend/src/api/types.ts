/**
 * Strongly typed TypeScript definitions matching EduQuery API contracts.
 */

export interface DatabaseHealthInfo {
  mode: string;
  connected: boolean;
  students_count: number | null;
  courses_count: number | null;
  active_dataset_id?: string | null;
  activated_at?: string | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  database: DatabaseHealthInfo;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface StudentSummaryItem {
  student_id: string;
  seat_no: string | null;
  roll_no: string | null;
  name: string;
  division: string | null;
  level: string | null;
  total_marks: number | null;
  overall_result: string | null;
  sgpi: number | null;
  cgpa: number | null;
  passed_subject_count?: number;
  failed_subject_count?: number;
  absent_subject_count?: number;
  unresolved_subject_count?: number;
}

export interface AbsentStudentItem {
  student_id: string;
  roll_no: string | null;
  seat_no: string | null;
  name: string;
  division: string | null;
  course_code: string;
  course_name: string;
  component: string;
  raw_text: string | null;
  marks: number | null;
  total_marks: number | null;
  overall_result: string | null;
  passed_subject_count: number;
  failed_subject_count: number;
  absent_subject_count: number;
  source_sheet?: string | null;
  source_row?: number | null;
}

export interface AbsentStudentsParams extends PaginationParams {
  division?: string;
  course_code?: string;
  component?: string;
  query?: string;
}

export type ComponentState = 'marked' | 'not_enrolled' | 'uncalculated' | 'flagged' | 'unparsed';
export type SubjectResult = 'passed' | 'failed' | 'unresolved';

export interface ComponentScoreSchema {
  component: string;
  marks: number | null;
  flag: string | null;
  state: ComponentState;
  raw_text: string | null;
}

export interface StudentSubjectBreakdownSchema {
  course_code: string;
  course_name: string;
  kind: string;
  credits: number | null;
  components: Record<string, ComponentScoreSchema>;
  total_marks: number | null;
  computed_marks_sum: number | null;
  total_match: boolean | null;
  letter_grade: string | null;
  recorded_result: SubjectResult;
  flags: string[];
  is_absent: boolean;
  has_missing_marks: boolean;
  has_uncalculated_total: boolean;
  classification_reason?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
}

export interface StudentIdentitySchema {
  student_id: string;
  seat_no: string | null;
  roll_no: string | null;
  name: string;
  email: string | null;
  division: string | null;
  level: string | null;
  overall_result: string | null;
  total_marks: number | null;
  total_credits: number | null;
  sgpi: number | null;
  cgpa: number | null;
  source_sheet?: string | null;
  source_row?: number | null;
}

export interface StudentBreakdownResponse {
  status: string;
  query: string;
  student: StudentIdentitySchema;
  total_enrolled: number;
  passed_count: number;
  failed_count: number;
  unresolved_count: number;
  subjects: StudentSubjectBreakdownSchema[];
}

export interface CandidateSummary {
  student_id: string;
  name: string;
  seat_no: string | null;
  roll_no: string | null;
  division: string | null;
}

export interface AmbiguousStudentResponse {
  status: 'ambiguous';
  error_code: 'AMBIGUOUS_STUDENT_QUERY';
  query: string;
  message: string;
  candidates: CandidateSummary[];
}

export interface CourseItem {
  code: string;
  name: string;
  kind: string;
  credits: number | null;
  components: string[];
  enrolled_students_count: number | null;
  passed_students_count?: number | null;
  failed_students_count?: number | null;
  absent_students_count?: number | null;
}

export interface FailingStudentItem {
  student_id: string;
  name: string;
  roll_no: string | null;
  seat_no: string | null;
  division: string | null;
  course_code: string;
  course_name: string;
  total_marks: number | null;
  letter_grade: string | null;
  flags: string[];
  is_absent: boolean;
  components: Record<string, ComponentScoreSchema>;
  failure_reason?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
}

export interface SubjectFailureResponse {
  status: string;
  course_code: string;
  course_name: string;
  division_filter: string | null;
  credits: number | null;
  kind: string | null;
  total_enrolled: number;
  confirmed_failures_count: number;
  passed_count: number;
  unresolved_count: number;
  failure_rate_percent: number;
  limit: number;
  offset: number;
  failing_students: FailingStudentItem[];
}

export interface SubjectFailureSummaryItem {
  course_code: string;
  course_name: string;
  credits: number | null;
  kind: string | null;
  division_filter: string | null;
  total_enrolled: number;
  confirmed_failures_count: number;
  passed_count: number;
  unresolved_count: number;
  failure_rate_percent: number;
}

export interface SubjectFailureSummaryResponse {
  division_filter: string | null;
  total_courses_evaluated: number;
  summary: SubjectFailureSummaryItem[];
}

export interface SubjectStudentItem {
  student_id: string;
  name: string;
  roll_no: string | null;
  seat_no: string | null;
  division: string | null;
  course_code?: string;
  course_name?: string;
  total_marks: number | null;
  max_marks?: number | null;
  letter_grade: string | null;
  status: 'passed' | 'failed' | 'absent' | 'unresolved' | 'Passed' | 'Failed' | 'Absent' | 'Unresolved' | string;
  flags?: string[];
  is_absent: boolean;
  components: Record<string, ComponentScoreSchema>;
  failure_reason?: string | null;
  warning?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
}

export interface SubjectStudentsResponse {
  status?: string;
  course_code: string;
  course_name: string;
  division_filter?: string | null;
  result_filter?: string | null;
  credits: number | null;
  kind: string | null;
  total_enrolled: number;
  passed_count: number;
  failed_count: number;
  absent_count: number;
  unresolved_count: number;
  pass_percentage: number;
  denominator_explanation: string;
  total?: number;
  limit?: number;
  offset?: number;
  students: SubjectStudentItem[];
}

export interface AmbiguousCourseResponse {
  status: 'ambiguous';
  error_code: 'AMBIGUOUS_COURSE_QUERY';
  query: string;
  message: string;
  candidates: Array<Record<string, unknown>>;
}

export type SeverityLevel = 'error' | 'warning' | 'info';
export type HealthStatusLevel = 'Good' | 'Needs Attention' | 'Critical';

export interface DataQualityFindingItem {
  check_id: string;
  severity: SeverityLevel;
  title: string;
  count: number;
  problem: string;
  impact: string;
  recommended_action: string;
  details: string[];
}

export interface DataQualityResponse {
  session_id: string;
  health_status: HealthStatusLevel;
  quality_score: number;
  total_checks: number;
  error_count: number;
  warning_count: number;
  info_count: number;
  findings: DataQualityFindingItem[];
}

export type ImportState =
  | 'uploaded'
  | 'validating'
  | 'preview_ready'
  | 'validation_failed'
  | 'confirmed'
  | 'activated'
  | 'expired'
  | 'failed';

export interface SafeWorkbookMeta {
  filename: string;
  file_size_bytes: number;
  sha256: string;
  content_type: string;
}

export interface ElectiveCourseInfo {
  code: string;
  name: string;
  enrolled_count: number;
}

export interface ElectiveGroupSummary {
  group_id: string;
  group_name: string;
  course_codes: string[];
  courses: ElectiveCourseInfo[];
  selection_mode: string;
  total_students: number;
  assigned_count: number;
  unassigned_count: number;
  multi_assigned_count: number;
  is_mutually_exclusive: boolean;
  status: string;
  ambiguities: string[];
}

export interface LayoutSummary {
  strategy: string;
  sheets_inspected: string[];
  sheets_accepted: string[];
  sheets_skipped: Array<Record<string, string>>;
  elective_groups?: ElectiveGroupSummary[];
}

export interface DataQualityPreview {
  health_status: HealthStatusLevel;
  quality_score: number;
  total_checks: number;
  error_count: number;
  warning_count: number;
  info_count: number;
  findings: DataQualityFindingItem[];
}

export interface ImportPreviewResponse {
  import_id: string;
  state: ImportState;
  created_at: string;
  expires_at: string;
  workbook: SafeWorkbookMeta;
  layout: LayoutSummary;
  students_count: number;
  courses_count: number;
  scores_count: number;
  enrollment_count: number;
  reconciliation_count: number;
  data_quality: DataQualityPreview;
  can_confirm: boolean;
  blocking_errors: string[];
  active_dataset_changed: boolean;
}

export interface ImportConfirmResponse {
  import_id: string;
  state: ImportState;
  activated_at: string;
  students_count: number;
  courses_count: number;
  active_dataset_id: string;
  message: string;
}

export interface ImportSessionStatus {
  import_id: string;
  state: ImportState;
  created_at: string;
  expires_at: string;
  can_confirm: boolean;
  blocking_errors: string[];
  filename: string;
  file_size_bytes: number;
  sha256: string;
  students_count?: number;
  courses_count?: number;
  activated_at?: string;
  active_dataset_id?: string;
}

export class ApiError extends Error {
  status: number;
  errorCode: string;
  details: string[];
  ambiguousCandidates?: unknown[];
  query?: string;

  constructor(
    status: number,
    errorCode: string,
    message: string,
    details: string[] = [],
    ambiguousCandidates?: unknown[],
    query?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
    this.ambiguousCandidates = ambiguousCandidates;
    this.query = query;
  }
}

export interface DatasetVersionItem {
  dataset_id: string;
  is_active: boolean;
  created_at: string;
  students_count: number;
  courses_count: number;
  size_bytes: number;
}

export interface DatasetVersionsResponse {
  active_dataset_id: string | null;
  total_versions: number;
  versions: DatasetVersionItem[];
}

export interface RollbackRequest {
  dataset_id: string;
}

export interface RollbackResponse {
  status: string;
  previous_dataset_id: string | null;
  active_dataset_id: string;
  students_count: number;
  courses_count: number;
  activated_at: string;
  message: string;
}

// =========================================================================
// Academic Analytics Interfaces
// =========================================================================

export interface OutcomeDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

export interface TopFailingCourseItem {
  course_code: string;
  course_name: string;
  enrolled_count: number;
  failed_count: number;
  failure_rate_percent: number;
}

export interface DivisionMetricItem {
  division: string;
  student_count: number;
  passed_count: number;
  failed_count: number;
  unresolved_count: number;
  pass_rate_percent: number;
}

export interface ActionableFindingItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  metric: string;
  description: string;
  drill_down_url: string;
  count: number;
}

export interface AnalyticsOverviewResponse {
  status: string;
  total_students: number;
  total_courses: number;
  passed_students: number;
  failed_students: number;
  unresolved_students: number;
  conflicting_students: number;
  quality_score: number;
  outcome_distribution: OutcomeDistributionItem[];
  top_failing_courses: TopFailingCourseItem[];
  division_summary: DivisionMetricItem[];
  findings: ActionableFindingItem[];
}

export interface DivisionCoursePerformanceItem {
  course_code: string;
  course_name: string;
  division: string;
  enrolled: number;
  failed: number;
  failure_rate_percent: number;
}

export interface DivisionComparisonResponse {
  status: string;
  divisions: DivisionMetricItem[];
  course_breakdown: DivisionCoursePerformanceItem[];
}

export interface MultiFailingStudentItem {
  student_id: string;
  name: string;
  roll_no: string | null;
  seat_no: string | null;
  division: string | null;
  failed_courses_count: number;
  failed_courses: string[];
}

export interface CoFailingSubjectPair {
  course_a: string;
  course_b: string;
  co_fail_count: number;
}

export interface FailurePatternsResponse {
  status: string;
  failure_count_histogram: Record<string, number>;
  multi_failing_students: MultiFailingStudentItem[];
  co_failing_pairs: CoFailingSubjectPair[];
}

export interface DistributionBucket {
  label: string;
  min_val: number;
  max_val: number;
  count: number;
}

export interface GradeFrequency {
  grade: string;
  count: number;
  percentage: number;
}

export interface DistributionsResponse {
  status: string;
  course_code: string | null;
  total_records: number;
  score_buckets: DistributionBucket[];
  grade_frequencies: GradeFrequency[];
}

export interface AnalysisRegistryItem {
  id: string;
  name: string;
  category: string;
  description: string;
  available: boolean;
  drill_down_path: string;
  supports_csv: boolean;
}

export interface AnalysisRegistryResponse {
  status: string;
  analyses: AnalysisRegistryItem[];
}

// =========================================================================
// Investigation Engine Types
// =========================================================================

export type InvestigationField =
  | 'student_id'
  | 'name'
  | 'seat_no'
  | 'roll_no'
  | 'division'
  | 'result'
  | 'course_code'
  | 'multi_fails'
  | 'failed_subject_count'
  | 'total_marks'
  | 'sgpi'
  | 'cgpa'
  | 'query'
  | 'has_absent'
  | 'absent_subject_count'
  | 'absent_course_code'
  | 'absent_component';

export type InvestigationOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gte'
  | 'lte'
  | 'between'
  | 'in';

export type InvestigationLogic = 'AND' | 'OR';

export interface InvestigationCondition {
  field: InvestigationField;
  operator: InvestigationOperator;
  value: any;
}

export interface InvestigationFilterGroup {
  logic: InvestigationLogic;
  conditions: InvestigationCondition[];
}

export interface InvestigationQueryRequest {
  group?: InvestigationFilterGroup | null;
  search?: string | null;
  sort_by?:
    | 'student_id'
    | 'name'
    | 'roll_no'
    | 'seat_no'
    | 'division'
    | 'total_marks'
    | 'sgpi'
    | 'cgpa'
    | 'result'
    | null;
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface InvestigationQueryResponse {
  total: number;
  cohort_total: number;
  limit: number;
  offset: number;
  items: StudentSummaryItem[];
  active_explanation: string;
}

export interface FieldCapability {
  field: string;
  label: string;
  data_type: 'string' | 'number' | 'boolean' | 'choice';
  supported_operators: InvestigationOperator[];
  choices?: string[] | null;
  min_value?: number | null;
  max_value?: number | null;
}

export interface InvestigationCapabilitiesResponse {
  status: string;
  fields: FieldCapability[];
  max_conditions: number;
  supported_logic: InvestigationLogic[];
}

// =========================================================================
// Anomaly Detection Types
// =========================================================================

export type AnomalyMethod = 'deterministic_rule' | 'robust_zscore' | 'isolation_forest';

export type AnomalyCategory =
  | 'score_discrepancy'
  | 'boundary_violation'
  | 'component_imbalance'
  | 'intra_student_outlier'
  | 'cohort_outlier'
  | 'multivariate_outlier'
  | 'data_inconsistency';

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface AnomalyFindingItem {
  finding_id: string;
  category: AnomalyCategory;
  method: AnomalyMethod;
  severity: AnomalySeverity;
  student_id: string;
  student_name?: string | null;
  division?: string | null;
  course_code?: string | null;
  score_measure: number;
  score_label: string;
  contributing_features: Record<string, any>;
  explanation: string;
  title?: string | null;
  what_noticed?: string | null;
  evidence?: string | null;
  recommended_action?: string | null;
  technical_details?: string | null;
  limitations: string;
  source_sheet?: string | null;
  source_row?: number | null;
  record_link: string;
  reviewed: boolean;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface GroupedAnomalyRecord {
  student_id: string;
  student_name?: string | null;
  division?: string | null;
  findings_count: number;
  methods: string[];
  categories: string[];
  highest_severity: AnomalySeverity;
  headline: string;
  all_reviewed: boolean;
  findings: AnomalyFindingItem[];
  record_link: string;
}

export interface AnomalySummaryResponse {
  status: string;
  total_findings: number;
  unique_affected_records: number;
  by_method: Record<string, number>;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  reviewed_count: number;
  pending_count: number;
  reviewed_unique_records?: number;
  pending_unique_records?: number;
  insufficient_data: boolean;
  insufficient_data_reason?: string | null;
  excluded_records_count: number;
  exclusion_reasons: string[];
  model_metadata: Record<string, any>;
}

export interface AnomalyListResponse {
  status: string;
  total: number;
  unique_affected_records?: number;
  limit: number;
  offset: number;
  findings: AnomalyFindingItem[];
  grouped_records?: GroupedAnomalyRecord[];
}

export interface AnomalyReviewRequest {
  reviewed: boolean;
  reviewer_name?: string | null;
  notes?: string | null;
}

export interface AnomalyReviewResponse {
  status: string;
  finding_id: string;
  reviewed: boolean;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  message: string;
}

export interface SessionPreviewData {
  sheets: string[];
  detected_students?: number;
  detected_subjects?: number;
  students_count?: number;
  courses_count?: number;
  divisions: string[];
  format_notes: string[];
  quality_health?: string;
  quality_score?: number;
  error_count?: number;
  warning_count?: number;
  findings?: Array<{
    check_id: string;
    severity: string;
    title: string;
    count: number;
    problem: string;
    impact?: string;
    recommended_action?: string;
    details?: string[];
  }>;
  elective_groups?: any[];
}

export interface SessionUploadResponse {
  status: string;
  session_id: string;
  mode: 'temporary' | 'persistent';
  state: string;
  filename: string;
  students_count: number;
  courses_count: number;
  can_confirm: boolean;
  blocking_errors: string[];
  preview: SessionPreviewData;
}

export interface SessionConfirmResponse {
  status: string;
  session_id: string;
  mode: string;
  students_count: number;
  courses_count: number;
  activated_at?: string;
  message: string;
}

export interface SessionStatusResponse {
  active: boolean;
  state?: string;
  session_id?: string;
  mode?: string | null;
  filename?: string;
  students_count?: number;
  courses_count?: number;
  created_at?: string;
  expires_at?: string;
  preview?: SessionPreviewData;
  reason?: string;
  can_confirm?: boolean;
  blocking_errors?: string[];
}

export interface SessionDeleteResponse {
  status: string;
  message: string;
}

export interface SessionSaveResponse {
  status: string;
  dataset_id: string;
  dataset_name: string;
  database_path: string;
  students_count: number;
  courses_count: number;
  saved_at: string;
  message: string;
}


