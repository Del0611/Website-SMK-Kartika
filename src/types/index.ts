export interface LoggedInUser {
  uid: string;
  role: string;
}

export interface StudentInfo {
  uid: string;
  fullName: string;
  nis: string;
  class: string;
  major: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'parent';
  studentId?: string;
}

export interface Grade {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  type: string;
  teacherId: string;
  teacherName?: string;
  semester: string;
  year: string;
  date: string;
  deleted?: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  description: string;
  deadline: string;
  targetClass: string;
  targetMajor: string;
  teacherId: string;
  teacherName: string;
  semester: string;
  year: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  submittedAt: string;
  grade?: number;
  feedback?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  month: string;
  year: number;
  status: 'paid' | 'unpaid';
  amount: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  category: string;
}

export interface DashboardConfig {
  welcomeTitle: string;
  welcomeDescription: string;
  schoolEmail: string;
  schoolPhone: string;
}

export type Tab = 'dashboard' | 'assignments' | 'grades' | 'payments' | 'admin_users' | 'profile';
