import React, { useEffect, useState } from 'react';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  BookOpen, 
  CreditCard, 
  User as UserIcon, 
  CheckCircle2
} from 'lucide-react';

// Types
import { 
  LoggedInUser, 
  StudentInfo, 
  Grade, 
  Assignment, 
  Payment, 
  Announcement, 
  DashboardConfig, 
  Tab 
} from './types';

// Components
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { AssignmentsView } from './components/AssignmentsView';
import { GradesView } from './components/GradesView';
import { PaymentsView } from './components/PaymentsView';
import { AdminUsersView } from './components/AdminUsersView';
import { ProfileView } from './components/ProfileView';
import { Sidebar, Header } from './components/Layout';

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
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.error("Session parse error:", e);
      }
    }
    setLoading(false);
    
    return () => unsub();
  }, []);

  // Sync session with active auth for Firestore Rules
  useEffect(() => {
    if (session && auth.currentUser) {
      setDoc(doc(db, 'active_sessions', auth.currentUser.uid), {
        uid: session.uid,
        role: session.role,
        lastActive: new Date().toISOString()
      }, { merge: true }).catch(e => {
        console.error("Session sync failed:", e);
      });
    }
  }, [session, auth.currentUser]);

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
          setStudentInfo({ uid: snap.id, ...snap.data() } as StudentInfo);
        } else {
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
        filtered = filtered.filter(a => 
          (a.targetMajor === studentInfo.major || a.targetMajor === 'Semua Jurusan')
        );
      }
      setAssignments(filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'assignments'));

    // Payments
    let payQuery;
    if (studentInfo?.role === 'admin') {
      payQuery = query(collection(db, 'payments'));
    } else {
      payQuery = query(collection(db, 'payments'), where('studentId', '==', session.uid));
    }
    const unsubPay = onSnapshot(payQuery, async (snap) => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Payment))
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
      setPayments(sorted);
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

    // Get Teachers and Users
    let unsubUsers = () => {};
    if (studentInfo?.role === 'admin') {
      const allUsersQuery = query(collection(db, 'users'));
      unsubUsers = onSnapshot(allUsersQuery, (snap) => {
        setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as StudentInfo)));
      });
    } else {
      const teachersQuery = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin']));
      const unsubTeachers = onSnapshot(teachersQuery, (snap) => {
        const teachers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as StudentInfo));
        if (studentInfo?.role === 'teacher') {
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
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabs={tabs}
        handleLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Header 
          setIsSidebarOpen={setIsSidebarOpen}
          activeTab={activeTab}
          studentInfo={studentInfo}
        />

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
