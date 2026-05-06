import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Plus, 
  Upload, 
  Search, 
  ArrowUpDown,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Grade, StudentInfo } from '../types';
import { MAJORS } from '../constants';

interface GradesViewProps {
  grades: Grade[];
  role?: string;
  students: StudentInfo[];
  currentUserName: string;
}

export function GradesView({ grades, role, students, currentUserName }: GradesViewProps) {
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
  const [loading, setLoading] = useState(false);

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
        kelas: 'X',
        jurusan: MAJORS[2], // Rekayasa Perangkat Lunak
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
    if (!studentId || !subject || !score) {
      alert('Harap lengkapi semua field (Siswa, Mata Pelajaran, dan Skor).');
      return;
    }
    setLoading(true);
    try {
      const id = editingGrade?.id || `grade_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
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
      
      alert(editingGrade ? 'Nilai berhasil diperbarui!' : 'Nilai berhasil disimpan!');
      setIsModalOpen(false);
      setEditingGrade(null);
      setStudentId('');
      setSubject('');
      setScore('');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    } finally {
      setLoading(false);
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
                            <Edit2 className="w-4 h-4" />
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
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">Belum ada data nilai.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Input Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-[#121212] w-full max-w-lg rounded-[40px] border border-[#1F1F1F] p-8 space-y-6">
            <h3 className="text-xl font-bold text-white">{editingGrade ? 'Ubah Nilai' : 'Input Nilai Baru'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Siswa</label>
                <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none">
                  <option value="">Pilih Siswa</option>
                  {students.filter(s => s.role === 'student').map(s => (
                    <option key={s.uid} value={s.uid}>{s.fullName} ({s.nis}) - {s.class}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Mata Pelajaran</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Contoh: Matematika" className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Skor (0-100)</label>
                <input type="number" value={score} onChange={e => setScore(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Semester</label>
                <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none">
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Tipe Nilai</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none">
                  <option value="Tugas">Tugas</option>
                  <option value="Kuis">Kuis</option>
                  <option value="UTS">UTS</option>
                  <option value="UAS">UAS</option>
                  <option value="Kehadiran">Kehadiran</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Tanggal</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setIsModalOpen(false)} 
                disabled={loading}
                className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-white/5 transition disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={addGrade}
                disabled={loading}
                className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/80 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editingGrade ? 'Simpan' : 'Tambahkan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
          <div className="bg-[#121212] w-full max-w-sm rounded-[40px] border border-[#1F1F1F] p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Hapus Nilai?</h3>
              <p className="text-gray-500 text-sm">Data yang dihapus tidak dapat dikembalikan.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmationId(null)} className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-white/5 transition">Batal</button>
              <button 
                onClick={() => deleteGrade(deleteConfirmationId)}
                className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-[#121212] w-full max-w-lg rounded-[40px] border border-[#1F1F1F] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Import Nilai dari Excel</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-500 hover:text-white transition"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
              <p className="text-sm text-gray-400 leading-relaxed">
                Gunakan file Excel (.xlsx) dengan kolom: <br/> 
                <span className="text-brand-primary font-mono text-xs">nis, subject, score, type, semester, year</span>
              </p>
              <button 
                onClick={downloadGradeTemplate}
                className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-2"
              >
                <Plus className="w-3 h-3" /> Download Template Excel
              </button>
            </div>

            <div className="relative">
              {importProgress ? (
                <div className="py-8 text-center space-y-4">
                   <div className="w-full bg-[#1A1A1A] h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        className="bg-brand-primary h-full"
                      />
                   </div>
                   <p className="text-sm font-bold text-white">Memproses baris {importProgress.current} dari {importProgress.total}...</p>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[#2A2A2A] rounded-[32px] hover:border-brand-primary/50 cursor-pointer hover:bg-brand-primary/5 transition group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-gray-600 mb-4 group-hover:text-brand-primary transition" />
                    <p className="mb-2 text-sm text-gray-500 font-bold group-hover:text-white transition">Klik untuk unggah file Excel</p>
                    <p className="text-xs text-gray-700">XLSX file format only</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx" onChange={handleGradeImport} />
                </label>
              )}
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setIsImportModalOpen(false)} 
                className="w-full px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-white/5 transition border border-[#1F1F1F]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
