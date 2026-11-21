import type { AttendanceStatus, DepartmentId, DepartmentRecord, DivisionId, UserRole } from '../types';

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const DIVISIONS: { id: DivisionId; label: string; rangeLabel: string; grades: number[] }[] = [
  { id: 'wetani', label: 'ወጣኒ', rangeLabel: '1ኛ - 4ኛ ክፍል', grades: [1, 2, 3, 4] },
  { id: 'maekelawi', label: 'ማእከላዊ', rangeLabel: '5ኛ - 6ኛ ክፍል', grades: [5, 6] },
  { id: 'wetat', label: 'ወጣት', rangeLabel: '7ኛ - 12ኛ ክፍል', grades: [7, 8, 9, 10, 11, 12] },
];

export const DEFAULT_DEPARTMENTS: DepartmentRecord[] = [
  {
    id: 'education',
    label: 'ትምህርት ክፍል',
    description: 'የትምህርት ካሪኩለም፣ የመጽሐፍ ቅዱስና የቤተ ክርስቲያን ታሪክ ትምህርቶች አስተባባሪ',
    allowsMedia: false,
  },
  {
    id: 'choir',
    label: 'መዝሙር ክፍል',
    description: 'የመዝሙር ልምምድ፣ የበገናና የከበሮ አገልግሎት (PDF፣ ኦዲዮ እና ቪዲዮ ግብአቶች)',
    allowsMedia: true,
  },
  {
    id: 'property',
    label: 'ንብረት ክፍል',
    description: 'የሰንበት ትምህርት ቤቱ ንብረቶች፣ መጻሕፍትና ቁሳቁስ አስተዳደር',
    allowsMedia: false,
  },
  {
    id: 'charity',
    label: 'በጎ አድራጎት ክፍል',
    description: 'የድጋፍ፣ የጉብኝት እና የበጎ አድራጎት አገልግሎት ማስተባበሪያ',
    allowsMedia: false,
  },
  {
    id: 'member_admin',
    label: 'አባላት አስተዳደር ክፍል',
    description: 'የአባላት መረጃ፣ ስነ-ምግባርና ለሁሉም ክፍሎች መልእክት ማስተላለፊያ',
    allowsMedia: false,
  },
];

export let DEPARTMENTS: DepartmentRecord[] = [...DEFAULT_DEPARTMENTS];

export function syncDepartmentsRegistry(list: DepartmentRecord[]) {
  if (Array.isArray(list) && list.length > 0) {
    DEPARTMENTS = list;
  }
}

export function getDepartmentsList(): DepartmentRecord[] {
  return DEPARTMENTS;
}

export function doesDepartmentAllowMedia(dept: DepartmentId | null | undefined): boolean {
  if (!dept) return false;
  const found = DEPARTMENTS.find((d) => d.id === dept);
  if (found) return Boolean(found.allowsMedia);
  return dept === 'choir';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  head: 'የሰንበት ትምህርት ቤት ሀላፊ',
  teacher: 'መምህር',
  student: 'ተማሪ',
  dept_head: 'የክፍል ሀላፊ (ተመዳቢ)',
  dept_member: 'የክፍል አባል',
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'ተገኝቷል',
  absent: 'ቀርቷል',
  late: 'አርፍዷል',
  excused: 'በፈቃድ',
};

export function getDivisionByGrade(grade: number): DivisionId {
  if (grade >= 1 && grade <= 4) return 'wetani';
  if (grade >= 5 && grade <= 6) return 'maekelawi';
  return 'wetat';
}

export function getDivisionLabel(division: DivisionId | 'all'): string {
  if (division === 'all') return 'ሁሉም ክፍሎች';
  return DIVISIONS.find((d) => d.id === division)?.label ?? division;
}

export function getGradeLabel(grade: number | null | undefined): string {
  if (!grade) return 'ያልተመደበ';
  const div = getDivisionLabel(getDivisionByGrade(grade));
  return `${grade}ኛ ክፍል (${div})`;
}

export function getDepartmentLabel(
  dept: DepartmentId | null | undefined,
  customList?: DepartmentRecord[]
): string {
  if (!dept) return '—';
  const list = customList || DEPARTMENTS;
  return list.find((d) => d.id === dept)?.label ?? dept;
}

export function calculateGradeByAge(age: number): number {
  if (age <= 10) return 1;
  if (age <= 14) return 3;
  if (age <= 17) return 5;
  return 7;
}

export function validateFullNameToGrandfather(name: string): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 3;
}

export function formatMessageTarget(targetType: string, targetValue: string): string {
  if (targetType === 'all') return 'ሁሉም የሰንበት ትምህርት ቤት ክፍላት';
  if (targetType === 'teachers') return 'ሁሉም መምህራን';
  if (targetType === 'division') return `ክፍለ-ደረጃ፡ ${getDivisionLabel(targetValue as DivisionId)}`;
  if (targetType === 'grade') return `ክፍል፡ ${getGradeLabel(Number(targetValue))}`;
  if (targetType === 'department') return `ክፍል፡ ${getDepartmentLabel(targetValue as DepartmentId)}`;
  return targetValue;
}
