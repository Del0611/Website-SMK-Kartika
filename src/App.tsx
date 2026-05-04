/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { 
  LayoutDashboard, 
  BookOpen, 
  CreditCard, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  School,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  Search,
  Trash2,
  Upload,
  FileSpreadsheet,
  Download,
  Save,
  ArrowUpDown,
  Filter,
  Megaphone,
  Calendar,
  Pencil
} from 'lucide-react';

// Types
interface LoggedInUser {
  uid: string;
  role: string;
}
interface StudentInfo {
  uid: string;
  fullName: string;
  nis: string;
  class: string;
  major: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'parent';
  studentId?: string; // For parents to track their child
}

interface Grade {
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

interface Assignment {
  id: string;
  title: string;
  subject: string;
  description: string;
  deadline: string;
  targetClass: string;
  targetMajor: string;
  teacherId: string;
  teacherName: string;
  createdAt: string;
}

interface Submission {
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

interface Payment {
  id: string;
  studentId: string;
  month: string;
  year: number;
  status: 'paid' | 'unpaid';
  amount: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  category: string;
}

interface DashboardConfig {
  welcomeTitle: string;
  welcomeDescription: string;
  schoolEmail: string;
  schoolPhone: string;
}

type Tab = 'dashboard' | 'assignments' | 'payments' | 'profile';

export default function App() {
  const [session, setSession] = useState<LoggedInUser | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({
    welcomeTitle: 'SMK Kartika XX-1 Makassar',
    welcomeDescription: 'Selamat Datang di Sistem Informasi Akademik SMK Kartika XX-1 Makassar. Kelola nilai, tugas, dan pembayaran sekolah dalam satu platform.',
    schoolEmail: 'info@smkkartika-mks.sch.id',
    schoolPhone: '(0411) 123456'
  });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [allUsers, setAllUsers] = useState<StudentInfo[]>([]); // For admins

  // Initialize Firebase Auth (Anonymous)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch(err => {
          console.error("Anonymous Sign-in failed:", err);
          setIsAuthReady(true);
        });
      } else {
        setIsAuthReady(true);
      }
    });

    const savedSession = localStorage.getItem('eduportal_session');
    if (savedSession) {
      const data = JSON.parse(savedSession);
      setSession(data);
    }
    setLoading(false);
    
    return () => unsub();
  }, []);

  // Fetch Profile and Data when session changes
  useEffect(() => {
    if (!session) {
      setStudentInfo(null);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userDoc = doc(db, 'users', session.uid);
        const snap = await getDoc(userDoc);
        if (snap.exists()) {
          setStudentInfo(snap.data() as StudentInfo);
        } else {
          // If profile missing, logout
          handleLogout();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${session.uid}`);
      }
    };

    fetchProfile();
  }, [session]);

  const handleLogout = () => {
    localStorage.removeItem('eduportal_session');
    setSession(null);
    setStudentInfo(null);
  };

  // Fetch Data
  useEffect(() => {
    if (!session) return;

    // Announcements
    const annQuery = query(collection(db, 'announcements'));
    const unsubAnn = onSnapshot(annQuery, async (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'announcements'));

    // Dashboard Config
    const unsubConfig = onSnapshot(doc(db, 'settings', 'dashboard'), (snap) => {
      if (snap.exists()) {
        setDashboardConfig(snap.data() as DashboardConfig);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/dashboard'));

    // Assignments
    let asgQuery;
    if (studentInfo?.role === 'student') {
      asgQuery = query(
        collection(db, 'assignments'), 
        where('targetClass', 'in', [studentInfo.class, 'Semua Kelas']),
      );
      // Note: Firestore doesn't support 'where field in list' combined with another complex filter easily without index.
      // I'll filter the rest in memory or just use a broader query for simplicity in this demo.
    } else if (studentInfo?.role === 'teacher') {
      asgQuery = query(
        collection(db, 'assignments'),
        where('teacherId', '==', session.uid)
      );
    } else {
      asgQuery = query(collection(db, 'assignments'));
    }

    const unsubAsg = onSnapshot(asgQuery, (snap) => {
      let filtered = snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
      if (studentInfo?.role === 'student') {
        // Additional memory filter for major since 'in' and multiple 'where' can be tricky
        filtered = filtered.filter(a => 
          (a.targetMajor === studentInfo.major || a.targetMajor === 'Semua Jurusan')
        );
      }
      setAssignments(filtered);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'assignments'));

    // Payments
    let payQuery;
    if (studentInfo?.role === 'admin') {
      payQuery = query(collection(db, 'payments'));
    } else {
      payQuery = query(collection(db, 'payments'), where('studentId', '==', session.uid));
    }
    const unsubPay = onSnapshot(payQuery, async (snap) => {
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'payments'));

    // Grades
    let gradeQuery;
    if (studentInfo?.role === 'student') {
      gradeQuery = query(collection(db, 'grades'), where('studentId', '==', session.uid));
    } else if (studentInfo?.role === 'parent' && studentInfo.studentId) {
      gradeQuery = query(collection(db, 'grades'), where('studentId', '==', studentInfo.studentId));
    } else if (studentInfo?.role === 'teacher') {
      gradeQuery = query(collection(db, 'grades'), where('teacherId', '==', session.uid));
    } else if (studentInfo?.role === 'admin') {
      gradeQuery = query(collection(db, 'grades'));
    }

    const unsubGrade = gradeQuery ? onSnapshot(gradeQuery, async (snap) => {
      setGrades(snap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'grades')) : () => {};

    // For everyone: get all teachers (so names can be resolved in tables)
    // For admins: get all users
    let unsubUsers = () => {};
    if (studentInfo?.role === 'admin') {
      const allUsersQuery = query(collection(db, 'users'));
      unsubUsers = onSnapshot(allUsersQuery, (snap) => {
        setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as StudentInfo)));
      });
    } else {
      // Students, Teachers, Parents should at least see teachers' names
      const teachersQuery = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin']));
      const unsubTeachers = onSnapshot(teachersQuery, (snap) => {
        const teachers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as StudentInfo));
        
        if (studentInfo?.role === 'teacher') {
          // If teacher, they also need to see students
          const studentQuery = query(collection(db, 'users'), where('role', '==', 'student'));
          onSnapshot(studentQuery, (sSnap) => {
            const studentsList = sSnap.docs.map(d => ({ uid: d.id, ...d.data() } as StudentInfo));
            setAllUsers([...teachers, ...studentsList]);
          });
        } else {
          setAllUsers(teachers);
        }
      });
      unsubUsers = unsubTeachers;
    }

    return () => {
      unsubAnn();
      unsubConfig();
      unsubAsg();
      unsubPay();
      unsubGrade();
      unsubUsers();
    };
  }, [session, studentInfo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!session) {
    return <LoginView 
      isAuthReady={isAuthReady}
      onLogin={(user) => {
        localStorage.setItem('eduportal_session', JSON.stringify(user));
        setSession(user);
      }} 
    />;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assignments', label: 'Tugas', icon: BookOpen },
    { id: 'grades', label: 'Nilai', icon: CheckCircle2 },
    ...(studentInfo?.role === 'admin' || studentInfo?.role === 'student' ? [{ id: 'payments', label: 'SPP', icon: CreditCard }] : []),
    ...(studentInfo?.role === 'admin' ? [{ id: 'admin_users', label: 'Manajemen User', icon: UserIcon }] : []),
    { id: 'profile', label: 'Profil', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex font-sans text-white">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#121212] border-r border-[#1F1F1F] z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg shadow-black/20">
              <img src="/logo.png" alt="Logo SMK Kartika" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg leading-tight tracking-tight text-white">SMK Kartika XX-1 Makassar</span>
          </div>

          <nav className="flex-1 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as Tab);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-400 hover:bg-[#1F1F1F] hover:text-white'}`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-[#1F1F1F]">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-900/10 transition-all font-sans"
            >
              <LogOut className="w-5 h-5" />
              Keluar Akun
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-[#121212] border-b border-[#1F1F1F] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-[#1F1F1F] rounded-lg text-gray-400"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold text-white capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-3 lg:gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-white">{studentInfo?.fullName}</p>
              <p className="text-xs text-gray-500">{studentInfo?.role} {studentInfo?.class ? `- ${studentInfo.class}` : ''}</p>
            </div>
            <div className="w-10 h-10 bg-white rounded-full border-2 border-brand-primary shadow-sm overflow-hidden p-0.5">
              <img src="/logo.png" alt="Avatar" className="w-full h-full object-contain" />
            </div>
          </div>
        </header>

        {/* View Port */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-6xl mx-auto"
            >
              {activeTab === 'dashboard' && <DashboardView announcements={announcements} role={studentInfo?.role} config={dashboardConfig} />}
              {activeTab === 'assignments' && <AssignmentsView assignments={assignments} user={studentInfo} />}
              {activeTab === 'grades' && <GradesView grades={grades} role={studentInfo?.role} students={allUsers} currentUserName={studentInfo?.fullName || studentInfo?.email?.split('@')[0] || 'Guru'} />}
              {activeTab === 'payments' && <PaymentsView payments={payments} role={studentInfo?.role} students={allUsers} />}
              {activeTab === 'admin_users' && studentInfo?.role === 'admin' && <AdminUsersView users={allUsers} />}
              {activeTab === 'profile' && <ProfileView studentInfo={studentInfo} uid={session.uid} setStudentInfo={setStudentInfo} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function GradesView({ grades, role, students, currentUserName }: { grades: Grade[], role?: string, students: StudentInfo[], currentUserName: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('');
  const [score, setScore] = useState('');
  const [semester, setSemester] = useState('Ganjil');
  const [type, setType] = useState('Tugas');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Search and Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'subject' | 'score' | 'studentName' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Excel Import
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number, total: number } | null>(null);

  const handleGradeImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert('File kosong!');
          return;
        }

        setImportProgress({ current: 0, total: data.length });

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const { nis, nama, kelas, jurusan, subject: rowSubject, score: rowScore, type: rowType, semester: rowSemester, year } = row;

          // Find student by NIS or Name + Class + Major
          let targetStudent = students.find(s => s.nis === String(nis));
          if (!targetStudent && nama) {
            targetStudent = students.find(s => 
              s.fullName?.toLowerCase() === String(nama).toLowerCase() && 
              (!kelas || s.class === String(kelas)) &&
              (!jurusan || s.major === String(jurusan))
            );
          }

          if (!targetStudent || !rowSubject || rowScore === undefined) {
            console.warn(`Baris ${i + 1} dilewati: Siswa tidak ditemukan atau data tidak lengkap.`);
            continue;
          }

          const gradeId = `grade_import_${Date.now()}_${i}`;
          await setDoc(doc(db, 'grades', gradeId), {
            studentId: targetStudent.uid,
            subject: String(rowSubject),
            score: Number(rowScore),
            type: String(rowType || 'Tugas'),
            teacherId: auth.currentUser?.uid || 'system',
            teacherName: currentUserName,
            semester: String(rowSemester || 'Ganjil'),
            year: String(year || '2025/2026'),
            date: new Date().toISOString()
          });

          setImportProgress({ current: i + 1, total: data.length });
        }

        alert('Import nilai berhasil diselesaikan!');
        setIsImportModalOpen(false);
        setImportProgress(null);
      } catch (error: any) {
        console.error(error);
        alert('Gagal mengimport file: ' + error.message);
        setImportProgress(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadGradeTemplate = () => {
    const templateData = [
      {
        nis: '12345',
        nama: 'Budi Santoso',
        kelas: 'X-IPA-1',
        jurusan: 'IPA',
        subject: 'Matematika',
        score: 85,
        type: 'UTS',
        semester: 'Ganjil',
        year: '2025/2026'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grades");
    XLSX.writeFile(wb, "eduportal_nilai_template.xlsx");
  };

  const addGrade = async () => {
    if (!studentId || !subject || !score) return;
    try {
      const id = editingGrade?.id || Date.now().toString() + Math.random().toString();
      await setDoc(doc(db, 'grades', id), {
        studentId,
        subject,
        score: Number(score),
        type,
        teacherId: auth.currentUser?.uid || 'system',
        teacherName: editingGrade?.teacherName || currentUserName,
        semester,
        year: '2025/2026',
        date: date || new Date().toISOString()
      }, { merge: true });
      setIsModalOpen(false);
      setEditingGrade(null);
      setStudentId('');
      setSubject('');
      setScore('');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    }
  };

  const deleteGrade = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'grades', id));
      setDeleteConfirmationId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `grades/${id}`);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Process grades (Filter -> Search -> Sort)
  const processedGrades = useMemo(() => {
    let result = grades.filter(g => !(g as any).deleted);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g => {
        const student = students.find(s => s.uid === g.studentId);
        return (
          g.subject.toLowerCase().includes(q) ||
          student?.fullName.toLowerCase().includes(q) ||
          student?.nis?.toLowerCase().includes(q) ||
          student?.class?.toLowerCase().includes(q) ||
          student?.major?.toLowerCase().includes(q) ||
          g.teacherName?.toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => {
      let valA: any, valB: any;
      if (sortField === 'studentName') {
        valA = students.find(s => s.uid === a.studentId)?.fullName || '';
        valB = students.find(s => s.uid === b.studentId)?.fullName || '';
      } else {
        valA = a[sortField] || '';
        valB = b[sortField] || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [grades, searchQuery, sortField, sortOrder, students]);

  return (
    <div className="space-y-6">
      <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold font-sans tracking-tight text-white">Laporan Nilai Siswa</h3>
          <p className="text-gray-500 text-sm">Kelola dan pantau transkrip nilai akademik siswa.</p>
        </div>
        <div className="flex items-center gap-3">
          {(role === 'teacher' || role === 'admin') && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="bg-[#1A1A1A] hover:bg-[#2A2A2A] text-gray-200 px-4 py-3 rounded-2xl transition border border-[#2A2A2A] font-bold text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Import Excel
              </button>
              <button 
                onClick={() => {
                  setEditingGrade(null);
                  setStudentId('');
                  setSubject('');
                  setScore('');
                  setIsModalOpen(true);
                }}
                className="bg-brand-primary hover:bg-brand-primary/80 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-brand-primary/20 font-bold text-sm flex items-center gap-2"
              >
                <Plus className="w-5 h-5" /> Input Nilai
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Cari berdasarkan nama siswa atau mata pelajaran..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121212] border border-[#1F1F1F] rounded-2xl py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-brand-primary/50 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleSort('date')}
              className={`px-4 py-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${sortField === 'date' ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary' : 'bg-[#121212] border-[#1F1F1F] text-gray-500 hover:text-gray-300'}`}
            >
              <ArrowUpDown className="w-3 h-3" /> Tanggal
            </button>
            <button 
              onClick={() => toggleSort('score')}
              className={`px-4 py-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${sortField === 'score' ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary' : 'bg-[#121212] border-[#1F1F1F] text-gray-500 hover:text-gray-300'}`}
            >
              <ArrowUpDown className="w-3 h-3" /> Nilai
            </button>
        </div>
      </div>

      <div className="bg-[#121212] rounded-3xl border border-[#1F1F1F] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1F1F1F] bg-[#1A1A1A]">
                {(role === 'teacher' || role === 'admin') && (
                  <th 
                    className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-brand-primary"
                    onClick={() => toggleSort('studentName')}
                  >
                    <div className="flex items-center gap-2">Siswa <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                  </th>
                )}
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-brand-primary"
                  onClick={() => toggleSort('subject')}
                >
                  <div className="flex items-center gap-2">Mata Pelajaran <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-brand-primary"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center gap-2">Tanggal <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                </th>
                {(role === 'teacher' || role === 'admin') && (
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Kelas</th>
                )}
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Guru</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Semester</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Nilai</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                {(role === 'teacher' || role === 'admin') && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {processedGrades.length > 0 ? processedGrades.map(grade => {
                const student = students.find(s => s.uid === grade.studentId);
                const teacher = students.find(s => s.uid === grade.teacherId);
                return (
                  <tr key={grade.id} className="hover:bg-[#1A1A1A] transition-colors">
                    {(role === 'teacher' || role === 'admin') && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand-primary/10 rounded-full overflow-hidden shrink-0 p-1 border border-brand-primary/20">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-200 truncate">{student?.fullName || 'Siswa'}</p>
                            <p className="text-[10px] text-gray-500">{student?.class || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-200 text-sm">{grade.subject}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{grade.type || 'Nilai'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-400 font-medium">{grade.date ? new Date(grade.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</div>
                    </td>
                    {(role === 'teacher' || role === 'admin') && (
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-400 font-medium">{student?.class || 'N/A'}</div>
                        <div className="text-[9px] text-gray-600 uppercase tracking-tight">{student?.major || '-'}</div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-brand-primary">{teacher?.fullName || grade.teacherName || 'Sistem'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{grade.semester} {grade.year}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xl font-black font-mono ${grade.score >= 75 ? 'text-brand-primary' : 'text-red-400'}`}>
                        {grade.score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${grade.score >= 75 ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'bg-red-900/30 text-red-400 border border-red-500/20'}`}>
                        {grade.score >= 75 ? 'Lulus' : 'Remedial'}
                      </span>
                    </td>
                    {(role === 'teacher' || role === 'admin') && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingGrade(grade);
                              setStudentId(grade.studentId);
                              setSubject(grade.subject);
                              setScore(grade.score.toString());
                              setSemester(grade.semester);
                              setType(grade.type || 'Tugas');
                              setDate(grade.date ? (grade.date.includes('T') ? grade.date.split('T')[0] : grade.date) : new Date().toISOString().split('T')[0]);
                              setIsModalOpen(true);
                            }}
                            className="p-2 hover:bg-emerald-900/20 rounded-lg text-emerald-400 transition"
                            title="Edit"
                          >
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmationId(grade.id)}
                            className="p-2 hover:bg-red-900/20 rounded-lg text-red-400 transition"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={role === 'teacher' || role === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-gray-500 text-sm italic border-dashed border-t border-[#1F1F1F]">
                    {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Belum ada data nilai yang masuk.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Nilai */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-md w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">{editingGrade ? 'Edit Nilai Siswa' : 'Input Nilai Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Pilih Siswa</label>
                  <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">-- Pilih Siswa --</option>
                    {students.filter(s => s.role === 'student').map(s => (
                      <option key={s.uid} value={s.uid}>{s.fullName} ({s.class})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Mata Pelajaran</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Contoh: Fisika" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Jenis Nilai</label>
                    <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none">
                      <option value="Tugas">Tugas</option>
                      <option value="Kuis">Kuis</option>
                      <option value="UTS">UTS</option>
                      <option value="UAS">UAS</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Nilai (0-100)</label>
                    <input type="number" value={score} onChange={e => setScore(e.target.value)} placeholder="85" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Semester</label>
                    <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none">
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Tanggal Penilaian</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" 
                  />
                </div>
                <button onClick={addGrade} className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-4 rounded-2xl transition mt-6 shadow-lg shadow-brand-primary/20">
                  {editingGrade ? 'Simpan Perubahan' : 'Simpan Nilai'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isImportModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsImportModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-md w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">Import Nilai (Excel)</h3>
                <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#2A2A2A] rounded-2xl p-10 bg-[#0A0A0A]">
                  <Upload className="w-10 h-10 text-emerald-500 mb-4 opacity-50" />
                  <p className="text-sm text-gray-400 mb-4 text-center">Seret file Excel ke sini atau klik untuk memilih</p>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleGradeImport}
                    className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
                    id="grade-excel-upload"
                  />
                  <label htmlFor="grade-excel-upload" className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 px-6 py-2 rounded-xl transition font-bold text-xs cursor-pointer border border-emerald-500/30">
                    Pilih File
                  </label>
                </div>

                {importProgress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <span>Progres Import</span>
                      <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        className="h-full bg-brand-primary"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 italic">Memproses {importProgress.current} dari {importProgress.total} baris...</p>
                  </div>
                )}

                <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-2xl">
                  <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Petunjuk Import
                  </p>
                  <ul className="text-[11px] text-gray-400 space-y-1 ml-4 list-disc">
                    <li>Gunakan NIS atau Nama (lengkap dengan Kelas/Jurusan) untuk identitas siswa.</li>
                    <li>Pastikan kolom subject, score, dan type terisi.</li>
                    <li>Unduh template di bawah agar format sesuai.</li>
                  </ul>
                  <button 
                    onClick={downloadGradeTemplate}
                    className="mt-4 text-brand-primary hover:text-brand-primary/80 text-[10px] font-bold flex items-center gap-1 underline underline-offset-4"
                  >
                    <Download className="w-3 h-3" /> Unduh Template Excel (.xlsx)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Delete Confirmation */}
        {deleteConfirmationId && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmationId(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-sm w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Hapus Data Nilai?</h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">Tindakan ini tidak dapat dibatalkan. Data nilai siswa ini akan dihapus permanen.</p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => setDeleteConfirmationId(null)}
                    className="py-3 px-6 rounded-2xl bg-[#1A1A1A] text-gray-300 font-bold text-sm hover:bg-[#2A2A2A] transition"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => deleteGrade(deleteConfirmationId)}
                    className="py-3 px-6 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardView({ announcements, role, config }: { announcements: Announcement[], role?: string, config: DashboardConfig }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [viewingAnn, setViewingAnn] = useState<Announcement | null>(null);
  
  // Announcement form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Akademik');

  // Config form state
  const [welcomeTitle, setWelcomeTitle] = useState(config.welcomeTitle);
  const [welcomeDescription, setWelcomeDescription] = useState(config.welcomeDescription);
  const [schoolEmail, setSchoolEmail] = useState(config.schoolEmail);
  const [schoolPhone, setSchoolPhone] = useState(config.schoolPhone);

  useEffect(() => {
    setWelcomeTitle(config.welcomeTitle);
    setWelcomeDescription(config.welcomeDescription);
    setSchoolEmail(config.schoolEmail);
    setSchoolPhone(config.schoolPhone);
  }, [config]);

  const handleSubmit = async () => {
    if (!title || !content) return;
    try {
      const id = editingAnn?.id || Date.now().toString() + Math.random().toString();
      await setDoc(doc(db, 'announcements', id), {
        title,
        content,
        category,
        date: new Date().toISOString()
      }, { merge: true });
      setIsModalOpen(false);
      setEditingAnn(null);
      setTitle('');
      setContent('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'announcements');
    }
  };

  const handleConfigSubmit = async () => {
    try {
      await setDoc(doc(db, 'settings', 'dashboard'), {
        welcomeTitle,
        welcomeDescription,
        schoolEmail,
        schoolPhone
      }, { merge: true });
      setIsConfigModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/dashboard');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setDeleteConfirmationId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `announcements/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-brand-primary to-brand-primary/80 p-6 rounded-3xl text-white shadow-lg shadow-brand-primary/20 col-span-full lg:col-span-2 flex flex-col justify-between min-h-[200px] relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2 font-serif italic">{config.welcomeTitle}</h3>
            <p className="text-white/80 text-sm max-w-md opacity-90">{config.welcomeDescription}</p>
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-medium border border-white/10">Buku Panduan Siswa</div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-medium border border-white/10">Kalender Akademik</div>
            </div>
            {role === 'admin' && (
              <button 
                onClick={() => setIsConfigModalOpen(true)}
                className="mt-6 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 backdrop-blur-sm"
              >
                <Plus className="w-4 h-4 rotate-45" /> Edit Dashboard
              </button>
            )}
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
            <img src="/logo.png" alt="Watermark" className="w-64 h-64 grayscale" />
          </div>
        </div>
        <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Info Kontak Sekolah</h3>
            <AlertCircle className="w-5 h-5 text-gray-600" />
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-brand-primary/10 rounded-2xl flex items-center gap-3 border border-brand-primary/20">
              <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center shadow-sm">
                <Mail className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Email</p>
                <p className="text-sm font-medium truncate text-brand-primary">{config.schoolEmail}</p>
              </div>
            </div>
            <div className="p-3 bg-brand-secondary/10 rounded-2xl flex items-center gap-3 border border-brand-secondary/20">
              <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center shadow-sm">
                <Phone className="w-4 h-4 text-brand-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Telepon</p>
                <p className="text-sm font-medium text-brand-secondary">{config.schoolPhone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-semibold text-white font-sans tracking-tight">Pengumuman Terbaru</h3>
          {(role === 'admin') && (
              <button 
                onClick={() => {
                  setEditingAnn(null);
                  setTitle('');
                  setContent('');
                  setCategory('Akademik');
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/80 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-brand-primary/20"
              >
                <Plus className="w-4 h-4" /> Tambah Baru
              </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {announcements.length > 0 ? announcements.map(ann => (
            <div key={ann.id} className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] hover:border-brand-primary/50 transition-all group relative">
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded-full border border-brand-primary/20">{ann.category}</span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(ann.date).toLocaleDateString('id-ID')}
                </span>
              </div>
              <h4 className="font-bold text-gray-200 mb-2 group-hover:text-brand-primary transition-colors uppercase tracking-tight">{ann.title}</h4>
              <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed mb-4">{ann.content}</p>
              
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => {
                    setViewingAnn(ann);
                    setIsViewModalOpen(true);
                  }}
                  className="text-brand-primary text-xs font-bold hover:underline"
                >
                  Baca Selengkapnya →
                </button>
                {role === 'admin' && (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingAnn(ann);
                        setTitle(ann.title);
                        setContent(ann.content);
                        setCategory(ann.category);
                        setIsModalOpen(true);
                      }}
                      className="p-2 hover:bg-emerald-900/20 rounded-lg text-emerald-500 transition text-[10px] font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 rotate-45" /> Edit
                    </button>
                    <button 
                      onClick={() => setDeleteConfirmationId(ann.id)}
                      className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 transition text-[10px] font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="col-span-full py-12 text-center bg-[#121212] rounded-3xl border border-dashed border-[#1F1F1F]">
              <p className="text-gray-500 text-sm">Belum ada pengumuman saat ini.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Add/Edit Announcement */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-lg w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">{editingAnn ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Judul</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Masukkan judul..." className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Kategori</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="Akademik">Akademik</option>
                    <option value="Info Umum">Info Umum</option>
                    <option value="Kegiatan">Kegiatan</option>
                    <option value="Penting">Penting</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Konten</label>
                  <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Tulis konten pengumuman..." className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
                </div>
                <button onClick={handleSubmit} className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-4 rounded-2xl transition mt-6 shadow-lg shadow-brand-primary/20">
                  {editingAnn ? 'Simpan Perubahan' : 'Terbitkan Sekarang'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal View Announcement */}
        {isViewModalOpen && viewingAnn && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsViewModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-2xl w-full bg-[#121212] rounded-[40px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                    {viewingAnn.category}
                  </span>
                </div>
                <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                <h2 className="text-3xl font-serif italic font-bold text-white mb-2 leading-tight">
                  {viewingAnn.title}
                </h2>
                <div className="flex items-center gap-2 mb-8 text-gray-500 text-xs font-medium">
                  <Calendar className="w-3 h-3" />
                  {new Date(viewingAnn.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                
                <div className="prose prose-invert max-w-none">
                  <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                    {viewingAnn.content}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#1F1F1F]">
                <button 
                  onClick={() => setIsViewModalOpen(false)}
                  className="w-full bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white font-bold py-4 rounded-2xl transition shadow-lg"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Edit Dashboard Settings */}
        {isConfigModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConfigModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-lg w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-brand-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Edit Dashboard</h3>
                </div>
                <button onClick={() => setIsConfigModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/20">
                  <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-4">Welcome Banner</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Judul Banner</label>
                      <input type="text" value={welcomeTitle} onChange={e => setWelcomeTitle(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none focus:border-brand-primary/50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Deskripsi Banner</label>
                      <textarea value={welcomeDescription} onChange={e => setWelcomeDescription(e.target.value)} rows={3} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none focus:border-brand-primary/50 resize-none" />
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-brand-secondary/5 rounded-2xl border border-brand-secondary/20">
                  <p className="text-[10px] font-bold text-brand-secondary uppercase tracking-widest mb-4">Info Kontak Sekolah</p>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Email Sekolah</label>
                      <input type="email" value={schoolEmail} onChange={e => setSchoolEmail(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none focus:border-brand-primary/50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Telepon Sekolah</label>
                      <input type="text" value={schoolPhone} onChange={e => setSchoolPhone(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none focus:border-brand-primary/50" />
                    </div>
                  </div>
                </div>
              </div>

                <button onClick={handleConfigSubmit} className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-4 rounded-2xl transition mt-4 shadow-lg shadow-brand-primary/20">
                  Simpan Perubahan Dashboard
                </button>
            </motion.div>
          </div>
        )}

        {/* Modal Delete Announcement Confirmation */}
        {deleteConfirmationId && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmationId(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-sm w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Hapus Pengumuman?</h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">Apakah Anda yakin ingin menghapus pengumuman ini?</p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => setDeleteConfirmationId(null)}
                    className="py-3 px-6 rounded-2xl bg-[#1A1A1A] text-gray-300 font-bold text-sm hover:bg-[#2A2A2A] transition"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => deleteAnnouncement(deleteConfirmationId)}
                    className="py-3 px-6 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface GradingProps {
  sub: Submission;
  onSave: (sub: Submission, grade: number, feedback: string) => Promise<void>;
  key?: string;
}

function SubmissionGradingCard({ sub, onSave }: GradingProps) {
  const [grade, setGrade] = useState(sub.grade || 0);
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync with prop updates (if needed)
  useEffect(() => {
    setGrade(sub.grade || 0);
    setFeedback(sub.feedback || '');
  }, [sub.grade, sub.feedback]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(sub, grade, feedback);
    setIsSaving(false);
  };

  return (
    <div className="p-6 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl flex flex-col md:flex-row md:items-start justify-between gap-6">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-[#1A1A1A] rounded-full overflow-hidden border border-[#2A2A2A]">
            <img src="/logo.png" alt="" className="w-full h-full object-contain p-1" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{sub.studentName}</p>
            <p className="text-[10px] text-gray-500">{new Date(sub.submittedAt).toLocaleString('id-ID')}</p>
          </div>
        </div>
        <div className="p-4 bg-[#121212] rounded-xl text-gray-400 text-sm mb-4 whitespace-pre-wrap">
          {sub.content || <span className="italic text-gray-600">Tidak ada catatan teks.</span>}
        </div>
        {sub.fileUrl && (
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-900/10 rounded-xl border border-emerald-500/20">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-400 text-[10px] font-bold">{sub.fileName}</span>
            <a href={sub.fileUrl} download={sub.fileName} className="text-white hover:underline text-[10px] ml-2">Download</a>
          </div>
        )}
      </div>
      
      <div className="w-full md:w-48 space-y-4">
         <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Nilai</label>
            <input 
              type="number" 
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500/50" 
              placeholder="0-100"
            />
         </div>
         <div>
            <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Feedback</label>
            <textarea 
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2} 
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none resize-none focus:border-emerald-500/50" 
              placeholder="Masukan..."
            />
         </div>
         <button 
           onClick={handleSave}
           disabled={isSaving}
           className="w-full py-3 bg-brand-primary hover:bg-brand-primary/80 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
         >
           {isSaving ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Nilai</>}
         </button>
      </div>
    </div>
  );
}

function AssignmentsView({ assignments, user }: { assignments: Assignment[], user: StudentInfo | null }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isViewSubmissionsOpen, setIsViewSubmissionsOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  
  const [selectedAsg, setSelectedAsg] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);

  // Form states for student submission
  const [submitContent, setSubmitContent] = useState('');
  const [submitFile, setSubmitFile] = useState<{name: string, data: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for creating/editing assignment
  const [editingAsg, setEditingAsg] = useState<Assignment | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newTargetClass, setNewTargetClass] = useState('Semua Kelas');
  const [newTargetMajor, setNewTargetMajor] = useState('Semua Jurusan');

  const [asgSearchQuery, setAsgSearchQuery] = useState('');

  // Fetch student's own submission for this assignment
  useEffect(() => {
    if (user?.role === 'student' && selectedAsg) {
      const q = query(
        collection(db, 'submissions'), 
        where('assignmentId', '==', selectedAsg.id),
        where('studentId', '==', user.uid)
      );
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setMySubmission({ id: snap.docs[0].id, ...snap.docs[0].data() } as Submission);
        } else {
          setMySubmission(null);
        }
      });
      return unsub;
    }
  }, [selectedAsg, user]);

  // Fetch all submissions for teacher
  useEffect(() => {
    if (user?.role === 'teacher' && selectedAsg && isViewSubmissionsOpen) {
      const q = query(collection(db, 'submissions'), where('assignmentId', '==', selectedAsg.id));
      const unsub = onSnapshot(q, (snap) => {
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'));
      return unsub;
    }
  }, [selectedAsg, user, isViewSubmissionsOpen]);

  // For Admins: also show submissions if they open the view
  useEffect(() => {
    if (user?.role === 'admin' && selectedAsg && isViewSubmissionsOpen) {
      const q = query(collection(db, 'submissions'), where('assignmentId', '==', selectedAsg.id));
      const unsub = onSnapshot(q, (snap) => {
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'));
      return unsub;
    }
  }, [selectedAsg, user, isViewSubmissionsOpen]);

  const saveGrade = async (sub: Submission, grade: number, feedback: string) => {
    try {
      await setDoc(doc(db, 'submissions', sub.id), { 
        grade, 
        feedback,
        gradedAt: new Date().toISOString() 
      }, { merge: true });
      
      // Also sync to main grades collection for report card
      const gradeId = `grade_asg_${sub.id}`;
      await setDoc(doc(db, 'grades', gradeId), {
        studentId: sub.studentId,
        subject: selectedAsg?.subject || 'Tugas',
        score: grade,
        type: 'Tugas',
        assignmentId: sub.assignmentId,
        date: new Date().toISOString(),
        teacherId: user?.uid
      }, { merge: true });

      alert(`Nilai untuk ${sub.studentName} berhasil disimpan!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `submissions/${sub.id}`);
    }
  };

  const saveAssignment = async () => {
    if (!newTitle || !newSubject || !newDeadline || !user) return;
    try {
      const id = editingAsg?.id || Date.now().toString();
      await setDoc(doc(db, 'assignments', id), {
        title: newTitle,
        subject: newSubject,
        description: newDescription,
        deadline: newDeadline,
        targetClass: newTargetClass,
        targetMajor: newTargetMajor,
        teacherId: editingAsg?.teacherId || user.uid,
        teacherName: editingAsg?.teacherName || user.fullName,
        createdAt: editingAsg?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setIsModalOpen(false);
      setEditingAsg(null);
      // Reset
      setNewTitle('');
      setNewSubject('');
      setNewDescription('');
      setNewDeadline('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assignments');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Firestore has a 1MB limit per document. 
    // Base64 encoding increases size by ~33%. 
    // Plus other metadata, 500KB is a safe limit.
    if (file.size > 500 * 1024) { 
      alert('Ukuran file terlalu besar. Maksimal 500KB untuk database ini. Silakan gunakan link Google Drive/Dropbox jika file lebih besar.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const b64 = evt.target?.result as string;
      setSubmitFile({ name: file.name, data: b64 });
    };
    reader.readAsDataURL(file);
  };

  const submitAssignment = async () => {
    if (!selectedAsg || !user) return;
    setIsSubmitting(true);
    try {
      const id = mySubmission?.id || `sub_${selectedAsg.id}_${user.uid}`;
      
      const submissionData = {
        assignmentId: selectedAsg.id,
        studentId: user.uid,
        studentName: user.fullName,
        content: submitContent,
        fileName: submitFile?.name || '',
        fileUrl: submitFile?.data || '',
        submittedAt: new Date().toISOString()
      };

      // Final size check
      const sizeEstimate = JSON.stringify(submissionData).length;
      if (sizeEstimate > 1024 * 1024) {
        throw new Error('Data pengumpulan terlalu besar (Maks 1MB). Kurangi teks atau ukuran file.');
      }

      await setDoc(doc(db, 'submissions', id), submissionData, { merge: true });
      
      alert('Tugas berhasil dikumpulkan!');
      setIsSubmitModalOpen(false);
      setSubmitContent('');
      setSubmitFile(null);
    } catch (error) {
      if (error instanceof Error && error.message.includes('too large')) {
         alert('Gagal: Ukuran data melebihi batas (1MB). Silakan perkecil ukuran file.');
      }
      handleFirestoreError(error, OperationType.WRITE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'assignments', id));
      setDeleteConfirmationId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `assignments/${id}`);
    }
  };

  const processedAssignments = useMemo(() => {
    if (!asgSearchQuery) return assignments;
    const q = asgSearchQuery.toLowerCase();
    return assignments.filter(asg => 
      asg.title.toLowerCase().includes(q) || 
      asg.subject.toLowerCase().includes(q) ||
      asg.teacherName?.toLowerCase().includes(q) ||
      asg.targetClass?.toLowerCase().includes(q) ||
      asg.targetMajor?.toLowerCase().includes(q)
    );
  }, [assignments, asgSearchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] gap-4">
        <div>
          <h3 className="text-xl font-bold font-sans tracking-tight text-white">{user?.role === 'student' ? 'Daftar Tugas Anda' : 'Manajemen Tugas'}</h3>
          <p className="text-gray-500 text-sm">{user?.role === 'student' ? 'Lihat dan kerjakan tugas dari guru Anda.' : 'Kelola tugas yang diberikan kepada siswa.'}</p>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <button 
              onClick={() => {
                setEditingAsg(null);
                setNewTitle('');
                setNewSubject('');
                setNewDescription('');
                setNewDeadline('');
                setNewTargetClass('Semua Kelas');
                setNewTargetMajor('Semua Jurusan');
                setIsModalOpen(true);
              }}
              className="bg-brand-primary hover:bg-brand-primary/80 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-brand-primary/20 font-bold text-sm flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Buat Tugas
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input 
          type="text" 
          placeholder="Cari tugas berdasarkan judul, mata pelajaran, atau guru..." 
          value={asgSearchQuery}
          onChange={(e) => setAsgSearchQuery(e.target.value)}
          className="w-full bg-[#121212] border border-[#1F1F1F] rounded-2xl py-4 pl-11 pr-4 text-sm text-white outline-none focus:border-brand-primary/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {processedAssignments.map(asg => (
          <div key={asg.id} className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] hover:border-emerald-600/30 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-emerald-900/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-emerald-500/10">
                  {asg.subject}
                </span>
                {(user?.role === 'teacher' || user?.role === 'admin') && (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingAsg(asg);
                        setNewTitle(asg.title);
                        setNewSubject(asg.subject);
                        setNewDescription(asg.description || '');
                        setNewDeadline(asg.deadline);
                        setNewTargetClass(asg.targetClass || 'Semua Kelas');
                        setNewTargetMajor(asg.targetMajor || 'Semua Jurusan');
                        setIsModalOpen(true);
                      }} 
                      className="p-2 text-gray-600 hover:text-emerald-500 transition"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                    <button onClick={() => setDeleteConfirmationId(asg.id)} className="p-2 text-gray-600 hover:text-red-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <h4 className="font-bold text-gray-200 mb-1">{asg.title}</h4>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">{asg.teacherName || 'Guru'}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 mb-4">{asg.description || 'Tidak ada deskripsi.'}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                  <Clock className="w-3 h-3 text-emerald-500" /> Deadline: {new Date(asg.deadline).toLocaleDateString('id-ID')}
                </div>
                {(user?.role === 'teacher' || user?.role === 'admin') && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                    <School className="w-3 h-3 text-blue-500" /> Target: {asg.targetClass} - {asg.targetMajor}
                  </div>
                )}
              </div>
            </div>

            {user?.role === 'student' ? (
              <button 
                onClick={() => {
                  setSelectedAsg(asg);
                  setIsSubmitModalOpen(true);
                }}
                className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${mySubmission ? 'bg-[#1A1A1A] text-brand-primary border border-brand-primary/20' : 'bg-brand-primary text-white hover:bg-brand-primary/80'}`}
              >
                {mySubmission ? (
                  <><CheckCircle2 className="w-4 h-4" /> Sudah Dikumpul</>
                ) : (
                  'Kerjakan / Kumpulkan'
                )}
              </button>
            ) : (
              <button 
                onClick={() => {
                  setSelectedAsg(asg);
                  setIsViewSubmissionsOpen(true);
                }}
                className="w-full py-3 bg-[#1A1A1A] border border-[#2A2A2A] text-white hover:bg-[#2A2A2A] rounded-xl text-xs font-bold transition"
              >
                Lihat Pengumpulan
              </button>
            )}
          </div>
        ))}
        {processedAssignments.length === 0 && (
          <div className="col-span-full py-20 text-center bg-[#121212] rounded-[40px] border border-dashed border-[#1F1F1F]">
             <BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" />
             <p className="text-gray-500">{asgSearchQuery ? `Tidak ada tugas untuk "${asgSearchQuery}"` : 'Belum ada tugas yang tersedia.'}</p>
          </div>
        )}
      </div>

      {/* Teacher/Admin: Create/Edit Assignment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-xl w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">{editingAsg ? 'Edit Tugas' : 'Buat Tugas Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Judul Tugas</label>
                    <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Contoh: Latihan Bab 1" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500/50" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Mata Pelajaran</label>
                    <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Fisika" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none focus:border-emerald-500/50" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Target Kelas</label>
                    <select value={newTargetClass} onChange={e => setNewTargetClass(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none">
                      <option value="Semua Kelas">Semua Kelas</option>
                      <option value="X">Kelas X</option>
                      <option value="XI">Kelas XI</option>
                      <option value="XII">Kelas XII</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Jurusan</label>
                    <select value={newTargetMajor} onChange={e => setNewTargetMajor(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none">
                      <option value="Semua Jurusan">Semua Jurusan</option>
                      <option value="Teknik Instalasi Tenaga Listrik">Teknik Instalasi Tenaga Listrik</option>
                      <option value="Teknik Komputer dan Jaringan">Teknik Komputer dan Jaringan</option>
                      <option value="Rekayasa Perangkat Lunak">Rekayasa Perangkat Lunak</option>
                      <option value="Teknik Pemesinan">Teknik Pemesinan</option>
                      <option value="Teknik Kendaraan Ringan">Teknik Kendaraan Ringan</option>
                      <option value="Teknik Sepeda Motor">Teknik Sepeda Motor</option>
                      <option value="Desain Komunikasi Visual / Multimedia">Desain Komunikasi Visual / Multimedia</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Deadline</label>
                  <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none" />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Deskripsi / Instruksi</label>
                  <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={4} placeholder="Tulis instruksi tugas di sini..." className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none resize-none focus:border-brand-primary/50" />
                </div>

                <button onClick={saveAssignment} className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-4 rounded-2xl transition mt-4 shadow-lg shadow-brand-primary/20">
                  {editingAsg ? 'Simpan Perubahan' : 'Terbitkan Tugas'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student: Submit Assignment Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && selectedAsg && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSubmitModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-xl w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white">Kumpulkan: {selectedAsg.title}</h3>
                  <p className="text-gray-500 text-xs">Instruksi: {selectedAsg.description || '-'}</p>
                </div>
                <button onClick={() => setIsSubmitModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
              </div>

              {mySubmission ? (
                <div className="space-y-6">
                  <div className="p-6 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
                    <p className="text-brand-primary font-bold text-sm mb-2">Tugas Anda Sudah Dikumpulkan</p>
                    <p className="text-gray-400 text-xs mb-4">Dikirim pada: {new Date(mySubmission.submittedAt).toLocaleString('id-ID')}</p>
                    <div className="p-4 bg-[#0A0A0A] rounded-xl text-gray-300 text-xs whitespace-pre-wrap mb-4">
                      {mySubmission.content || 'Hanya melampirkan file.'}
                    </div>
                    {mySubmission.fileName && (
                    <div className="flex items-center gap-2 p-3 bg-brand-primary/10 rounded-xl border border-brand-primary/20 text-brand-primary text-xs">
                         <FileSpreadsheet className="w-4 h-4" /> {mySubmission.fileName}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setMySubmission(null)} className="w-full py-4 text-gray-500 hover:text-white text-xs font-bold transition">Tarik Pengumpulan & Edit</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Jawaban / Catatan (Teks)</label>
                    <textarea value={submitContent} onChange={e => setSubmitContent(e.target.value)} rows={4} placeholder="Tulis jawaban atau catatan di sini..." className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none resize-none" />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-2 block">Lampiran Dokumen/Foto (Maks 2MB)</label>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 flex items-center justify-center gap-2 p-4 bg-[#1A1A1A] border-2 border-dashed border-[#2A2A2A] rounded-2xl hover:border-emerald-600/50 cursor-pointer transition">
                        <Upload className="w-5 h-5 text-gray-500" />
                        <span className="text-sm text-gray-400 font-medium">{submitFile ? submitFile.name : 'Pilih File'}</span>
                        <input type="file" className="hidden" accept=".jpg,.png,.pdf,.docx,.doc" onChange={handleFileUpload} />
                      </label>
                      {submitFile && (
                        <button onClick={() => setSubmitFile(null)} className="p-4 bg-red-900/10 text-red-500 rounded-2xl border border-red-500/20">
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <button 
                    disabled={isSubmitting}
                    onClick={submitAssignment} 
                    className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Mengirim...' : 'Kumpulkan Sekarang'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Teacher: View Submissions Modal */}
      <AnimatePresence>
        {isViewSubmissionsOpen && selectedAsg && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsViewSubmissionsOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-4xl w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white">Pengumpulan: {selectedAsg.title}</h3>
                  <p className="text-gray-500 text-xs">Total: {submissions.length} siswa telah mengumpulkan.</p>
                </div>
                <button onClick={() => setIsViewSubmissionsOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {submissions.map(sub => (
                  <SubmissionGradingCard key={sub.id} sub={sub} onSave={saveGrade} />
                ))}

                {submissions.length === 0 && (
                  <div className="py-20 text-center text-gray-500 italic">Belum ada siswa yang mengumpulkan tugas ini.</div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Delete Assignment Confirmation */}
        {deleteConfirmationId && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmationId(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-sm w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Hapus Tugas?</h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">Tindakan ini tidak dapat dibatalkan. Tugas dan data pengumpulan siswa akan dihapus permanen.</p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => setDeleteConfirmationId(null)}
                    className="py-3 px-6 rounded-2xl bg-[#1A1A1A] text-gray-300 font-bold text-sm hover:bg-[#2A2A2A] transition"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => deleteAssignment(deleteConfirmationId)}
                    className="py-3 px-6 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


function PaymentsView({ payments, role, students }: { payments: Payment[], role?: string, students: StudentInfo[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState('');
  const [month, setMonth] = useState('Januari');
  const [year, setYear] = useState('2025');
  const [amount, setAmount] = useState('500000');
  const [status, setStatus] = useState<'paid' | 'unpaid'>('paid');

  const savePayment = async () => {
    if (!studentId) return;
    try {
      const id = editingId || Date.now().toString() + Math.random().toString();
      await setDoc(doc(db, 'payments', id), {
        studentId,
        month,
        year,
        amount: Number(amount),
        status,
        date: new Date().toISOString()
      }, { merge: true });
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, editingId ? `payments/${editingId}` : 'payments');
    }
  };

  const deletePayment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'payments', id));
      setDeleteConfirmationId(null);
    } catch (error) {
      console.error('Delete error:', error);
      handleFirestoreError(error, OperationType.DELETE, `payments/${id}`);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setStudentId('');
    setMonth('Januari');
    setYear('2025');
    setAmount('500000');
    setStatus('paid');
  };

  const openEditModal = (pay: Payment) => {
    setEditingId(pay.id);
    setStudentId(pay.studentId);
    setMonth(pay.month);
    setYear(pay.year || '2025');
    setAmount(pay.amount.toString());
    setStatus(pay.status);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold font-sans tracking-tight text-white">Status Pembayaran SPP</h3>
          <p className="text-gray-500 text-sm">Berikut adalah riwayat pembayaran iuran sekolah.</p>
        </div>
        {role === 'admin' && (
          <button 
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-emerald-900/20 font-bold text-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Catat Pembayaran
          </button>
        )}
        {role !== 'admin' && (
          <div className="px-4 py-2 bg-emerald-900/20 rounded-2xl flex items-center gap-2 border border-emerald-500/20">
            <AlertCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-300">Hubungi Tata Usaha jika ada kendala data</span>
          </div>
        )}
      </div>

      <div className="bg-[#121212] rounded-3xl border border-[#1F1F1F] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1F1F1F] bg-[#1A1A1A]">
                {role === 'admin' && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Siswa</th>}
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Kelas</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Jurusan</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Bulan</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Tahun</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Nominal</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F1F1F]">
              {payments.length > 0 ? payments.map(pay => {
                const student = students.find(s => s.uid === pay.studentId);
                return (
                  <tr key={pay.id} className="hover:bg-[#1A1A1A] transition-colors">
                    {role === 'admin' && (
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-200">{student?.fullName || 'Siswa'}</p>
                        <p className="text-[10px] text-gray-500">{student?.nis || pay.studentId.substring(0, 8)}</p>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-400 font-medium">{student?.class || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] text-gray-600 uppercase tracking-tight">{student?.major || '-'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-200">{pay.month}</td>
                    <td className="px-6 py-4 text-gray-500">{pay.year}</td>
                    <td className="px-6 py-4 font-mono font-bold text-sm text-emerald-400">Rp {pay.amount.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${pay.status === 'paid' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20' : 'bg-red-900/30 text-red-400 border border-red-500/20'}`}>
                        {pay.status === 'paid' ? 'Lunas' : 'Belum Bayar'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {role === 'admin' && (
                          <>
                            <button 
                              onClick={() => openEditModal(pay)}
                              className="p-2 hover:bg-white/5 text-gray-400 hover:text-emerald-500 transition-colors rounded-lg"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmationId(pay.id)}
                              className="p-2 hover:bg-white/5 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {role !== 'admin' && <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter italic">Siswa</span>}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={role === 'admin' ? 8 : 7} className="px-6 py-12 text-center text-gray-500 text-sm italic">Data pembayaran belum tersedia.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirmationId && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmationId(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-sm w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Hapus Catatan SPP?</h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">Tindakan ini tidak dapat dibatalkan. Riwayat pembayaran siswa ini akan hilang secara permanen.</p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => setDeleteConfirmationId(null)}
                    className="py-3 px-6 rounded-2xl bg-[#1A1A1A] text-gray-300 font-bold text-sm hover:bg-[#2A2A2A] transition"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => deletePayment(deleteConfirmationId)}
                    className="py-3 px-6 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Add Payment */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-md w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Catatan SPP' : 'Catat Pembayaran SPP'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#1F1F1F] rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Pilih Siswa</label>
                  <select disabled={!!editingId} value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50">
                    <option value="">-- Pilih Siswa --</option>
                    {students.filter(s => s.role === 'student').map(s => (
                      <option key={s.uid} value={s.uid}>{s.fullName} ({s.class})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Bulan</label>
                    <select value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none">
                      {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ) )}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Tahun</label>
                    <input type="text" value={year} onChange={e => setYear(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Nominal</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="paid">Lunas</option>
                    <option value="unpaid">Belum Lunas</option>
                  </select>
                </div>
                <button onClick={savePayment} className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-bold py-4 rounded-2xl transition mt-6 shadow-lg shadow-brand-primary/20">
                  {editingId ? 'Simpan Perubahan' : 'Simpan Catatan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminUsersView({ users }: { users: StudentInfo[] }) {
  const [editingUser, setEditingUser] = useState<StudentInfo | null>(null);
  const [formData, setFormData] = useState<StudentInfo | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<StudentInfo | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmationUser, setDeleteConfirmationUser] = useState<{uid: string, username?: string} | null>(null);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Excel Import
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{current: number, total: number} | null>(null);

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nis.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u as any).username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteUser = async (uid: string, username?: string) => {
    try {
      if (username) {
        await deleteDoc(doc(db, 'credentials', username));
      }
      await deleteDoc(doc(db, 'users', uid));
      setDeleteConfirmationUser(null);
    } catch (error) {
      console.error('Delete user error:', error);
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const saveUser = async () => {
    if (!formData) return;
    try {
      await setDoc(doc(db, 'users', formData.uid), formData, { merge: true });
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${formData.uid}`);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!targetUser || !newUsername) return;
    try {
      // 1. Check if username is already taken by ANOTHER user
      const q = query(collection(db, 'credentials'), where('username', '==', newUsername.toLowerCase()), limit(1));
      const snap = await getDocs(q);
      
      const isUsernameTaken = !snap.empty && snap.docs[0].id !== (targetUser as any).username;
      
      if (isUsernameTaken) {
        alert('Username sudah digunakan oleh orang lain!');
        return;
      }

      const oldUsername = (targetUser as any).username;
      const updates: any = {
        uid: targetUser.uid,
        username: newUsername.toLowerCase(),
        role: targetUser.role
      };

      // 2. Hash password only if provided
      if (newPassword) {
        updates.password = bcrypt.hashSync(newPassword, 10);
      } else {
        // If password not changed but username changed, we need the old password
        if (oldUsername && oldUsername !== newUsername.toLowerCase()) {
          const oldSnap = await getDoc(doc(db, 'credentials', oldUsername));
          if (oldSnap.exists()) {
            updates.password = oldSnap.data().password;
          }
        }
      }

      if (!updates.password && !newPassword) {
        alert('Harap masukkan password jika ini adalah pengaturan login pertama kali.');
        return;
      }

      // 3. Create new/update credentials
      await setDoc(doc(db, 'credentials', newUsername.toLowerCase()), updates);
      
      // 4. If username changed, delete old credential document
      if (oldUsername && oldUsername !== newUsername.toLowerCase()) {
        await deleteDoc(doc(db, 'credentials', oldUsername));
      }
      
      // 5. Update user profile with new username reference
      await setDoc(doc(db, 'users', targetUser.uid), { username: newUsername.toLowerCase() }, { merge: true });
      
      setIsPasswordModalOpen(false);
      setNewPassword('');
      alert('Kredensial berhasil diperbarui!');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'credentials');
    }
  };

  const createNewUser = async () => {
    if (!formData || !newUsername || !newPassword) return;
    try {
      const uid = 'user_' + Date.now();
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      
      // 1. Create Profile
      await setDoc(doc(db, 'users', uid), { ...formData, uid, username: newUsername });
      // 2. Create Credentials
      await setDoc(doc(db, 'credentials', newUsername), {
        uid,
        username: newUsername,
        password: hashedPassword,
        role: formData.role
      });

      setIsCreating(false);
      setFormData(null);
      setNewUsername('');
      setNewPassword('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users/new');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert('File kosong!');
          return;
        }

        setImportProgress({ current: 0, total: data.length });

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const { fullName, username, password, role, nis, className, major, email } = row;
          
          if (!fullName || !username || !password || !role) continue;

          const uid = 'user_import_' + Date.now() + '_' + i;
          const hashedPassword = bcrypt.hashSync(String(password), 10);

          // Create Profile
          await setDoc(doc(db, 'users', uid), {
            uid,
            fullName: String(fullName),
            username: String(username).toLowerCase(),
            role: String(role).toLowerCase(),
            nis: String(nis || ''),
            class: String(className || ''),
            major: String(major || ''),
            email: String(email || '')
          });

          // Create Credentials
          await setDoc(doc(db, 'credentials', String(username).toLowerCase()), {
            uid,
            username: String(username).toLowerCase(),
            password: hashedPassword,
            role: String(role).toLowerCase()
          });

          setImportProgress({ current: i + 1, total: data.length });
        }

        alert('Import berhasil diselesaikan!');
        setIsImportModalOpen(false);
        setImportProgress(null);
      } catch (error: any) {
        console.error(error);
        alert('Gagal mengimport file: ' + error.message);
        setImportProgress(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        fullName: 'Budi Santoso',
        username: 'budi123',
        password: 'password123',
        role: 'student',
        nis: '12345',
        className: 'X RPL 1',
        major: 'Rekayasa Perangkat Lunak',
        email: 'budi@example.com'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "eduportal_user_template.xlsx");
  };

  return (
    <div className="space-y-6">
       <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold font-sans tracking-tight text-white mb-1">Manajemen User</h3>
          <p className="text-gray-500 text-sm">Kelola semua akun siswa, guru, dan pengurus sekolah.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-[#1A1A1A] hover:bg-[#2A2A2A] text-gray-200 px-4 py-3 rounded-2xl transition border border-[#2A2A2A] font-bold text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Import Excel
          </button>
          <button 
            onClick={() => {
              setIsCreating(true);
              setFormData({ uid: '', fullName: '', nis: '', class: '', major: '', email: '', role: 'student' });
            }}
            className="bg-brand-primary hover:bg-brand-primary/80 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-brand-primary/20 font-bold text-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> User Baru
          </button>
        </div>
      </div>

      <div className="bg-[#121212] p-4 rounded-3xl border border-[#1F1F1F] relative">
        <div className="absolute left-8 top-1/2 -translate-y-1/2 text-gray-600">
          <Search className="w-5 h-5" />
        </div>
        <input 
          type="text" 
          placeholder="Cari berdasarkan nama, NIS, atau username..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl py-4 pl-14 pr-6 text-sm text-white focus:border-brand-primary/50 outline-none transition placeholder:text-gray-700"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(u => (
          <div key={u.uid} className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] hover:border-brand-primary/30 transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#1A1A1A] rounded-full overflow-hidden border border-[#2A2A2A] p-0.5">
                    <img src="/logo.png" alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-200 truncate">{u.fullName}</h4>
                    <p className="text-[10px] text-brand-primary font-bold uppercase tracking-widest">{u.role}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDeleteConfirmationUser({ uid: u.uid, username: (u as any).username })}
                  className="p-2 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 text-sm text-gray-400 mb-6">
                <p className="truncate">📧 {u.email || '-'}</p>
                <p>🪪 {u.nis || '-'}</p>
                <p>👤 {(u as any).username || <span className="text-red-500/50 italic">Belum ada username</span>}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  setEditingUser(u);
                  setFormData(u);
                }}
                className="py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-gray-200 rounded-xl text-xs font-bold transition border border-[#2A2A2A]"
              >
                Edit Profil
              </button>
              <button 
                onClick={() => {
                  setTargetUser(u);
                  setNewUsername((u as any).username || '');
                  setNewPassword('');
                  setIsPasswordModalOpen(true);
                }}
                className="py-2 bg-[#1A1A1A] hover:bg-brand-primary/10 text-brand-primary rounded-xl text-xs font-bold transition border border-brand-primary/30"
              >
                Atur Login
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && users.length > 0 && (
        <div className="text-center py-20 bg-[#121212] rounded-[40px] border border-[#1F1F1F]">
           <p className="text-gray-500 italic">Tidak ada user yang ditemukan.</p>
        </div>
      )}

      {/* Excel Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsImportModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-xl w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Import Massal User</h3>
                  <p className="text-gray-500 text-xs">Gunakan file Excel untuk menambahkan banyak user sekaligus.</p>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="p-2 text-gray-500 hover:text-white rounded-xl bg-white/5 transition"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-[#0A0A0A] border border-dashed border-[#2A2A2A] rounded-2xl text-center">
                  <div className="w-12 h-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="text-white font-bold mb-2">Upload File Excel</h4>
                  <p className="text-gray-500 text-xs mb-6">Format yang didukung: .xlsx, .xls</p>
                  
                  {importProgress ? (
                    <div className="space-y-4">
                       <div className="w-full bg-[#1A1A1A] h-2 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                            className="bg-emerald-600 h-full"
                          />
                       </div>
                       <p className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">Memproses {importProgress.current} dari {importProgress.total} data</p>
                    </div>
                  ) : (
                    <label className="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer transition shadow-lg shadow-emerald-900/20">
                      Pilih File
                      <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    </label>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Aturan Format Kolom</p>
                    <button onClick={downloadTemplate} className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:underline uppercase tracking-widest transition">
                       Download Template <Download className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
                     <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                        <p><span className="text-gray-300 font-bold">fullName:</span> Nama lengkap user</p>
                     </div>
                     <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                        <p><span className="text-gray-300 font-bold">username:</span> Nama unik untuk login</p>
                     </div>
                     <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                        <p><span className="text-gray-300 font-bold">password:</span> Password awal user</p>
                     </div>
                     <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                        <p><span className="text-gray-300 font-bold">role:</span> student, teacher, admin, parent</p>
                     </div>
                     <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-1.5 shrink-0" />
                        <p><span className="text-gray-500 font-bold italic">nis:</span> Nomor Induk Siswa (Opsional)</p>
                     </div>
                     <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-1.5 shrink-0" />
                        <p><span className="text-gray-500 font-bold italic">className:</span> Kelas (Opsional)</p>
                     </div>
                     <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-white/20 rounded-full mt-1.5 shrink-0" />
                        <p><span className="text-gray-500 font-bold italic">major:</span> Jurusan (Sesuai List)</p>
                     </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {(editingUser || isCreating) && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setEditingUser(null); setIsCreating(false); }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-lg w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <h3 className="text-xl font-bold text-white mb-6">{isCreating ? 'Tambah User Baru' : `Edit Profil: ${editingUser?.fullName}`}</h3>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Nama Lengkap</label>
                    <input type="text" value={formData?.fullName} onChange={e => setFormData(prev => prev ? {...prev, fullName: e.target.value} : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Role</label>
                    <select value={formData?.role} onChange={e => setFormData(prev => prev ? {...prev, role: e.target.value as any} : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200">
                      <option value="student">Siswa</option>
                      <option value="teacher">Guru</option>
                      <option value="parent">Orang Tua</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                
                {isCreating && (
                  <div className="p-4 bg-brand-primary/10 rounded-2xl border border-brand-primary/20 space-y-4">
                    <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Kredensial Login</p>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Username</label>
                        <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Password</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">NIS</label>
                    <input type="text" value={formData?.nis} onChange={e => setFormData(prev => prev ? {...prev, nis: e.target.value} : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Kelas</label>
                    <select 
                      value={formData?.class} 
                      onChange={e => setFormData(prev => prev ? {...prev, class: e.target.value} : null)} 
                      className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200 outline-none"
                    >
                      <option value="">Pilih Kelas</option>
                      <option value="X">X</option>
                      <option value="XI">XI</option>
                      <option value="XII">XII</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Jurusan</label>
                  <select 
                    value={formData?.major} 
                    onChange={e => setFormData(prev => prev ? {...prev, major: e.target.value} : null)} 
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200 outline-none"
                  >
                    <option value="">Pilih Jurusan</option>
                    <option value="Teknik Instalasi Tenaga Listrik">Teknik Instalasi Tenaga Listrik</option>
                    <option value="Teknik Komputer dan Jaringan">Teknik Komputer dan Jaringan</option>
                    <option value="Rekayasa Perangkat Lunak">Rekayasa Perangkat Lunak</option>
                    <option value="Teknik Pemesinan">Teknik Pemesinan</option>
                    <option value="Teknik Kendaraan Ringan">Teknik Kendaraan Ringan</option>
                    <option value="Teknik Sepeda Motor">Teknik Sepeda Motor</option>
                    <option value="Desain Komunikasi Visual / Multimedia">Desain Komunikasi Visual / Multimedia</option>
                    <option value="SYSTEM">SYSTEM (Admin/Guru Only)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Email (Opsional)</label>
                  <input type="email" value={formData?.email} onChange={e => setFormData(prev => prev ? {...prev, email: e.target.value} : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200" />
                </div>
                {formData?.role === 'parent' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Child ID (Student UID)</label>
                    <input type="text" value={formData?.studentId} onChange={e => setFormData(prev => prev ? {...prev, studentId: e.target.value} : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-gray-200" />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => { setEditingUser(null); setIsCreating(false); }} className="flex-1 py-3 bg-[#1A1A1A] text-gray-400 rounded-2xl font-bold text-sm">Batal</button>
                <button onClick={isCreating ? createNewUser : saveUser} className="flex-1 py-3 bg-brand-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-brand-primary/20">
                  {isCreating ? 'Buat Akun' : 'Simpan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPasswordModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-md w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <h3 className="text-xl font-bold text-white mb-6">Atur Username & Password</h3>
              <p className="text-xs text-gray-500 mb-6">Menetapkan kredensial login untuk <strong>{targetUser?.fullName}</strong>.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Username</label>
                  <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="username_siswa" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 text-sm text-gray-200" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Password Baru</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 text-sm text-gray-200" />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsPasswordModalOpen(false)} className="flex-1 py-3 bg-[#1A1A1A] text-gray-400 rounded-2xl font-bold text-sm">Batal</button>
                <button onClick={handleUpdateCredentials} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm">Update Kredensial</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* Modal Delete User Confirmation */}
      <AnimatePresence>
        {deleteConfirmationUser && (
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirmationUser(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative max-w-sm w-full bg-[#121212] rounded-[32px] p-8 shadow-2xl border border-[#1F1F1F]">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Hapus User?</h3>
                <p className="text-gray-400 text-sm mb-8 leading-relaxed">Tindakan ini tidak dapat dibatalkan. Profil dan kredensial login (<b>{deleteConfirmationUser.username || 'Tanpa username'}</b>) akan dihapus secara permanen.</p>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button 
                    onClick={() => setDeleteConfirmationUser(null)}
                    className="py-3 px-6 rounded-2xl bg-[#1A1A1A] text-gray-300 font-bold text-sm hover:bg-[#2A2A2A] transition"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => deleteUser(deleteConfirmationUser.uid, deleteConfirmationUser.username)}
                    className="py-3 px-6 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-900/20"
                  >
                    Ya, Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoginView({ onLogin, isAuthReady }: { onLogin: (user: LoggedInUser) => void, isAuthReady: boolean }) {
  const [activeRole, setActiveRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auto create admin if none exists (demo only)
  useEffect(() => {
    if (!isAuthReady) return;
    
    const checkAdmin = async () => {
      try {
        const adminDoc = doc(db, 'credentials', 'admin');
        const snap = await getDoc(adminDoc);
        
        if (!snap.exists()) {
          const hashedPassword = bcrypt.hashSync('admin123', 10);
          const uid = 'admin_root_' + Date.now();
          
          // 1. Create Profile first
          await setDoc(doc(db, 'users', uid), {
            uid,
            fullName: 'Administrator Root',
            role: 'admin',
            username: 'admin',
            nis: 'ROOT',
            class: 'SYSTEM',
            major: 'SYSTEM',
            email: 'admin@eduportal.local'
          });

          // 2. Create Credentials
          await setDoc(doc(db, 'credentials', 'admin'), {
            uid,
            username: 'admin',
            password: hashedPassword,
            role: 'admin'
          });
          console.log('Created root admin: admin / admin123');
        }
      } catch (e) {
        console.warn('Initial admin check failed:', e);
      }
    };
    checkAdmin();
  }, [isAuthReady]);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credDoc = doc(db, 'credentials', username.toLowerCase());
      const snap = await getDoc(credDoc);

      if (!snap.exists()) {
        setError(`Username "${username}" tidak ditemukan.`);
        setLoading(false);
        return;
      }

      const data = snap.data();
      
      // Verify role matches selection
      if (data.role !== activeRole) {
        setError(`Akun ini (${username}) terdaftar sebagai ${data.role}, bukan ${activeRole}.`);
        setLoading(false);
        return;
      }

      const isValid = bcrypt.compareSync(password, data.password);

      if (!isValid) {
        setError('Password yang Anda masukkan salah.');
        setLoading(false);
        return;
      }

      // Link current anonymous UID to this profile in a structured 'sessions' collection
      // This allows Firestore Rules to verify the user role securely
      const currentAuthUid = auth.currentUser?.uid;
      if (currentAuthUid) {
        await setDoc(doc(db, 'active_sessions', currentAuthUid), {
          uid: data.uid,
          role: data.role,
          username: data.username,
          lastActive: new Date().toISOString()
        });
      }

      onLogin({ uid: data.uid, role: data.role });
    } catch (err: any) {
      if (err.message?.includes('auth/admin-restricted-operation')) {
        setError('Fitur Login belum aktif. Admin harus mengaktifkan "Anonymous Auth" di Firebase Console.');
      } else {
        setError(`Gagal masuk: ${err.message || 'Periksa koneksi internet anda'}.`);
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const roleConfigs = {
    student: { icon: UserIcon, label: 'Siswa', color: 'brand-primary' },
    teacher: { icon: BookOpen, label: 'Guru', color: 'brand-secondary' },
    admin: { icon: LayoutDashboard, label: 'Admin', color: 'brand-accent' }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { signInWithGoogle } = await import('./lib/firebase');
      const result = await signInWithGoogle();
      if (result.user.email === 'muhfadelramadan06@gmail.com') {
        // Create or sync admin profile
        const uid = result.user.uid;
        await setDoc(doc(db, 'users', uid), {
          uid,
          fullName: result.user.displayName || 'Admin Project',
          role: 'admin',
          username: 'admin_google',
          email: result.user.email,
          nis: 'GOOGLE_ADMIN',
          class: 'SYSTEM',
          major: 'SYSTEM'
        }, { merge: true });

        // Also create a session for Firestore rules consistency
        await setDoc(doc(db, 'active_sessions', uid), {
          uid,
          role: 'admin',
          username: 'admin_google',
          lastActive: new Date().toISOString()
        });

        onLogin({ uid, role: 'admin' });
      } else {
        setError('Hanya akun pengembang yang diizinkan menggunakan login Google untuk pengaturan awal.');
      }
    } catch (err: any) {
      setError(`Google Login gagal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-white/10 p-3 shadow-xl"
          >
            <img src="/logo.png" alt="Logo SMK Kartika" className="w-full h-full object-contain" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white font-sans tracking-tight mb-2">SMK Kartika XX-1 Makassar</h1>
          <p className="text-gray-500 text-sm">Pilih peran Anda untuk melanjutkan ke dashboard.</p>
        </div>

        {/* Role Selector */}
        <div className="flex p-1 bg-[#121212] rounded-2xl border border-[#1F1F1F] mb-6 gap-1">
          {(['student', 'teacher', 'admin'] as const).map((r) => {
            const isActive = activeRole === r;
            const Icon = roleConfigs[r].icon;
            return (
              <button
                key={r}
                onClick={() => { setActiveRole(r); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all duration-300 ${
                  isActive 
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {roleConfigs[r].label}
              </button>
            );
          })}
        </div>

        <motion.div 
          key={activeRole}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[#121212] p-8 rounded-[40px] border border-[#1F1F1F] shadow-2xl relative overflow-hidden"
        >
          {/* Subtle Accent Background */}
          <div className={`absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 blur-[100px] pointer-events-none rounded-full`} />
          
          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Username {roleConfigs[activeRole].label}</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={`Masukkan username ${roleConfigs[activeRole].label.toLowerCase()}`}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-brand-primary outline-none placeholder:text-gray-700 transition"
                  required
                />
                <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:ring-2 focus:ring-brand-primary outline-none placeholder:text-gray-700 transition"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700 hover:text-brand-primary transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-brand-accent/20 border border-brand-accent/20 rounded-2xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-brand-accent shrink-0" />
                <p className="text-xs font-bold text-brand-accent">{error}</p>
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-3 group"
            >
              {loading ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Masuk sebagai {roleConfigs[activeRole].label}
                  <Lock className="w-4 h-4 group-hover:translate-x-1 transition" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-[#1F1F1F] text-center">
            <p className="text-xs text-gray-600">Lupa password? Hubungi Administrator Sekolah.</p>
          </div>
        </motion.div>

        {activeRole === 'admin' && (
          <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10 text-center space-y-3">
             <div>
               <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-widest">Demo Admin Login</p>
               <p className="text-xs text-brand-primary font-mono">admin / admin123</p>
             </div>
             <div className="pt-3 border-t border-white/5">
                <p className="text-[10px] text-gray-600 mb-2 italic">Gagal Login? Gunakan setup pengembang:</p>
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-2 border border-white/10"
                >
                  Masuk dengan Google (Dev Only)
                </button>
             </div>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-700 uppercase font-bold tracking-[0.2em] mt-10">
          SMK Kartika XX-1 Makassar v2.0 • Sistem Informasi Akademik
        </p>
      </div>
    </div>
  );
}

function ProfileView({ studentInfo, uid, setStudentInfo }: { studentInfo: StudentInfo | null, uid: string, setStudentInfo: (info: StudentInfo) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<StudentInfo | null>(studentInfo);

  useEffect(() => {
    setFormData(studentInfo);
  }, [studentInfo]);

  const saveProfile = async () => {
    if (!formData) return;
    try {
      await setDoc(doc(db, 'users', uid), formData);
      setStudentInfo(formData);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-[#121212] p-8 rounded-[40px] border border-[#1F1F1F] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        
        <div className="flex flex-col items-center mb-8 relative">
          <div className="w-24 h-24 bg-white rounded-full p-1 border-4 border-[#121212] shadow-xl overflow-hidden mb-4">
            <img src="/logo.png" alt="Avatar" className="w-full h-full object-contain" />
          </div>
          <h3 className="text-xl font-bold text-white font-sans tracking-tight">{studentInfo?.fullName}</h3>
          <p className="text-brand-primary text-sm font-bold uppercase tracking-widest">{studentInfo?.role}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Nama Lengkap</label>
              {isEditing ? (
                <input type="text" value={formData?.fullName} onChange={e => setFormData(prev => prev ? { ...prev, fullName: e.target.value } : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
              ) : (
                <p className="text-sm font-semibold text-gray-200">{studentInfo?.fullName}</p>
              )}
            </div>
            {(studentInfo?.role === 'student' || studentInfo?.role === 'parent') && (
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">NIS (Induk Siswa)</label>
                <p className="text-sm font-semibold text-gray-200">{studentInfo?.nis || '-'}</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Peran (Role)</label>
              <p className="text-sm font-bold text-brand-primary uppercase tracking-widest">{studentInfo?.role}</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Email</label>
              <p className="text-sm font-semibold text-gray-400 italic">{studentInfo?.email}</p>
            </div>
            {studentInfo?.role === 'student' && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Kelas</label>
                  <p className="text-sm font-semibold text-gray-200">{studentInfo?.class || '-'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Jurusan</label>
                  <p className="text-sm font-semibold text-gray-200">{studentInfo?.major || '-'}</p>
                </div>
              </>
            )}
            {studentInfo?.role === 'parent' && (
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">ID Siswa (Child ID)</label>
                {isEditing ? (
                  <input type="text" value={formData?.studentId} onChange={e => setFormData(prev => prev ? { ...prev, studentId: e.target.value } : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                ) : (
                  <p className="text-sm font-semibold text-gray-200">{studentInfo?.studentId || '-'}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-[#1F1F1F] flex justify-center">
          {isEditing ? (
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-[#1A1A1A] transition"
              >
                Batal
              </button>
              <button 
                onClick={saveProfile}
                className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/80 transition"
              >
                Simpan Perubahan
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full sm:w-auto px-10 py-3 rounded-2xl text-sm font-bold border border-gray-800 text-gray-300 hover:bg-[#1A1A1A] transition"
            >
              Ubah Data Profil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
