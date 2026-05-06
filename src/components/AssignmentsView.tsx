import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  BookOpen, 
  Clock, 
  School, 
  Save, 
  Upload, 
  CheckCircle2,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Assignment, Submission, StudentInfo } from '../types';
import { MAJORS } from '../constants';

interface GradingProps {
  sub: Submission;
  onSave: (id: string, grade: number, feedback: string) => void;
  key?: string | number;
}

function SubmissionGradingCard({ sub, onSave }: GradingProps) {
  const [grade, setGrade] = useState(sub.grade || 0);
  const [feedback, setFeedback] = useState(sub.feedback || '');

  return (
    <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h5 className="font-bold text-gray-200 leading-none mb-1">{sub.studentName}</h5>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">{sub.studentClass || 'Siswa'}</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">NIS: {sub.studentNis || '-'}</span>
          </div>
        </div>
        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{new Date(sub.submittedAt).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-gray-400 bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-wrap">{sub.content}</p>
      {sub.fileUrl && (
        <div className="flex items-center justify-between p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
          <div className="flex items-center gap-2 overflow-hidden">
            <Upload className="w-4 h-4 text-brand-primary shrink-0" />
            <span className="text-[10px] font-bold text-gray-400 truncate">{sub.fileName || 'File Lampiran'}</span>
          </div>
          <a 
            href={sub.fileUrl} 
            download={sub.fileName}
            target="_blank" 
            rel="noreferrer" 
            className="text-[10px] font-black text-brand-primary hover:underline uppercase tracking-widest shrink-0"
          >
            Buka File
          </a>
        </div>
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
  const [editingAsg, setEditingAsg] = useState<Assignment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [targetClass, setTargetClass] = useState('Semua Kelas');
  const [targetMajor, setTargetMajor] = useState('Semua Jurusan');
  const [semester, setSemester] = useState('Ganjil');
  const [year, setYear] = useState('2025/2026');
  const [loading, setLoading] = useState(false);

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [submissionContent, setSubmissionContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [deletingAsgId, setDeletingAsgId] = useState<string | null>(null);

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

  const resetForm = () => {
    setTitle('');
    setSubject('');
    setDescription('');
    setDeadline('');
    setTargetClass('Semua Kelas');
    setTargetMajor('Semua Jurusan');
    setSemester('Ganjil');
    setYear('2025/2026');
    setEditingAsg(null);
  };

  const handleEditAsg = (asg: Assignment) => {
    setEditingAsg(asg);
    setTitle(asg.title);
    setSubject(asg.subject);
    setDescription(asg.description);
    setDeadline(asg.deadline);
    setTargetClass(asg.targetClass);
    setTargetMajor(asg.targetMajor);
    setSemester(asg.semester || 'Ganjil');
    setYear(asg.year || '2025/2026');
    setIsModalOpen(true);
  };

  const addAssignment = async () => {
    console.log('Validating fields:', { title, subject, deadline });
    if (!title.trim() || !subject.trim() || !deadline) {
      const missing = [];
      if (!title.trim()) missing.push('Judul');
      if (!subject.trim()) missing.push('Mata Pelajaran');
      if (!deadline) missing.push('Deadline');
      alert(`Harap isi: ${missing.join(', ')}`);
      return;
    }
    if (!user) {
      alert('Sesi Anda tidak valid. Silakan login kembali.');
      return;
    }

    setLoading(true);
    try {
      const id = editingAsg?.id || `asg_${Date.now()}`;
      const assignmentData = {
        title,
        subject,
        description: description || '',
        deadline,
        targetClass,
        targetMajor,
        teacherId: editingAsg?.teacherId || user.uid,
        teacherName: editingAsg?.teacherName || user.fullName || 'Guru',
        semester,
        year,
        createdAt: editingAsg?.createdAt || new Date().toISOString()
      };

      console.log('Posting assignment...', id, assignmentData);
      await setDoc(doc(db, 'assignments', id), assignmentData, { merge: true });
      
      alert(editingAsg ? 'Tugas berhasil diperbarui!' : 'Tugas berhasil diposting!');
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error posting assignment:', error);
      const msg = error.message?.includes('permission') 
        ? 'Gagal: Anda tidak memiliki izin untuk memposting tugas. Pastikan peran Anda adalah Guru/Admin.' 
        : `Gagal memposting tugas: ${error.message || 'Kesalahan tidak diketahui'}`;
      alert(msg);
      handleFirestoreError(error, OperationType.WRITE, `assignments`);
    } finally {
      setLoading(false);
    }
  };

  const deleteAssignment = async () => {
    if (!deletingAsgId) return;
    try {
      await deleteDoc(doc(db, 'assignments', deletingAsgId));
      if (selectedAssignment?.id === deletingAsgId) setSelectedAssignment(null);
      setDeletingAsgId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `assignments/${deletingAsgId}`);
    }
  };

  const submitAssignment = async () => {
    if (!selectedAssignment || !user) return;
    if (!submissionContent && !selectedFile) {
      alert('Harap isi jawaban atau lampirkan file.');
      return;
    }

    setLoading(true);
    try {
      const id = `${selectedAssignment.id}_${user.uid}`;
      const submissionData: any = {
        assignmentId: selectedAssignment.id,
        studentId: user.uid,
        studentName: user.fullName,
        studentNis: user.nis,
        studentClass: user.class,
        content: submissionContent || '',
        submittedAt: new Date().toISOString()
      };

      if (selectedFile && fileDataUrl) {
        submissionData.fileUrl = fileDataUrl;
        submissionData.fileName = selectedFile.name;
      }

      await setDoc(doc(db, 'submissions', id), submissionData);
      setSubmissionContent('');
      setSelectedFile(null);
      setFileDataUrl(null);
      alert('Tugas berhasil dikirim!');
    } catch (error: any) {
      console.error('Submission error:', error);
      alert('Gagal mengirim tugas. Pastikan ukuran file tidak terlalu besar (maks 800KB).');
      handleFirestoreError(error, OperationType.WRITE, 'submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { // ~800KB
        alert('File terlalu besar! Maksimal 800KB untuk memastikan penyimpanan stabil.');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLeveling = async (subId: string, gradeValue: number, feedback: string) => {
    try {
      // 1. Update Submission
      await setDoc(doc(db, 'submissions', subId), { grade: gradeValue, feedback }, { merge: true });
      
      // 2. Sync to Grades table
      if (selectedAssignment && user) {
        const gradeId = `grade_asg_sub_${subId}`;
        await setDoc(doc(db, 'grades', gradeId), {
          studentId: subId.split('_').pop() || '', // Assuming subId format is assignmentId_studentId
          subject: selectedAssignment.subject,
          score: Number(gradeValue),
          type: 'Tugas',
          teacherId: user.uid,
          teacherName: user.fullName,
          semester: selectedAssignment.semester || 'Ganjil',
          year: selectedAssignment.year || '2025/2026',
          date: new Date().toISOString()
        }, { merge: true });
      }

      alert('Nilai & Feedback berhasil disimpan!');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `submissions/${subId}`);
    }
  };

  const filteredAssignments = assignments.filter(asg => 
    asg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asg.teacherName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubmissions = submissions.filter(sub => 
    sub.studentName.toLowerCase().includes(subSearchQuery.toLowerCase()) ||
    (sub.studentNis && sub.studentNis.includes(subSearchQuery)) ||
    (sub.studentClass && sub.studentClass.toLowerCase().includes(subSearchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#121212] p-6 lg:p-8 rounded-[40px] border border-[#1F1F1F] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-2xl font-black font-sans tracking-tight text-white mb-1">Tugas & Materi</h3>
          <p className="text-gray-500 text-sm font-medium">Lengkapi tugas harian dan kumpulkan tepat waktu.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 max-w-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Cari tugas, mapel, atau guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-brand-primary outline-none transition-all focus:ring-4 focus:ring-brand-primary/10"
            />
          </div>

          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <button 
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="bg-brand-primary hover:brightness-110 active:scale-95 text-white px-6 py-3.5 rounded-2xl transition shadow-xl shadow-brand-primary/20 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-5 h-5" /> Buat Tugas
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssignments.length > 0 ? filteredAssignments.map(asg => (
          <motion.div 
            key={asg.id}
            whileHover={{ y: -5 }}
            onClick={() => setSelectedAssignment(asg)}
            className={`p-6 rounded-[32px] border transition-all cursor-pointer relative group ${selectedAssignment?.id === asg.id ? 'bg-brand-primary/5 border-brand-primary shadow-xl shadow-brand-primary/10' : 'bg-[#121212] border-[#1F1F1F] hover:border-brand-primary/30'}`}
          >
            {/* Admin/Teacher Controls */}
            {(user?.role === 'admin' || (user?.role === 'teacher' && user?.uid === asg.teacherId)) && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditAsg(asg);
                  }}
                  className="p-3 bg-[#1A1A1A] hover:bg-brand-primary/20 rounded-xl text-gray-500 hover:text-brand-primary transition border border-[#2A2A2A]"
                  title="Edit Tugas"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
               <button 
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setDeletingAsgId(asg.id);
                 }}
                 className="p-3 bg-[#1A1A1A] hover:bg-red-900/40 rounded-xl text-gray-500 hover:text-red-500 transition border border-[#2A2A2A]"
                 title="Hapus Tugas"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
              </div>
            )}

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
        )) : (
          <div className="col-span-full py-20 text-center bg-[#121212] rounded-[40px] border border-dashed border-[#1F1F1F]">
            <Search className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-gray-400">Tidak ada tugas ditemukan</h4>
            <p className="text-gray-600 text-sm">Coba kata kunci pencarian lain.</p>
          </div>
        )}
      </div>

      {/* Assignment Detail Modal */}
      <AnimatePresence>
        {selectedAssignment && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] w-full max-w-4xl rounded-[48px] border border-[#1F1F1F] p-8 lg:p-12 space-y-8 max-h-[95vh] overflow-y-auto"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">{selectedAssignment.subject}</span>
                    <button onClick={() => setSelectedAssignment(null)} className="text-gray-500 hover:text-white text-xs font-bold transition">Tutup Detail</button>
                  </div>
                  <h4 className="text-4xl font-black text-white tracking-tight leading-tight">{selectedAssignment.title}</h4>
                  <p className="text-gray-400 mt-3 text-lg leading-relaxed max-w-2xl">{selectedAssignment.description}</p>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                   <div className="px-5 py-3 bg-red-900/20 border border-red-500/20 rounded-2xl text-red-500 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4" /> DEADLINE: {new Date(selectedAssignment.deadline).toLocaleString()}
                   </div>
                   <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl">Posted by {selectedAssignment.teacherName} • {new Date(selectedAssignment.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {user?.role === 'student' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <h5 className="text-xl font-black text-white flex items-center gap-3">
                      <Upload className="w-6 h-6 text-brand-primary" /> Pengumpulan
                    </h5>
                    <div className="space-y-6">
                      <textarea 
                        value={submissionContent}
                        onChange={e => setSubmissionContent(e.target.value)}
                        placeholder="Tuliskan jawaban atau keterangan tugas Anda di sini..."
                        className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-[32px] p-8 text-sm text-gray-300 outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 transition min-h-[200px]"
                      />
                      
                      <div className="relative group">
                        <input type="file" onChange={handleFileChange} className="hidden" id="file-upload" />
                        <label htmlFor="file-upload" className="flex items-center justify-center gap-4 w-full py-10 border-2 border-dashed border-[#1F1F1F] rounded-[32px] cursor-pointer hover:border-brand-primary/50 hover:bg-brand-primary/5 transition group">
                          {selectedFile ? (
                            <div className="text-center">
                              <CheckCircle2 className="w-10 h-10 text-brand-primary mx-auto mb-3" />
                              <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                              <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Ganti File</p>
                            </div>
                          ) : (
                            <>
                              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-brand-primary transition">
                                <Upload className="w-7 h-7" />
                              </div>
                              <div className="text-left">
                                <p className="text-base font-bold text-white mb-1">Lampirkan Berkas</p>
                                <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">PDF / JPG / Dokumentasi (Max 800KB)</p>
                              </div>
                            </>
                          )}
                        </label>
                      </div>

                      <button onClick={submitAssignment} disabled={loading} className="w-full py-5 bg-brand-primary hover:brightness-110 active:scale-[0.98] transition rounded-[32px] font-black text-sm uppercase tracking-[0.2em] text-white shadow-2xl shadow-brand-primary/30 flex items-center justify-center gap-3 disabled:opacity-50">
                        {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Kumpulkan Sekarang</>}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <h5 className="text-xl font-black text-white flex items-center gap-3">
                      <Clock className="w-6 h-6 text-emerald-500" /> Riwayat Tugas
                    </h5>
                    {submissions.length > 0 ? submissions.map(sub => (
                      <div key={sub.id} className="bg-white/5 p-8 rounded-[40px] border border-white/10 space-y-6">
                        <div className="flex justify-between items-center bg-black/30 p-5 rounded-2xl">
                          <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Submitted On</p>
                            <p className="text-sm font-bold text-brand-primary uppercase tracking-tight">{new Date(sub.submittedAt).toLocaleString()}</p>
                          </div>
                          <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                        </div>
                        
                        {sub.content && <div className="bg-black/40 p-6 rounded-2xl text-sm italic text-gray-300 border border-white/5 leading-relaxed">{sub.content}</div>}

                        {sub.fileUrl && (
                          <div className="bg-brand-primary/5 border border-brand-primary/20 p-5 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-primary"><Upload className="w-5 h-5" /></div>
                              <div>
                                 <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-0.5">Berkas Terlampir</p>
                                 <p className="text-xs font-bold text-gray-300 truncate max-w-[140px]">{sub.fileName || 'Lampiran'}</p>
                              </div>
                            </div>
                            <a href={sub.fileUrl} download={sub.fileName} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-brand-primary text-white text-[10px] font-black rounded-xl hover:brightness-110 transition uppercase tracking-widest">Buka</a>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-6">
                           <div className="p-6 bg-emerald-900/10 rounded-3xl border border-emerald-500/10 text-center">
                              <p className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-2">Nilai Akhir</p>
                              <p className="text-4xl font-black text-emerald-400 font-mono">{sub.grade ?? '-'}</p>
                           </div>
                           <div className="p-6 bg-blue-900/10 rounded-3xl border border-blue-500/10">
                              <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Feedback Guru</p>
                              <p className="text-xs font-bold text-blue-300 leading-relaxed">{sub.feedback || 'Sedang dinilai...'}</p>
                           </div>
                        </div>
                      </div>
                    )) : (
                      <div className="p-16 border-2 border-dashed border-[#1F1F1F] rounded-[48px] text-center opacity-20"><p className="text-sm font-black uppercase tracking-[0.3em] text-gray-500">Belum ada pengumpulan</p></div>
                    )}
                  </div>
                </div>
              )}

              {(user?.role === 'teacher' || user?.role === 'admin') && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <h5 className="text-2xl font-black text-white">Daftar Pengumpulan Siswa <span className="text-brand-primary text-sm opacity-50 ml-2">({submissions.length})</span></h5>
                    <div className="relative w-full md:w-80 group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-brand-primary transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Cari Siswa, NIS, atau Kelas..." 
                        value={subSearchQuery}
                        onChange={(e) => setSubSearchQuery(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {filteredSubmissions.length > 0 ? filteredSubmissions.map(sub => (
                        <SubmissionGradingCard key={sub.id} sub={sub} onSave={handleLeveling} />
                     )) : (
                       <div className="col-span-2 py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[40px]">
                         <Search className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                         <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Tidak ada pengumpulan yang cocok</p>
                       </div>
                     )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assignment Creator/Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] w-full max-w-2xl rounded-[48px] border border-[#1F1F1F] p-10 space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <form onSubmit={(e) => { e.preventDefault(); addAssignment(); }} className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-white">{editingAsg ? 'Edit Penugasan' : 'Buat Penugasan Baru'}</h3>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition"><X className="w-6 h-6" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Tahun Ajaran</label>
                    <select value={year} onChange={e => setYear(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none">
                      <option value="2024/2025">2024/2025</option>
                      <option value="2025/2026">2025/2026</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Semester</label>
                    <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none">
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Judul Tugas</label>
                    <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: UTS Matematika Dasar" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Mata Pelajaran</label>
                    <input required type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Matematika" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Deadline</label>
                    <input required type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Untuk Kelas</label>
                    <select value={targetClass} onChange={e => setTargetClass(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none">
                      <option value="Semua Kelas">Semua Kelas</option>
                      <option value="X">Kelas X</option>
                      <option value="XI">Kelas XI</option>
                      <option value="XII">Kelas XII</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Jurusan</label>
                    <select value={targetMajor} onChange={e => setTargetMajor(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white focus:border-brand-primary outline-none">
                      <option value="Semua Jurusan">Semua Jurusan</option>
                      {MAJORS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Instruksi & Deskripsi</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white min-h-[120px] focus:border-brand-primary outline-none" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => { setIsModalOpen(false); resetForm(); }} 
                    disabled={loading}
                    className="flex-1 py-4 px-8 rounded-2xl bg-white/5 text-gray-500 font-bold transition disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] py-4 px-8 rounded-2xl bg-brand-primary text-white font-bold shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      editingAsg ? 'Update Tugas' : 'Posting Tugas'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {deletingAsgId && (
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
                <h3 className="text-xl font-bold text-white mb-2">Hapus Tugas?</h3>
                <p className="text-sm text-gray-500">Seluruh data tugas dan pengumpulan siswa akan dihapus permanen.</p>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setDeletingAsgId(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-gray-500 transition">Batal</button>
                <button onClick={deleteAssignment} className="flex-1 py-4 bg-red-600 hover:bg-red-700 rounded-2xl text-xs font-bold text-white transition shadow-xl shadow-red-600/20">Hapus Permanen</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
