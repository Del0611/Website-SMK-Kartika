import React, { useState } from 'react';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { 
  Plus, 
  CreditCard, 
  ArrowUpDown, 
  Filter,
  Edit2,
  Trash2,
  X,
  Upload,
  FileDown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Payment, StudentInfo } from '../types';

interface PaymentsViewProps {
  payments: Payment[];
  role?: string;
  students: StudentInfo[];
}

export function PaymentsView({ payments, role, students }: PaymentsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  
  const [studentId, setStudentId] = useState('');
  const [month, setMonth] = useState('Januari');
  const [year, setYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState(295000);
  const [loading, setLoading] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: number; errors: string[] } | null>(null);

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const resetForm = () => {
    setStudentId('');
    setMonth('Januari');
    setYear(new Date().getFullYear());
    setAmount(295000);
    setEditingPayment(null);
  };

  const handleEdit = (p: Payment) => {
    setEditingPayment(p);
    setStudentId(p.studentId);
    setMonth(p.month);
    setYear(p.year);
    setAmount(p.amount);
    setIsModalOpen(true);
  };

  const addPayment = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const id = editingPayment?.id || `${studentId}_${month}_${year}`;
      await setDoc(doc(db, 'payments', id), {
        studentId,
        month,
        year,
        amount,
        status: 'paid',
        paidAt: (editingPayment as any)?.paidAt || new Date().toISOString()
      }, { merge: true });
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportStatus(null);
    const errors: string[] = [];
    let successCount = 0;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');

      const batch = writeBatch(db);
      
      // Skip header if it exists
      const startIndex = lines[0].toLowerCase().includes('nis') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length < 4) {
          errors.push(`Baris ${i + 1}: Format kolom tidak lengkap (NIS, Bulan, Tahun, Jumlah)`);
          continue;
        }

        const [nis, monthImport, yearImport, amountImport] = parts;
        const student = students.find(s => s.nis === nis);

        if (!student) {
          errors.push(`Baris ${i + 1}: Siswa dengan NIS ${nis} tidak ditemukan`);
          continue;
        }

        const amt = Number(amountImport.replace(/[^0-9]/g, ''));
        const yr = Number(yearImport);

        if (isNaN(amt) || isNaN(yr)) {
          errors.push(`Baris ${i + 1}: Format Jumlah atau Tahun tidak valid`);
          continue;
        }

        const id = `${student.uid}_${monthImport}_${yr}`;
        batch.set(doc(db, 'payments', id), {
          studentId: student.uid,
          month: monthImport,
          year: yr,
          amount: amt,
          status: 'paid',
          paidAt: new Date().toISOString()
        }, { merge: true });
        
        successCount++;
      }

      try {
        if (successCount > 0) {
          await batch.commit();
        }
        setImportStatus({ success: successCount, errors });
      } catch (error) {
        console.error('Import error:', error);
        errors.push('Gagal menyimpan data ke server');
        setImportStatus({ success: 0, errors });
      } finally {
        setImportLoading(false);
      }
    };

    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,NIS,Bulan,Tahun,Jumlah\n2223001,Januari,2024,295000\n2223002,Februari,2024,295000";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_import_pembayaran.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!deletingPaymentId) return;
    try {
      await deleteDoc(doc(db, 'payments', deletingPaymentId));
      setDeletingPaymentId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `payments/${deletingPaymentId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121212] p-6 rounded-3xl border border-[#1F1F1F] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold font-sans tracking-tight text-white">{role === 'admin' ? 'Data Pembayaran Siswa' : 'Riwayat SPP'}</h3>
          <p className="text-gray-500 text-sm">Informasi administrasi iuran sekolah (SPP).</p>
        </div>
        {role === 'admin' && (
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-2xl transition font-bold text-sm flex items-center gap-2"
            >
              <Upload className="w-5 h-5" /> Import CSV
            </button>
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="bg-brand-primary hover:bg-brand-primary/80 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-brand-primary/20 font-bold text-sm flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Catat Pembayaran
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#121212] rounded-3xl border border-[#1F1F1F] overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="border-b border-[#1F1F1F] bg-[#1A1A1A]">
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Keterangan</th>
                        {role === 'admin' && <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Siswa</th>}
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Jumlah</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                        {role === 'admin' && <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Aksi</th>}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1F1F]">
                     {payments.length > 0 ? payments.map(p => {
                       const student = students.find(s => s.uid === p.studentId);
                       return (
                        <tr key={p.id} className="hover:bg-white/5 transition">
                           <td className="px-6 py-4">
                              <p className="text-sm font-bold text-gray-200">SPP Bulan {p.month}</p>
                              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Tahun Ajaran {p.year}</p>
                           </td>
                           {role === 'admin' && (
                              <td className="px-6 py-4">
                                 <p className="text-xs font-semibold text-brand-primary">{student?.fullName || 'Siswa'}</p>
                                 <p className="text-[9px] text-gray-600 uppercase tracking-tight">{student?.class} - {student?.nis}</p>
                              </td>
                           )}
                           <td className="px-6 py-4 text-sm font-mono text-gray-400">Rp {p.amount.toLocaleString('id-ID')}</td>
                           <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-emerald-900/40 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/10">LUNAS</span>
                           </td>
                           {role === 'admin' && (
                             <td className="px-6 py-4">
                               <div className="flex gap-2">
                                 <button onClick={() => handleEdit(p)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition group"><Edit2 className="w-3.5 h-3.5" /></button>
                                 <button onClick={() => setDeletingPaymentId(p.id)} className="p-2 bg-white/5 hover:bg-red-900/40 rounded-xl text-gray-500 hover:text-red-500 transition group"><Trash2 className="w-3.5 h-3.5" /></button>
                               </div>
                             </td>
                           )}
                        </tr>
                       );
                     }) : (
                        <tr>
                           <td colSpan={role === 'admin' ? 5 : 3} className="px-6 py-12 text-center text-gray-600 italic">Belum ada catatan pembayaran.</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-[#121212] p-8 rounded-[40px] border border-brand-primary/20 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-2 h-full bg-brand-primary" />
              <div className="relative z-10">
                 <CreditCard className="w-10 h-10 text-brand-primary mb-6" />
                 <h4 className="text-xl font-bold text-white mb-2">Informasi Tagihan</h4>
                 <p className="text-sm text-gray-500 leading-relaxed mb-6">Besaran SPP bulanan adalah tetap untuk seluruh tingkatan kelas.</p>
                 <div className="pt-6 border-t border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Nominal / Bulan</span>
                       <span className="text-xl font-black font-mono text-white">Rp 295.000</span>
                    </div>
                    <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10">
                       <p className="text-[10px] text-brand-primary font-bold uppercase tracking-[0.2em] mb-2 text-center">BANK TRANSFER (Virtual Account)</p>
                       <p className="text-lg font-mono font-bold text-white tracking-widest text-center">8802 0812 3456 7890</p>
                    </div>
                 </div>
              </div>
           </div>

           <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-gray-400 hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-2">
              <Plus className="w-4 h-4 rotate-45" /> Laporkan Kendala Pembayaran
           </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-[#121212] w-full max-w-md rounded-[40px] border border-[#1F1F1F] p-8 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-white">{editingPayment ? 'Edit Pembayaran SPP' : 'Input Pembayaran SPP'}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-gray-500 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Pilih Siswa</label>
                <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none focus:border-brand-primary transition" disabled={!!editingPayment}>
                  <option value="">Pilih Siswa</option>
                  {students.filter(s => s.role === 'student').map(s => (
                    <option key={s.uid} value={s.uid}>{s.fullName} ({s.nis})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Bulan</label>
                  <select value={month} onChange={e => setMonth(e.target.value)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none focus:border-brand-primary transition">
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Tahun</label>
                  <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none focus:border-brand-primary transition" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 px-1">Jumlah Pembayaran</label>
                <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-4 text-sm text-white outline-none focus:border-brand-primary transition" />
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="flex-1 py-4 bg-white/5 rounded-2xl text-xs font-bold text-gray-500 hover:bg-white/10 transition">Batal</button>
              <button onClick={addPayment} disabled={loading} className="flex-1 py-4 bg-brand-primary rounded-2xl text-xs font-bold text-white shadow-xl shadow-brand-primary/20 transition-all hover:scale-105 active:scale-95">
                {loading ? 'Menyimpan...' : (editingPayment ? 'Simpan Perubahan' : 'Bayar Sekarang')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-[#121212] w-full max-w-lg rounded-[40px] border border-[#1F1F1F] p-8 space-y-6 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none -z-10">
                <Upload className="w-32 h-32 text-white" />
             </div>
             
             <div className="flex justify-between items-start relative z-10">
              <div>
                 <h3 className="text-xl font-black text-white">Import Pembayaran</h3>
                 <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-bold">Mass upload data pembayaran</p>
              </div>
              <button 
                onClick={() => { setIsImportModalOpen(false); setImportStatus(null); }} 
                className="text-gray-500 hover:text-white transition p-2.5 bg-white/5 hover:bg-white/10 rounded-full shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importStatus ? (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                 <div className={`p-6 rounded-3xl border ${importStatus.errors.length > 0 ? 'bg-orange-900/10 border-orange-500/20' : 'bg-emerald-900/10 border-emerald-500/20'} flex flex-col items-center text-center`}>
                    {importStatus.errors.length > 0 ? <AlertCircle className="w-12 h-12 text-orange-500 mb-4" /> : <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />}
                    <h4 className="text-lg font-bold text-white mb-2">Import Selesai</h4>
                    <p className="text-sm text-gray-400">
                       Berhasil mengimport <span className="text-emerald-400 font-bold">{importStatus.success}</span> data pembayaran.
                       {importStatus.errors.length > 0 && <span> Terdapat {importStatus.errors.length} kesalahan.</span>}
                    </p>
                 </div>

                 {importStatus.errors.length > 0 && (
                   <div className="space-y-2">
                     <p className="text-[10px] font-black text-red-500 uppercase tracking-widest px-1">Detail Kesalahan:</p>
                     <div className="bg-red-900/10 border border-red-500/10 rounded-2xl p-4 max-h-40 overflow-y-auto space-y-2">
                        {importStatus.errors.map((err, i) => (
                           <div key={i} className="flex gap-2 text-[10px] text-red-400 font-medium">
                              <span className="shrink-0">•</span>
                              <p>{err}</p>
                           </div>
                        ))}
                     </div>
                   </div>
                 )}

                 <button 
                  onClick={() => { setIsImportModalOpen(false); setImportStatus(null); }}
                  className="w-full py-5 bg-white/5 rounded-3xl text-sm font-black text-white hover:bg-white/10 transition uppercase tracking-widest"
                 >
                   Selesai
                 </button>
              </div>
            ) : (
              <div className="space-y-8 py-4">
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={downloadTemplate}
                      className="p-6 bg-white/5 hover:bg-white/10 rounded-3xl border border-white/5 transition group text-center flex flex-col items-center gap-3"
                    >
                       <FileDown className="w-8 h-8 text-brand-primary group-hover:scale-110 transition shrink-0" />
                       <div>
                          <p className="text-xs font-bold text-white">Unduh Template</p>
                          <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-tight font-bold">File .CSV</p>
                       </div>
                    </button>
                    
                    <label className="p-6 bg-brand-primary/5 hover:bg-brand-primary/10 rounded-3xl border border-brand-primary/10 transition group text-center flex flex-col items-center gap-3 cursor-pointer">
                       <input type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={importLoading} />
                       {importLoading ? (
                         <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin shrink-0"></div>
                       ) : (
                         <Upload className="w-8 h-8 text-brand-primary group-hover:-translate-y-1 transition shrink-0" />
                       )}
                       <div>
                          <p className="text-xs font-bold text-white">{importLoading ? 'Memproses...' : 'Upload Data'}</p>
                          <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-tight font-bold">Format .CSV</p>
                       </div>
                    </label>
                 </div>

                 <div className="bg-black/40 p-6 rounded-[32px] border border-white/5 space-y-4">
                    <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Panduan Import:</h5>
                    <div className="space-y-4">
                       <div className="flex gap-4">
                          <div className="w-6 h-6 rounded-lg bg-brand-primary/20 flex items-center justify-center text-brand-primary text-[10px] font-black shrink-0">1</div>
                          <p className="text-xs text-gray-400 font-medium leading-relaxed">Unduh template CSV yang telah disediakan untuk memastikan struktur kolom benar.</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-6 h-6 rounded-lg bg-brand-primary/20 flex items-center justify-center text-brand-primary text-[10px] font-black shrink-0">2</div>
                          <p className="text-xs text-gray-400 font-medium leading-relaxed">Pastikan <span className="text-white font-bold">NIS</span> siswa terdaftar di sistem. Kolom wajib: NIS, Bulan, Tahun, Jumlah.</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-6 h-6 rounded-lg bg-brand-primary/20 flex items-center justify-center text-brand-primary text-[10px] font-black shrink-0">3</div>
                          <p className="text-xs text-gray-400 font-medium leading-relaxed">Import maksimal 500 baris dalam satu kali proses untuk stabilitas jaringan.</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deletingPaymentId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[120]">
          <div className="bg-[#121212] w-full max-w-sm rounded-[32px] border border-red-900/30 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Hapus Pembayaran?</h3>
              <p className="text-sm text-gray-500">Catatan pembayaran ini akan dihapus permanen dari sistem.</p>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeletingPaymentId(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-gray-500 transition">Batal</button>
              <button onClick={handleDelete} className="flex-1 py-4 bg-red-600 hover:bg-red-700 rounded-2xl text-xs font-bold text-white transition shadow-xl shadow-red-600/20">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
