import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu,
  LogOut
} from 'lucide-react';
import { Tab, StudentInfo } from '../types';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  tabs: { id: string; label: string; icon: any }[];
  handleLogout: () => void;
}

export function Sidebar({ isSidebarOpen, setIsSidebarOpen, activeTab, setActiveTab, tabs, handleLogout }: SidebarProps) {
  return (
    <>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#121212] border-r border-[#1F1F1F] z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg shadow-black/20">
              <img src="/logo.png" alt="Logo SMK Kartika" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-lg leading-tight tracking-tight text-white">SMK Kartika XX-1 Makassar</span>
          </div>

          <nav className="flex-1 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as Tab);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-gray-400 hover:bg-[#1F1F1F] hover:text-white'}`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="pt-6 border-t border-[#1F1F1F]">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-900/10 transition-all font-sans"
            >
              <LogOut className="w-5 h-5" />
              Keluar Akun
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

interface HeaderProps {
  setIsSidebarOpen: (open: boolean) => void;
  activeTab: Tab;
  studentInfo: StudentInfo | null;
}

export function Header({ setIsSidebarOpen, activeTab, studentInfo }: HeaderProps) {
  return (
    <header className="h-16 bg-[#121212] border-b border-[#1F1F1F] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden p-2 hover:bg-[#1F1F1F] rounded-lg text-gray-400"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold text-white capitalize">{activeTab}</h2>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        <div className="hidden sm:block text-right">
          <p className="text-sm font-semibold text-white">{studentInfo?.fullName}</p>
          <p className="text-xs text-gray-500">{studentInfo?.role} {studentInfo?.class ? `- ${studentInfo.class}` : ''}</p>
        </div>
        <div className="w-10 h-10 bg-white rounded-full border-2 border-brand-primary shadow-sm overflow-hidden p-0.5">
          <img src="/logo.png" alt="Avatar" className="w-full h-full object-contain" />
        </div>
      </div>
    </header>
  );
}
