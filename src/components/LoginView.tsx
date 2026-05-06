import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import bcrypt from 'bcryptjs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  User as UserIcon, 
  BookOpen, 
  LayoutDashboard, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Lock 
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { LoggedInUser, StudentInfo } from '../types';

interface LoginViewProps {
  onLogin: (user: LoggedInUser) => void;
  isAuthReady: boolean;
}

export function LoginView({ onLogin, isAuthReady }: LoginViewProps) {
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

  const handleLogin = async (e: React.FormEvent) => {
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
      const { signInWithGoogle } = await import('../lib/firebase');
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
