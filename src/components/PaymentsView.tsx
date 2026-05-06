import React, { useState } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  Plus, 
  CreditCard, 
  ArrowUpDown, 
  Filter,
  Edit2,
  Trash2,
  X
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
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  
  const [studentId, setStudentId] = useState('');
  const [month, setMonth] = useState('Januari');
  const [year, setYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState(295000);
  const [loading, setLoading] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

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
        paidAt: editingPayment?.paidAt || new Date().toISOString()
      }, { merge: true });
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
    } finally {
      setLoading(false);
    }
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
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-brand-primary hover:bg-brand-primary/80 text-white px-6 py-3 rounded-2xl transition shadow-lg shadow-brand-primary/20 font-bold text-sm flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Catat Pembayaran
          </button>
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
