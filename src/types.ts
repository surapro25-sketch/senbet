export type UserRole = 'head' | 'teacher' | 'student' | 'dept_head' | 'dept_member';

export type DepartmentId = string;

export interface DepartmentRecord {
  id: DepartmentId;
  label: string;
  description: string;
  allowsMedia: boolean;
  createdAt?: string;
}

export type DivisionId = 'wetani' | 'maekelawi' | 'wetat';

export type ResourceType = 'pdf' | 'audio' | 'video';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface UserRecord {
  id: number;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  age: number | null;
  educationLevel: string | null;
  assignedGrade: number | null;
  department: DepartmentId | null;
  subject: string | null;
  phone: string | null;
  createdAt: string;
}

export interface EducationalResource {
  id: number;
  title: string;
  description: string;
  resourceType: ResourceType;
  fileUrl: string;
  fileName: string;
  targetGrade: number | null; // null means all or division-level
  targetDivision: DivisionId | 'all';
  uploadedBy: number;
  uploaderName: string;
  uploaderRole: UserRole;
  createdAt: string;
}

export interface ExamResult {
  id: number;
  studentId: number;
  studentName?: string;
  grade: number;
  subject: string;
  examTitle: string;
  score: number;
  maxScore: number;
  term: string;
  remarks: string;
  recordedBy: number;
  recordedByName?: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: number;
  studentId: number;
  studentName?: string;
  grade: number;
  date: string;
  status: AttendanceStatus;
  note: string;
  recordedBy: number;
  recordedByName?: string;
  createdAt: string;
}

export interface DepartmentReport {
  id: number;
  department: DepartmentId;
  submittedBy: number;
  submitterName: string;
  title: string;
  content: string;
  pdfUrl: string | null;
  pdfName: string | null;
  status: 'pending' | 'reviewed';
  createdAt: string;
}

export interface Directive {
  id: number;
  senderId: number;
  senderName: string;
  senderRole: UserRole;
  targetDepartment: DepartmentId;
  targetScope: 'dept_head' | 'dept_members';
  title: string;
  body: string;
  status: 'active' | 'acknowledged';
  createdAt: string;
}

export interface DepartmentMaterial {
  id: number;
  department: DepartmentId;
  title: string;
  description: string;
  fileType: ResourceType;
  fileUrl: string;
  fileName: string;
  uploadedBy: number;
  uploaderName: string;
  createdAt: string;
}

export interface TargetedMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderRole: UserRole;
  senderDepartment: DepartmentId | null;
  targetType: 'all' | 'division' | 'grade' | 'department' | 'teachers';
  targetValue: string; // e.g., 'all', 'wetani', 'maekelawi', 'wetat', '1'..'12', 'choir', etc.
  title: string;
  body: string;
  createdAt: string;
}
