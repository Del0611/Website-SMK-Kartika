import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Megaphone, 
  Settings, 
  Mail, 
  Phone, 
  Save,
  Plus,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Announcement, DashboardConfig } from '../types';

interface DashboardViewProps {
  announcements: Announcement[];
  role?: string;
  config: DashboardConfig;
}

export function DashboardView({ announcements, role, config }: DashboardViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [welcomeTitle, setWelcomeTitle] = useState(config.welcomeTitle);
  const [welcomeDescription, setWelcomeDescription] = useState(config.welcomeDescription);
  const [schoolEmail, setSchoolEmail] = useState(config.schoolEmail);
  const [schoolPhone, setSchoolPhone] = useState(config.schoolPhone);

  // Announcement Management States
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [viewingAnn, setViewingAnn] = useState<Announcement | null>(null);
  const [deletingAnnId, setDeletingAnnId] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annCategory, setAnnCategory] = useState('Umum');

  // Sync state with props because config arrives asynchronously
  useEffect(() => {
    setWelcomeTitle(config.welcomeTitle);
    setWelcomeDescription(config.welcomeDescription);
    setSchoolEmail(config.schoolEmail);
    setSchoolPhone(config.schoolPhone);
  }, [config]);

  // Automatic Pop-up for latest announcement
  useEffect(() => {
    if (announcements.length > 0 && !viewingAnn) {
      // Show the most recent announcement (assuming the first one is latest or based on date)
      const latest = [...announcements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      // Check if already seen in this session to avoid spamming
      const seenId = sessionStorage.getItem('last_seen_ann_id');
      if (seenId !== latest.id) {
        setViewingAnn(latest);
        sessionStorage.setItem('last_seen_ann_id', latest.id);
      }
    }
  }, [announcements]);

  const saveConfig = async () => {
    try {
      await setDoc(doc(db, 'settings', 'dashboard'), {
        welcomeTitle,
        welcomeDescription,
        schoolEmail,
        schoolPhone
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/dashboard');
    }
  };

  const handleReset = () => {
    setWelcomeTitle(config.welcomeTitle);
    setWelcomeDescription(config.welcomeDescription);
    setSchoolEmail(config.schoolEmail);
    setSchoolPhone(config.schoolPhone);
    setIsEditing(false);
  };

  const handleSaveAnnouncement = async () => {
    if (!annTitle || !annContent) return;
    try {
      const id = editingAnn?.id || `ann_${Date.now()}`;
      await setDoc(doc(db, 'announcements', id), {
        title: annTitle,
        content: annContent,
        category: annCategory,
        date: editingAnn?.date || new Date().toISOString()
      }, { merge: true });
      
      setIsAnnModalOpen(false);
      setEditingAnn(null);
      setAnnTitle('');
      setAnnContent('');
      setAnnCategory('Umum');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'announcements');
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!deletingAnnId) return;
    try {
      await deleteDoc(doc(db, 'announcements', deletingAnnId));
      setDeletingAnnId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `announcements/${deletingAnnId}`);
    }
  };

  const openEditAnn = (ann: Announcement) => {
    setEditingAnn(ann);
    setAnnTitle(ann.title);
    setAnnContent(ann.content);
    setAnnCategory(ann.category);
    setIsAnnModalOpen(true);
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#121212] rounded-[40px] border border-[#1F1F1F] p-8 lg:p-14 shadow-2xl">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-primary/10 to-transparent -mr-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-primary/5 blur-[120px] -ml-32 -mb-32 pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none grayscale invert" style={{ backgroundImage: 'url("/logo.png")', backgroundSize: '400px', backgroundPosition: 'right bottom', backgroundRepeat: 'no-repeat' }} />
        
        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary">Sistem Akademik v2.0</span>
          </motion.div>
          
          {isEditing ? (
            <div className="space-y-4">
              <input value={welcomeTitle} onChange={e => setWelcomeTitle(e.target.value)} className="w-full bg-[#1A1A1A] border-b-2 border-brand-primary p-2 text-4xl font-black text-white outline-none" />
              <textarea value={welcomeDescription} onChange={e => setWelcomeDescription(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 text-gray-400 text-lg outline-none" rows={3} />
              <div className="flex gap-4 pt-4">
                 <button onClick={saveConfig} className="bg-brand-primary text-white font-bold py-3 px-8 rounded-2xl flex items-center gap-2 shadow-xl shadow-brand-primary/20"><Save className="w-5 h-5"/> Simpan Perubahan</button>
                 <button onClick={handleReset} className="bg-white/5 text-gray-500 font-bold py-3 px-8 rounded-2xl hover:bg-white/10 transition">Batal</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-4xl lg:text-6xl font-black text-white font-sans tracking-tight leading-[1.1] mb-6">
                {config.welcomeTitle}
              </h1>
              <p className="text-lg lg:text-xl text-gray-400 font-medium leading-relaxed mb-10 max-w-xl">
                {config.welcomeDescription}
              </p>
            </>
          )}

          <div className="flex flex-wrap gap-6 pt-6 border-t border-white/5">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-primary"><Mail className="w-5 h-5" /></div>
                <div>
                   <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">Sekretariat</p>
                   {isEditing ? (
                      <input type="email" value={schoolEmail} onChange={e => setSchoolEmail(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none focus:border-brand-primary/50" />
                   ) : (
                      <p className="text-sm font-semibold text-gray-300">{config.schoolEmail}</p>
                   )}
                </div>
             </div>
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-primary"><Phone className="w-5 h-5" /></div>
                <div>
                   <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">Hubungi Kami</p>
                   {isEditing ? (
                      <input type="text" value={schoolPhone} onChange={e => setSchoolPhone(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white outline-none focus:border-brand-primary/50" />
                   ) : (
                      <p className="text-sm font-semibold text-gray-300">{config.schoolPhone}</p>
                   )}
                </div>
             </div>
          </div>
        </div>

        {role === 'admin' && !isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition group border border-white/5"
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
          </button>
        )}
      </section>

      {/* Grid Features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Info & Pengumuman */}
        <section className="bg-[#121212] rounded-[40px] border border-[#1F1F1F] p-8 lg:p-10 shadow-xl overflow-hidden relative group">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary shadow-inner">
                  <Megaphone className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Pengumuman Sekolah</h3>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{announcements.length} Update Terbaru</span>
                {role === 'admin' && (
                  <button 
                    onClick={() => {
                      setEditingAnn(null);
                      setAnnTitle('');
                      setAnnContent('');
                      setAnnCategory('Umum');
                      setIsAnnModalOpen(true);
                    }}
                    className="p-2 bg-brand-primary rounded-xl text-white hover:bg-brand-primary/80 transition shadow-lg shadow-brand-primary/20"
                    title="Tambah Pengumuman"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
           </div>

           <div className="space-y-6">
             {announcements.length > 0 ? [...announcements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((ann, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={ann.id} 
                  onClick={() => setViewingAnn(ann)}
                  className="group/item relative pl-6 border-l border-brand-primary/20 hover:border-brand-primary transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em]">{ann.category}</p>
                    {role === 'admin' && (
                      <div className="flex gap-2 relative z-20">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditAnn(ann);
                          }} 
                          className="text-gray-600 hover:text-brand-primary transition p-2 bg-white/5 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingAnnId(ann.id);
                          }} 
                          className="text-gray-600 hover:text-red-500 transition p-2 bg-white/5 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-gray-200 group-hover/item:text-brand-primary transition-colors mb-2">{ann.title}</h4>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3 line-clamp-2">{ann.content}</p>
                  <p className="text-[10px] text-gray-600 font-bold italic">{new Date(ann.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </motion.div>
             )) : (
                <div className="py-10 text-center opacity-30">
                   <Megaphone className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                   <p className="text-sm font-bold uppercase tracking-widest">Belum ada pengumuman hari ini.</p>
                </div>
             )}
           </div>

           <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-primary/5 blur-3xl rounded-full" />
        </section>

        {/* School Logo Large Area */}
        <div className="hidden lg:flex items-center justify-center p-12 bg-white/2 rounded-[40px] border border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/5 to-transparent pointer-events-none" />
            <img src="/logo.png" alt="Watermark" className="w-64 h-64 grayscale opacity-20 group-hover:opacity-40 group-hover:scale-110 group-hover:grayscale-0 transition-all duration-1000" />
            <div className="absolute bottom-10 left-10 text-left">
               <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.4em] mb-2 px-1">Institusi Berprestasi</p>
               <h4 className="text-2xl font-bold text-white/40 group-hover:text-white/80 transition-colors">Kartika Jaya</h4>
            </div>
        </div>
      </div>

      {/* Announcement Modal */}
      <AnimatePresence>
        {isAnnModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] w-full max-w-lg rounded-[48px] border border-[#1F1F1F] p-8 lg:p-10 space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-white">{editingAnn ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}</h3>
                <button onClick={() => setIsAnnModalOpen(false)} className="text-gray-500 hover:text-white transition"><X className="w-6 h-6" /></button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Kategori</label>
                  <select 
                    value={annCategory} 
                    onChange={e => setAnnCategory(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none focus:border-brand-primary transition"
                  >
                    <option value="Umum">Umum</option>
                    <option value="Akademik">Akademik</option>
                    <option value="Ekskul">Ekskul</option>
                    <option value="Penting">Penting</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Judul Pengumuman</label>
                  <input 
                    type="text" 
                    value={annTitle} 
                    onChange={e => setAnnTitle(e.target.value)} 
                    placeholder="Contoh: Libur Semester Ganjil" 
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Konten / Isi</label>
                  <textarea 
                    value={annContent} 
                    onChange={e => setAnnContent(e.target.value)} 
                    placeholder="Tulis detail pengumuman di sini..." 
                    rows={4}
                    className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none transition resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsAnnModalOpen(false)} className="flex-1 py-4 text-gray-500 font-bold text-sm hover:bg-white/5 rounded-2xl transition">Batal</button>
                  <button 
                    onClick={handleSaveAnnouncement}
                    className="flex-1 py-4 bg-brand-primary hover:bg-brand-primary/80 text-white font-bold text-sm rounded-2xl transition shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Simpan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Detail Announcement Modal */}
      <AnimatePresence>
        {viewingAnn && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[150]">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0A0A0A] w-full max-w-2xl max-h-[85vh] rounded-[48px] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-primary/50 via-brand-primary to-brand-primary/50" />
              
              {/* Sticky Header */}
              <div className="p-8 pb-4 flex justify-between items-start shrink-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-brand-primary/10 text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] border border-brand-primary/20">
                      {viewingAnn.category}
                    </span>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                      INFO SEKOLAH
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-white leading-tight pr-8">{viewingAnn.title}</h3>
                </div>
                <button 
                  onClick={() => setViewingAnn(null)} 
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-500 hover:text-white transition shadow-lg shrink-0"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="px-8 pb-8 flex-1 overflow-y-auto scrollbar-hide lg:scrollbar-default">
                <div className="bg-white/2 rounded-[32px] p-8 border border-white/5 min-h-full">
                  <div className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap font-medium">
                    {viewingAnn.content}
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-8 pt-4 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent shrink-0">
                <div className="flex items-center justify-between p-6 bg-white/2 rounded-[32px] border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                      <Megaphone className="w-6 h-6 text-brand-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Diterbitkan</p>
                      <p className="text-sm font-bold text-gray-400">
                        {new Date(viewingAnn.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setViewingAnn(null)} 
                    className="px-8 py-4 bg-brand-primary text-white font-black text-xs rounded-2xl hover:brightness-110 active:scale-95 transition shadow-xl shadow-brand-primary/20 uppercase tracking-widest"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {deletingAnnId && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[120]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] w-full max-w-sm rounded-[32px] border border-red-900/30 p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mx-auto shadow-lg shadow-red-500/10">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Hapus Pengumuman?</h3>
                <p className="text-sm text-gray-500">Tindakan ini tidak dapat dibatalkan. Data akan dihapus permanen dari sistem.</p>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setDeletingAnnId(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-gray-500 transition">Batal</button>
                <button onClick={handleDeleteAnnouncement} className="flex-1 py-4 bg-red-600 hover:bg-red-700 rounded-2xl text-xs font-bold text-white transition shadow-xl shadow-red-600/20">Ya, Hapus</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
