import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  BookOpen, 
  Clock, 
  School, 
  Save, 
  Upload, 
  CheckCircle2 
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Assignment, Submission, StudentInfo } from '../types';

interface GradingProps {
  sub: Submission;
  onSave: (id: string, grade: number, feedback: string) => void;
}

function SubmissionGradingCard({ sub, onSave }: GradingProps) {
  const [grade, setGrade] = useState(sub.grade || 0);
  const [feedback, setFeedback] = useState(sub.feedback || '');

  return (
    <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="font-bold text-gray-200">{sub.studentName}</h5>
        <span className="text-[10px] text-gray-500">{new Date(sub.submittedAt).toLocaleString()}</span>
      </div>
      <p className="text-sm text-gray-400 bg-black/20 p-4 rounded-xl border border-white/5">{sub.content}</p>
      {sub.fileUrl && (
        <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-2">
          <Upload className="w-3 h-3" /> Lihat File Lampiran
        </a>
      )}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div>
          <label className="text-[9px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Nilai (0-100)</label>
          <input type="number" value={grade} onChange={e => setGrade(Number(e.target.value))} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white" />
        </div>
        <div>
          <label className="text-[9px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Feedback</label>
          <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Bagus!" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white" />
        </div>
      </div>
      <button onClick={() => onSave(sub.id, grade, feedback)} className="w-full py-3 bg-brand-primary hover:bg-brand-primary/80 transition rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2">
        <Save className="w-4 h-4" /> Simpan Penilaian
      </button>
    </div>
  );
}

interface AssignmentsViewProps {
  assignments: Assignment[];
  user: StudentInfo | null;
}

export function AssignmentsView({ assignments, user }: AssignmentsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [targetClass, setTargetClass] = useState('Semua Kelas');
  const [targetMajor, setTargetMajor] = useState('Semua Jurusan');

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionContent, setSubmissionContent] = useState('');

  // Fetch submissions when an assignment is selected
  useEffect(() => {
    if (!selectedAssignment) {
      setSubmissions([]);
      return;
    }

    let subQuery;
    if (user?.role === 'student') {
      subQuery = query(collection(db, 'submissions'), where('assignmentId', '==', selectedAssignment.id), where('studentId', '==', user.uid));
    } else {
      subQuery = query(collection(db, 'submissions'), where('assignmentId', '==', selectedAssignment.id));
    }

    const unsub = onSnapshot(subQuery, (snap) => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'submissions'));

    return () => unsub();
  }, [selectedAssignment, user]);

  const addAssignment = async () => {
    if (!title || !subject || !deadline) return;
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'assignments', id), {
        title,
        subject,
        description,
        deadline,
        targetClass,
        targetMajor,
        teacherId: user?.uid,
        teacherName: user?.fullName,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setTitle('');
      setSubject('');
      setDeadline('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assignments');
    }
  };

  const submitAssignment = async () => {
    if (!selectedAssignment || !submissionContent || !user) return;
    try {
      const id = `${selectedAssignment.id}_${user.uid}`;
      await setDoc(doc(db, 'submissions', id), {
        assignmentId: selectedAssignment.id,
        studentId: user.uid,
        studentName: user.fullName,
        content: submissionContent,
        submittedAt: new Date().toISOString()
      });
      setSubmissionContent('');
      alert('Tugas berhasil dikirim!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'submissions');
    }
  };

  const handleLeveling = (subId: string, grade: number, feedback: string) => {
    setDoc(doc(db, 'submissions', subId), { grade, feedback }, { merge: true })
      .then(() => alert('Nilai disimpan!'))
      .catch(e => handleFirestoreError(e, OperationType.WRITE, `submissions/${subId}`));
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold font-sans tracking-tight text-white">Tugas & Materi</h3>
          <p className="text-gray-500 text-sm">Lihat daftar tugas harian dan kumpulkan sebelum deadline.</p>
        </div>
        {user?.role === 'teacher' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary hover:bg-brand-primary/80 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-brand-primary/20 font-bold text-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Buat Tugas Baru
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map(asg => (
          <motion.div 
            key={asg.id}
            whileHover={{ y: -5 }}
            onClick={() => setSelectedAssignment(asg)}
            className={`p-6 rounded-[32px] border transition-all cursor-pointer ${selectedAssignment?.id === asg.id ? 'bg-brand-primary/5 border-brand-primary shadow-xl shadow-brand-primary/10' : 'bg-[#121212] border-[#1F1F1F] hover:border-brand-primary/30'}`}
          >
            <div className="flex items-center justify-between mb-4">
               <div className="px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-[10px] font-bold text-brand-primary uppercase tracking-widest">{asg.subject}</div>
               <div className="flex items-center gap-1.5 text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">{new Date(asg.deadline).toLocaleDateString()}</span>
               </div>
            </div>
            <h4 className="text-lg font-bold text-white mb-2 leading-snug">{asg.title}</h4>
            <p className="text-sm text-gray-500 mb-6 line-clamp-2 leading-relaxed">{asg.description}</p>
            
            <div className="pt-4 border-t border-white/5 space-y-2">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-2">
                    <School className="w-3 h-3 text-blue-500" /> Target: {asg.targetClass} - {asg.targetMajor}
                </p>
                <p className="text-[10px] text-gray-600 font-bold flex items-center gap-2">
                    <BookOpen className="w-3 h-3 text-emerald-500" /> {asg.teacherName}
                </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Assignment Detail / Submission Area */}
      {selectedAssignment && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#121212] p-8 lg:p-10 rounded-[40px] border border-brand-primary/30 relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 pb-8 border-b border-white/5">
              <div>
                <button onClick={() => setSelectedAssignment(null)} className="text-brand-primary text-xs font-bold mb-4 hover:underline">&larr; Tutup Detail</button>
                <h4 className="text-3xl font-black text-white tracking-tight">{selectedAssignment.title}</h4>
                <p className="text-gray-400 mt-2">{selectedAssignment.description}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                 <div className="px-4 py-2 bg-red-900/20 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold">
                    Deadline: {new Date(selectedAssignment.deadline).toLocaleString()}
                 </div>
                 <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Post: {new Date(selectedAssignment.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            {user?.role === 'student' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h5 className="text-lg font-bold text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-brand-primary" /> Pengumpulan Tugas
                  </h5>
                  <div className="space-y-4">
                    <textarea 
                      value={submissionContent}
                      onChange={e => setSubmissionContent(e.target.value)}
                      placeholder="Tuliskan jawaban atau link tugas Anda di sini..."
                      className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-[32px] p-6 text-sm text-gray-300 outline-none focus:border-brand-primary transition min-h-[200px]"
                    />
                    <button 
                      onClick={submitAssignment}
                      className="w-full py-4 bg-brand-primary hover:bg-brand-primary/80 transition rounded-[24px] font-bold text-white shadow-xl shadow-brand-primary/20"
                    >
                      Kumpulkan Sekarang
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h5 className="text-lg font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Riwayat & Feedback
                  </h5>
                  {submissions.length > 0 ? submissions.map(sub => (
                    <div key={sub.id} className="bg-white/5 p-6 rounded-[32px] border border-white/10 space-y-4">
                      <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl mb-4">
                        <div className="text-[10px] font-bold text-gray-500">DIKUMPULKAN PADA</div>
                        <div className="text-xs font-bold text-brand-primary">{new Date(sub.submittedAt).toLocaleString()}</div>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl text-sm italic text-gray-500 border border-white/5">{sub.content}</div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-4 bg-emerald-900/10 rounded-2xl border border-emerald-500/10">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Nilai</p>
                            <p className="text-3xl font-black text-emerald-400 font-mono">{sub.grade ?? '-'}</p>
                         </div>
                         <div className="p-4 bg-blue-900/10 rounded-2xl border border-blue-500/10">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Feedback Guru</p>
                            <p className="text-xs font-medium text-blue-300">{sub.feedback || 'Menunggu feedback...'}</p>
                         </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-10 border-2 border-dashed border-[#1F1F1F] rounded-[32px] text-center opacity-30">
                       <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Belum ada submission.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {user?.role === 'teacher' && (
              <div className="space-y-6">
                <h5 className="text-lg font-bold text-white">Daftar Pengumpulan Siswa ({submissions.length})</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {submissions.length > 0 ? submissions.map(sub => (
                      <SubmissionGradingCard key={sub.id} sub={sub} onSave={handleLeveling} />
                   )) : (
                     <p className="text-gray-500 text-sm italic col-span-2 py-10 text-center">Belum ada siswa yang mengumpulkan tugas ini.</p>
                   )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Assignment Creator Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] w-full max-w-2xl rounded-[48px] border border-[#1F1F1F] p-10 space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-black text-white">Buat Penugasan Baru</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Judul Tugas</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: UTS Matematika Dasar" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Mata Pelajaran</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Matematika" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Deadline</label>
                  <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Untuk Kelas</label>
                  <select value={targetClass} onChange={e => setTargetClass(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white">
                    <option value="Semua Kelas">Semua Kelas</option>
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Jurusan</label>
                  <select value={targetMajor} onChange={e => setTargetMajor(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white">
                    <option value="Semua Jurusan">Semua Jurusan</option>
                    <option value="IPA">IPA (MIPA)</option>
                    <option value="IPS">IPS (IIS)</option>
                    <option value="BAHASA">BAHASA</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Instruksi & Deskripsi</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white min-h-[120px]" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 px-8 rounded-2xl bg-white/5 text-gray-500 font-bold transition">Batal</button>
                <button onClick={addAssignment} className="flex-[2] py-4 px-8 rounded-2xl bg-brand-primary text-white font-bold shadow-xl shadow-brand-primary/20">Posting Tugas</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
