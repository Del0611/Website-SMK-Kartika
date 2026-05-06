import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { StudentInfo } from '../types';

interface ProfileViewProps {
  studentInfo: StudentInfo | null;
  uid: string;
  setStudentInfo: (info: StudentInfo) => void;
}

export function ProfileView({ studentInfo, uid, setStudentInfo }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<StudentInfo | null>(studentInfo);

  useEffect(() => {
    setFormData(studentInfo);
  }, [studentInfo]);

  const saveProfile = async () => {
    if (!formData) return;
    try {
      await setDoc(doc(db, 'users', uid), formData);
      setStudentInfo(formData);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-[#121212] p-8 rounded-[40px] border border-[#1F1F1F] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        
        <div className="flex flex-col items-center mb-8 relative">
          <div className="w-24 h-24 bg-white rounded-full p-1 border-4 border-[#121212] shadow-xl overflow-hidden mb-4">
            <img src="/logo.png" alt="Avatar" className="w-full h-full object-contain" />
          </div>
          <h3 className="text-xl font-bold text-white font-sans tracking-tight">{studentInfo?.fullName}</h3>
          <p className="text-brand-primary text-sm font-bold uppercase tracking-widest">{studentInfo?.role}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Nama Lengkap</label>
              {isEditing ? (
                <input type="text" value={formData?.fullName} onChange={e => setFormData(prev => prev ? { ...prev, fullName: e.target.value } : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
              ) : (
                <p className="text-sm font-semibold text-gray-200">{studentInfo?.fullName}</p>
              )}
            </div>
            {(studentInfo?.role === 'student' || studentInfo?.role === 'parent') && (
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">NIS (Induk Siswa)</label>
                <p className="text-sm font-semibold text-gray-200">{studentInfo?.nis || '-'}</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Peran (Role)</label>
              <p className="text-sm font-bold text-brand-primary uppercase tracking-widest">{studentInfo?.role}</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Email</label>
              <p className="text-sm font-semibold text-gray-400 italic">{studentInfo?.email}</p>
            </div>
            {studentInfo?.role === 'student' && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Kelas</label>
                  <p className="text-sm font-semibold text-gray-200">{studentInfo?.class || '-'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Jurusan</label>
                  <p className="text-sm font-semibold text-gray-200">{studentInfo?.major || '-'}</p>
                </div>
              </>
            )}
            {studentInfo?.role === 'parent' && (
              <div>
                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">ID Siswa (Child ID)</label>
                {isEditing ? (
                  <input type="text" value={formData?.studentId} onChange={e => setFormData(prev => prev ? { ...prev, studentId: e.target.value } : null)} className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" />
                ) : (
                  <p className="text-sm font-semibold text-gray-200">{studentInfo?.studentId || '-'}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-[#1F1F1F] flex justify-center">
          {isEditing ? (
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-[#1A1A1A] transition"
              >
                Batal
              </button>
              <button 
                onClick={saveProfile}
                className="flex-1 px-6 py-3 rounded-2xl text-sm font-bold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/80 transition"
              >
                Simpan Perubahan
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full sm:w-auto px-10 py-3 rounded-2xl text-sm font-bold border border-gray-800 text-gray-300 hover:bg-[#1A1A1A] transition"
            >
              Ubah Data Profil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
