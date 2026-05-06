import React, { useState } from 'react';
import { motion } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Megaphone, 
  Settings, 
  Mail, 
  Phone, 
  Save 
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
              <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{announcements.length} Update Terbaru</span>
           </div>

           <div className="space-y-6">
             {announcements.length > 0 ? announcements.map((ann, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={ann.id} 
                  className="group/item relative pl-6 border-l border-brand-primary/20 hover:border-brand-primary transition-colors cursor-pointer"
                >
                  <p className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.2em] mb-1">{ann.category}</p>
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
    </div>
  );
}
