import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  Search, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  UserPlus,
  X,
  Edit2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { StudentInfo } from '../types';
import { MAJORS } from '../constants';

interface AdminUsersViewProps {
  users: StudentInfo[];
}

export function AdminUsersView({ users }: AdminUsersViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StudentInfo | null>(null);
  const [formData, setFormData] = useState<Partial<StudentInfo & { username: string, password?: string }>>({
    role: 'student',
    class: 'X',
    major: MAJORS[0]
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [importProgress, setImportProgress] = useState<{ current: number, total: number } | null>(null);
  const [deletingUser, setDeletingUser] = useState<StudentInfo | null>(null);

  const resetForm = () => {
    setFormData({ role: 'student', class: 'X', major: MAJORS[0] });
    setEditingUser(null);
  };

  const handleEditUser = (user: StudentInfo) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      username: (user as any).username || '',
      role: user.role,
      nis: user.nis,
      class: user.class,
      major: user.major,
      email: user.email
    });
    setIsModalOpen(true);
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
          alert('File Excel kosong atau format tidak sesuai.');
          return;
        }

        setImportProgress({ current: 0, total: data.length });

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const { fullName, username, password, role, nis, class: className, major, email } = row;

          if (!fullName || !username || !password || !role) {
            console.warn(`Baris ${i + 1} dilewati karena data wajib kosong.`);
            continue;
          }

          const uid = `user_${Date.now()}_${i}`;
          const hashedPassword = bcrypt.hashSync(String(password), 10);

          await setDoc(doc(db, 'users', uid), {
            uid,
            fullName: String(fullName),
            role: String(role).toLowerCase() as any,
            nis: String(nis || ''),
            class: String(className || ''),
            major: String(major || ''),
            email: String(email || ''),
            username: String(username).toLowerCase(),
            createdAt: new Date().toISOString()
          });

          await setDoc(doc(db, 'credentials', String(username).toLowerCase()), {
            uid,
            username: String(username).toLowerCase(),
            password: hashedPassword,
            role: String(role).toLowerCase()
          });

          setImportProgress({ current: i + 1, total: data.length });
        }

        alert(`Berhasil mengimport ${data.length} user.`);
        setImportProgress(null);
      } catch (err: any) {
        console.error(err);
        alert('Gagal mengimport file Excel: ' + err.message);
        setImportProgress(null);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const templateData = [
      { fullName: 'Budi Santoso', username: 'budi123', password: 'password123', role: 'student', nis: '10001', class: 'X', major: MAJORS[2], email: 'budi@student.local' },
      { fullName: 'Ibu Guru Ani', username: 'ani_guru', password: 'password123', role: 'teacher', nis: '-', class: '-', major: '-', email: 'ani@teacher.local' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "eduportal_user_template.xlsx");
  };

  const saveUser = async () => {
    const { fullName, username, role, nis, email, password } = formData;
    if (!fullName || !username || !role) {
      alert('Nama, Username, dan Role wajib diisi.');
      return;
    }

    try {
      if (editingUser) {
        // UPDATE Existing
        const uid = editingUser.uid;
        const oldUsername = (editingUser as any).username;
        const newUsername = username.toLowerCase();

        // 1. Update user profile
        await setDoc(doc(db, 'users', uid), {
          fullName,
          role,
          nis: nis || '',
          class: formData.class || '',
          major: formData.major || '',
          email: email || '',
          username: newUsername
        }, { merge: true });

        // 2. Handle username change in credentials if needed
        if (oldUsername !== newUsername && oldUsername) {
          await deleteDoc(doc(db, 'credentials', oldUsername));
        }

        const credPayload: any = {
          uid,
          username: newUsername,
          role
        };
        if (password) {
          credPayload.password = bcrypt.hashSync(password, 10);
        }
        await setDoc(doc(db, 'credentials', newUsername), credPayload, { merge: true });

        alert('User berhasil diupdate!');
      } else {
        // CREATE New
        const uid = `user_${Date.now()}`;
        const defaultPassword = password || nis || 'kartika123';
        const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

        await setDoc(doc(db, 'users', uid), {
          uid,
          fullName,
          role,
          nis: nis || '',
          class: formData.class || '',
          major: formData.major || '',
          email: email || '',
          username: username.toLowerCase(),
          createdAt: new Date().toISOString()
        });

        await setDoc(doc(db, 'credentials', username.toLowerCase()), {
          uid,
          username: username.toLowerCase(),
          password: hashedPassword,
          role
        });

        alert(`User berhasil dibuat! Password: ${defaultPassword}`);
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const deleteUser = async () => {
    if (!deletingUser) return;
    try {
      const username = (deletingUser as any).username;
      if (username) {
        await deleteDoc(doc(db, 'credentials', username.toLowerCase()));
      }
      await deleteDoc(doc(db, 'users', deletingUser.uid));
      setDeletingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${deletingUser.uid}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.nis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#121212] p-8 rounded-[40px] border border-[#1F1F1F] flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl">
        <div>
          <h3 className="text-2xl font-black text-white tracking-tight">Manajemen Pengguna</h3>
          <p className="text-gray-500 text-sm mt-1 font-medium">Kelola data login dan profil seluruh civitas akademik.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={downloadTemplate}
            className="bg-white/5 hover:bg-white/10 text-gray-300 font-bold px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 text-sm transition transition-all active:scale-95"
          >
            <Download className="w-4 h-4" /> Download Template
          </button>
          <label className="bg-emerald-900/10 hover:bg-emerald-900/20 text-emerald-500 font-bold px-5 py-3 rounded-2xl flex items-center gap-2 border border-emerald-500/10 text-sm cursor-pointer transition transition-all active:scale-95">
             <Upload className="w-4 h-4" /> Import Excel
             <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-brand-primary hover:bg-brand-primary/80 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-brand-primary/20 text-sm transition transition-all active:scale-95"
          >
            <UserPlus className="w-5 h-5" /> Tambah User
          </button>
        </div>
      </div>

      <div className="relative">
         <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700" />
         <input 
           type="text" 
           placeholder="Cari berdasarkan nama, NIS, atau role..."
           value={searchTerm}
           onChange={e => setSearchTerm(e.target.value)}
           className="w-full bg-[#121212] border border-[#1F1F1F] rounded-[32px] py-5 pl-14 pr-8 text-sm text-gray-300 outline-none focus:border-brand-primary transition-all font-medium"
         />
      </div>

      {importProgress && (
        <div className="bg-[#121212] p-8 rounded-[40px] border border-brand-primary/20 text-center animate-pulse">
           <p className="text-sm font-bold text-white mb-4">Sedang mengimport data: {importProgress.current} / {importProgress.total}</p>
           <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div className="bg-brand-primary h-full transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} />
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.length > 0 ? filteredUsers.map(u => (
          <motion.div 
            key={u.uid}
            layout
            className="bg-[#121212] p-6 rounded-[32px] border border-[#1F1F1F] hover:border-brand-primary/30 transition-all group"
          >
            <div className="flex items-start justify-between mb-6">
               <div className="w-14 h-14 bg-white rounded-2xl p-1 shadow-lg shadow-black/20 overflow-hidden group-hover:scale-105 transition-transform">
                  <img src="/logo.png" alt="" className="w-full h-full object-contain" />
               </div>
               <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                 u.role === 'admin' ? 'bg-red-900/20 text-red-400 border border-red-500/10' :
                 u.role === 'teacher' ? 'bg-blue-900/20 text-blue-400 border border-blue-500/10' :
                 'bg-brand-primary/10 text-brand-primary border border-brand-primary/10'
               }`}>
                 {u.role}
               </div>
            </div>
            
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white group-hover:text-brand-primary transition-colors truncate">{u.fullName}</h4>
              <p className="text-xs text-gray-600 font-mono tracking-tighter">UID: {u.uid}</p>
            </div>

            <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest mb-1">NIS/NIP</p>
                  <p className="text-xs font-semibold text-gray-400">{u.nis || 'N/A'}</p>
               </div>
               <div>
                  <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest mb-1">Kelas</p>
                  <p className="text-xs font-semibold text-gray-400">{u.class && u.class !== '-' ? u.class : 'N/A'}</p>
               </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
               <button 
                onClick={() => handleEditUser(u)}
                className="flex-1 py-3 text-[10px] font-bold text-gray-600 hover:text-white transition uppercase tracking-widest bg-white/5 hover:bg-white/10 rounded-xl"
               >
                 Edit Profil
               </button>
               <button 
                 onClick={() => setDeletingUser(u)}
                 className="p-3 bg-red-900/10 hover:bg-red-900/20 text-red-500 transition rounded-xl"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-20 text-center opacity-30">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-lg font-black uppercase tracking-[0.2em]">User tidak ditemukan</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] w-full max-w-lg rounded-[48px] border border-[#1F1F1F] p-10 space-y-8"
            >
              <div className="flex justify-between items-center px-2">
                <h3 className="text-2xl font-black text-white">{editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h3>
                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-gray-500 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-4">
                 <div>
                   <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-2 px-1">Nama Lengkap</label>
                   <input type="text" value={formData.fullName || ''} onChange={e => setFormData({ ...formData, fullName: e.target.value })} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none" placeholder="Masukkan nama" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Username Login</label>
                      <input type="text" value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none" placeholder="user123" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Peran (Role)</label>
                      <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none">
                        <option value="student">Siswa</option>
                        <option value="teacher">Guru</option>
                        <option value="admin">Administrator</option>
                        <option value="parent">Orang Tua</option>
                      </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">NIS / NIP</label>
                      <input type="text" value={formData.nis || ''} onChange={e => setFormData({ ...formData, nis: e.target.value })} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none" placeholder="10001" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">{editingUser ? 'Password Baru (Opsional)' : 'Password'}</label>
                      <input type="password" onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none" placeholder="••••••••" />
                    </div>
                 </div>
                 {formData.role === 'student' && (
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Kelas</label>
                          <select value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none">
                             <option value="X">X</option>
                             <option value="XI">XI</option>
                             <option value="XII">XII</option>
                          </select>
                       </div>
                       <div>
                          <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Jurusan</label>
                          <select value={formData.major} onChange={e => setFormData({ ...formData, major: e.target.value })} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none">
                             {MAJORS.map(m => (
                               <option key={m} value={m}>{m}</option>
                             ))}
                          </select>
                       </div>
                    </div>
                 )}
              </div>

              <div className="pt-4 flex gap-4">
                 <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="flex-1 py-4 bg-white/5 rounded-[24px] text-xs font-bold text-gray-500 hover:bg-white/10 transition">Batal</button>
                 <button onClick={saveUser} className="flex-[2] py-4 bg-brand-primary rounded-[24px] text-xs font-bold text-white shadow-xl shadow-brand-primary/20">
                   {editingUser ? 'Simpan Perubahan' : 'Buat Akun'}
                 </button>
              </div>
              {!editingUser && (
                <p className="text-[10px] text-gray-700 text-center uppercase tracking-widest italic font-bold">* Password default akan sama dengan NIS jika kosong.</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {deletingUser && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[120]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] w-full max-w-sm rounded-[32px] border border-red-900/30 p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Hapus Pengguna?</h3>
                <p className="text-sm text-gray-500">Akun <b>{deletingUser.fullName}</b> dan data login akan dihapus permanen.</p>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setDeletingUser(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-gray-500 transition">Batal</button>
                <button onClick={deleteUser} className="flex-1 py-4 bg-red-600 hover:bg-red-700 rounded-2xl text-xs font-bold text-white transition shadow-xl shadow-red-600/20">Hapus Sekarang</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
