import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  KeyRound,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { UserAvatar } from '../common/Avatar';
import {
  apiCreateUser,
  apiGetOnlineUsers,
  apiGetRedisStatus,
  apiListUsers,
  apiUpdateUser,
  type ManagedUser,
} from '../../api/client';
import type { Role } from '@shared/types';
import { showToast } from '../../utils/toast';

interface UsersManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UsersManagerModal({ isOpen, onClose }: UsersManagerModalProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [redisInfo, setRedisInfo] = useState<{
    connected: boolean;
    host?: string;
    port?: number;
    usedMemory?: string;
    maxMemory?: string;
    maxUsers?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit / Create Sub-modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<Role>('annotator');
  const [activeInput, setActiveInput] = useState(true);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, onlineData, rInfo] = await Promise.all([
        apiListUsers(),
        apiGetOnlineUsers().catch(() => ({ totalOnline: 0, maxCapacity: 10, users: [] })),
        apiGetRedisStatus().catch(() => ({ connected: false })),
      ]);
      setUsers(data);
      setOnlineUserIds(new Set(onlineData.users.map((u) => u.id)));
      setRedisInfo(rInfo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadUsers();
  }, [isOpen]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setNameInput('');
    setEmailInput('');
    setRoleInput('annotator');
    setActiveInput(true);
    setNewPasswordInput('');
    setSubError(null);
    setEditModalOpen(true);
  };

  const handleOpenEdit = (u: ManagedUser) => {
    setEditingUser(u);
    setNameInput(u.name);
    setEmailInput(u.email);
    setRoleInput(u.role);
    setActiveInput(u.active);
    setNewPasswordInput('');
    setSubError(null);
    setEditModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSaving(true);
    setSubError(null);
    try {
      if (editingUser) {
        await apiUpdateUser(editingUser.id, {
          name: nameInput.trim(),
          role: roleInput,
          active: activeInput,
          ...(newPasswordInput.trim() ? { password: newPasswordInput.trim() } : {}),
        });
        showToast.success('Cập nhật tài khoản thành công', `Đã lưu thay đổi cho ${nameInput.trim()}`);
      } else {
        if (!emailInput.trim()) throw new Error('Vui lòng nhập email đăng nhập.');
        await apiCreateUser({
          name: nameInput.trim(),
          email: emailInput.trim(),
          role: roleInput,
          ...(newPasswordInput.trim() ? { password: newPasswordInput.trim() } : {}),
        });
        showToast.success('Tạo tài khoản thành công', `Đã tạo tài khoản cho ${nameInput.trim()}`);
      }
      await loadUsers();
      setEditModalOpen(false);
    } catch (err) {
      const msg = (err as Error).message;
      setSubError(msg);
      showToast.error('Không thể lưu tài khoản', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActiveQuick = async (u: ManagedUser) => {
    try {
      await apiUpdateUser(u.id, { active: !u.active });
      await loadUsers();
      showToast.info(
        'Đã cập nhật trạng thái',
        `Tài khoản ${u.name} đã được ${!u.active ? 'kích hoạt' : 'khóa tạm thời'}.`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Không thể đổi trạng thái', msg);
    }
  };

  const roleBadge = (r: Role) => {
    if (r === 'leader') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
          Leader
        </span>
      );
    }
    if (r === 'qc') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase">
          QC
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-500/15 text-blue-300 border border-blue-500/30 uppercase">
        Annotator
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quản lý tài khoản thành viên"
      subtitle="Danh sách tài khoản đăng nhập hệ thống, phân quyền vai trò và bảo mật."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Redis Status Banner for 10 Users */}
        <div className="p-3 bg-[#131722] border border-[#232836] rounded-xl flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                redisInfo?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-white">
              Redis Cache & Presence:
            </span>
            <span className={redisInfo?.connected ? 'text-emerald-300' : 'text-slate-400'}>
              {redisInfo?.connected
                ? `Đã kết nối (${redisInfo.host}:${redisInfo.port}) · RAM ${redisInfo.usedMemory || '0M'} / ${redisInfo.maxMemory || '128M'}`
                : 'Chế độ dự phòng DB (Direct)'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 font-mono">
            <span>Online:</span>
            <span className="font-bold text-emerald-400">{onlineUserIds.size}</span>
            <span className="text-slate-500">/ {redisInfo?.maxUsers || 10} người dùng</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Tổng cộng: <span className="font-bold text-white">{users.length}</span> tài khoản
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20"
          >
            <Plus size={14} /> Thêm tài khoản
          </button>
        </div>

        {/* Users Table */}
        <div className="border border-[#232836] rounded-xl overflow-hidden bg-[#10131a]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#232836] bg-[#141824] text-[11px] text-slate-400 uppercase font-semibold">
                  <th className="py-2.5 px-3">Họ tên & Email</th>
                  <th className="py-2.5 px-3 text-center">Vai trò</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2330]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Đang tải danh sách tài khoản...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Chưa có tài khoản nào khác.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#161a24] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <UserAvatar name={u.name} size="sm" />
                            {onlineUserIds.has(u.id) && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#10131a] rounded-full"
                                title="Đang online"
                              />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                              <span>{u.name}</span>
                              {onlineUserIds.has(u.id) && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  online
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">{roleBadge(u.role)}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleActiveQuick(u)}
                          title="Nhấn để đổi trạng thái"
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                            u.active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
                          }`}
                        >
                          {u.active ? (
                            <>
                              <UserCheck size={11} /> Hoạt động
                            </>
                          ) : (
                            <>
                              <UserX size={11} /> Đã khóa
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 bg-[#171b26] hover:bg-slate-700 text-slate-300 hover:text-white border border-[#262c3d] rounded-lg transition-colors inline-flex items-center gap-1 text-[11px]"
                          title="Chỉnh sửa tài khoản"
                        >
                          <Edit2 size={13} /> Sửa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Modal Sửa / Tạo tài khoản */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={editingUser ? `Chỉnh sửa: ${editingUser.name}` : 'Tạo tài khoản mới'}
        subtitle="Cập nhật vai trò, trạng thái hoặc đổi mật khẩu mới cho thành viên."
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          {subError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{subError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Họ và tên</label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ví dụ: Lê Sĩ Thành"
              className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email đăng nhập</label>
            <input
              type="email"
              required
              disabled={Boolean(editingUser)}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@anno.local"
              className={`w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 ${
                editingUser ? 'cursor-not-allowed opacity-60' : ''
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Vai trò tài khoản (Role)</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRoleInput('leader')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  roleInput === 'leader'
                    ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                    : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-emerald-400 mb-0.5">Leader</div>
                <div className="text-[10px] text-slate-400">Toàn quyền quản trị</div>
              </button>

              <button
                type="button"
                onClick={() => setRoleInput('qc')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  roleInput === 'qc'
                    ? 'bg-purple-500/15 border-purple-500/60 shadow-md shadow-purple-500/10'
                    : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-purple-300 mb-0.5">QC</div>
                <div className="text-[10px] text-slate-400">Kiểm tra & báo cáo</div>
              </button>

              <button
                type="button"
                onClick={() => setRoleInput('annotator')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  roleInput === 'annotator'
                    ? 'bg-blue-500/15 border-blue-500/60 shadow-md shadow-blue-500/10'
                    : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-blue-300 mb-0.5">Annotator</div>
                <div className="text-[10px] text-slate-400">Gán nhãn LiDAR</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {editingUser ? 'Đổi mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu khởi tạo'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder={editingUser ? 'Nhập mật khẩu mới nếu muốn đổi...' : 'Mặc định 123456 nếu bỏ trống'}
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <KeyRound size={15} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="userActiveCheck"
              checked={activeInput}
              onChange={(e) => setActiveInput(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
            />
            <label htmlFor="userActiveCheck" className="text-xs text-slate-300 font-medium cursor-pointer">
              Cho phép tài khoản đăng nhập vào hệ thống
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#232836]">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu tài khoản'}
            </button>
          </div>
        </form>
      </Modal>
    </Modal>
  );
}
