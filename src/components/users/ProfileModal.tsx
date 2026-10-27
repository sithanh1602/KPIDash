import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Key, Lock, User, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { apiChangeMyPassword, apiUpdateMyProfile } from '../../api/client';
import { showToast } from '../../utils/toast';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');

  // Info state
  const [name, setName] = useState(user?.name || '');
  const [updatingInfo, setUpdatingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passMsg, setPassMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setUpdatingInfo(true);
    setInfoMsg(null);
    try {
      await apiUpdateMyProfile({ name: name.trim() });
      if (refreshUser) await refreshUser();
      setInfoMsg({ text: 'Cập nhật họ tên thành công!', ok: true });
      showToast.success('Cập nhật hồ sơ thành công', 'Họ tên hiển thị đã được cập nhật.');
    } catch (err) {
      const msg = (err as Error).message;
      setInfoMsg({ text: msg, ok: false });
      showToast.error('Không thể cập nhật hồ sơ', msg);
    } finally {
      setUpdatingInfo(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 6) {
      setPassMsg({ text: 'Mật khẩu mới phải có ít nhất 6 ký tự.', ok: false });
      showToast.warning('Mật khẩu không hợp lệ', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ text: 'Xác nhận mật khẩu mới không khớp.', ok: false });
      showToast.warning('Mật khẩu không khớp', 'Xác nhận mật khẩu mới không khớp.');
      return;
    }
    setUpdatingPassword(true);
    setPassMsg(null);
    try {
      await apiChangeMyPassword({ currentPassword, newPassword });
      setPassMsg({ text: 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.', ok: true });
      showToast.success('Đổi mật khẩu thành công', 'Mật khẩu của bạn đã được cập nhật.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = (err as Error).message;
      setPassMsg({ text: msg, ok: false });
      showToast.error('Đổi mật khẩu thất bại', msg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hồ sơ tài khoản cá nhân"
      subtitle="Quản lý thông tin đăng nhập và bảo mật tài khoản của bạn."
    >
      <div className="space-y-4">
        {/* Sub tabs */}
        <div className="flex border-b border-[#232836]">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User size={14} /> Thông tin cá nhân
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'password'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock size={14} /> Đổi mật khẩu
          </button>
        </div>

        {activeTab === 'info' ? (
          <form onSubmit={handleUpdateInfo} className="space-y-4 pt-1">
            {infoMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  infoMsg.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {infoMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{infoMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email đăng nhập</label>
              <input
                type="text"
                disabled
                value={user?.email || ''}
                className="w-full bg-[#151922] border border-[#232836] rounded-xl px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Email là định danh tài khoản cố định.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Vai trò hệ thống</label>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase flex items-center gap-1.5">
                  <Shield size={13} /> {user?.role || 'Leader'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Họ và tên hiển thị</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập họ và tên..."
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#232836]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={updatingInfo}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {updatingInfo ? 'Đang lưu...' : 'Lưu họ tên'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
            {passMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  passMsg.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {passMsg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{passMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mật khẩu hiện tại</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu bạn đang dùng..."
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mật khẩu mới</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự..."
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#232836]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={updatingPassword}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {updatingPassword ? 'Đang đổi...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
