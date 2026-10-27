import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  LogOut,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { UserAvatar } from '../common/Avatar';
import { RubikLogo } from '../common/RubikLogo';
import { SettingsModal } from '../common/SettingsModal';
import { ProfileModal } from '../users/ProfileModal';
import { UsersManagerModal } from '../users/UsersManagerModal';

export function Navbar({ onOpenExport }: { onOpenExport: () => void }) {
  const { user, logout } = useAuth();
  const { report, activeTab, setActiveTab } = useWeek();

  // Modals
  const [settingsModal, setSettingsModal] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [usersModal, setUsersModal] = useState(false);

  const isLeader = user?.role === 'leader';

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0e1117]/95 backdrop-blur-md border-b border-[#232836] no-print">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Org Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <RubikLogo size="md" showText={true} />
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#232836]">
              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                {report?.week.teamName || 'PerFect T012'}
              </span>
              <span className="text-xs text-slate-400 hidden lg:inline">
                {report?.week.discipline || '3D LiDAR'}
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {/* Nút vào bảng tính Excel trên web */}
            <button
              onClick={() => setActiveTab(activeTab === 'web_sheets' ? 'overview' : 'web_sheets')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                activeTab === 'web_sheets'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-[#151922] text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
              }`}
            >
              <FileSpreadsheet size={15} />
              <span className="hidden sm:inline">Nhập bảng Excel web</span>
            </button>

            {/* Quản lý danh mục thành viên */}
            <button
              onClick={() => setActiveTab(activeTab === 'members' ? 'overview' : 'members')}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-slate-200 text-slate-900 border-white'
                  : 'bg-[#151922] text-slate-300 border-[#232836] hover:bg-slate-800'
              }`}
              title="Danh mục thành viên"
            >
              <Users size={15} />
              <span className="hidden sm:inline">Thành viên</span>
            </button>

            {/* Quản lý tài khoản (Chỉ Leader) */}
            {isLeader && (
              <button
                onClick={() => setUsersModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151922] hover:bg-slate-800 text-slate-300 border border-[#232836] rounded-xl text-xs font-medium transition-colors"
                title="Quản lý tài khoản đăng nhập"
              >
                <Shield size={14} className="text-purple-400" />
                <span className="hidden md:inline">Tài khoản</span>
              </button>
            )}

            {/* Xuất báo cáo */}
            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#151922] hover:bg-slate-800 text-slate-200 border border-[#232836] rounded-xl text-xs font-medium transition-colors"
            >
              <Download size={15} className="text-slate-400" />
              <span className="hidden sm:inline">Xuất báo cáo</span>
            </button>

            {/* Nút Cài đặt (Settings: Theme sáng/tối, Ngôn ngữ) */}
            <button
              onClick={() => setSettingsModal(true)}
              title="Cài đặt hệ thống (Sáng/Tối, Ngôn ngữ)"
              className="p-2 bg-[#151922] hover:bg-slate-800 text-slate-300 hover:text-white border border-[#232836] rounded-xl transition-colors"
            >
              <Settings size={15} />
            </button>

            {/* User Profile dropdown */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#232836]">
              <button
                onClick={() => setProfileModal(true)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                title="Hồ sơ tài khoản cá nhân"
              >
                <UserAvatar name={user?.name || 'User'} size="sm" />
                <div className="hidden xl:block">
                  <div className="text-xs font-semibold text-slate-200 leading-tight">
                    {user?.name || 'Người dùng'}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">{user?.role || 'Annotator'}</div>
                </div>
              </button>
              <button
                onClick={logout}
                title="Đăng xuất"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modals for Settings, Profile & Users */}
      <SettingsModal isOpen={settingsModal} onClose={() => setSettingsModal(false)} />
      <ProfileModal isOpen={profileModal} onClose={() => setProfileModal(false)} />
      <UsersManagerModal isOpen={usersModal} onClose={() => setUsersModal(false)} />
    </>
  );
}
