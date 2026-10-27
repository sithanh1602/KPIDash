import React, { useEffect, useState } from 'react';
import { Check, Edit2, Plus, Search, UserCheck, Users } from 'lucide-react';
import {
  apiCreateMember,
  apiGetWeekMembers,
  apiListMembers,
  apiSetWeekMembers,
  apiUpdateMember,
  type MemberWithCount,
} from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { UserAvatar } from '../common/Avatar';
import { Modal } from '../common/Modal';
import { showToast } from '../../utils/toast';

export function MembersManager() {
  const { user } = useAuth();
  const { currentWeekId, refreshReport } = useWeek();
  const isLeader = user?.role === 'leader';
  const [directory, setDirectory] = useState<MemberWithCount[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingWeek, setSavingWeek] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit / Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithCount | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState('Annotator');
  const [activeInput, setActiveInput] = useState(true);
  const [modalBusy, setModalBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allMembers, weekMembers] = await Promise.all([
        apiListMembers(),
        currentWeekId ? apiGetWeekMembers(currentWeekId) : Promise.resolve([]),
      ]);
      setDirectory(allMembers);
      setAssignedIds(new Set(weekMembers.map((m) => m.id)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWeekId]);

  const handleOpenCreate = () => {
    setEditingMember(null);
    setNameInput('');
    setRoleInput('Annotator');
    setActiveInput(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (m: MemberWithCount) => {
    setEditingMember(m);
    setNameInput(m.name);
    setRoleInput(m.role);
    setActiveInput(m.active);
    setModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setModalBusy(true);
    try {
      if (editingMember) {
        await apiUpdateMember(editingMember.id, {
          name: nameInput.trim(),
          role: roleInput.trim(),
          active: activeInput,
        });
        showToast.success('Cập nhật thành viên thành công', `Đã lưu thông tin ${nameInput.trim()}`);
      } else {
        await apiCreateMember({ name: nameInput.trim(), role: roleInput.trim() });
        showToast.success('Thêm thành viên mới thành công', `Đã thêm ${nameInput.trim()} vào danh mục`);
      }
      await loadData();
      setModalOpen(false);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Không thể lưu thành viên', msg);
    } finally {
      setModalBusy(false);
    }
  };

  const handleToggleAssign = async (memberId: number) => {
    if (!currentWeekId) return;
    const next = new Set(assignedIds);
    const isAdding = !next.has(memberId);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);

    setAssignedIds(next);
    setSavingWeek(true);
    try {
      await apiSetWeekMembers(currentWeekId, Array.from(next));
      await refreshReport();
      showToast.info(
        isAdding ? 'Đã thêm vào tuần' : 'Đã bỏ khỏi tuần',
        'Danh sách thành viên tham gia tuần đã được cập nhật.',
      );
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Lỗi cập nhật tuần', msg);
    } finally {
      setSavingWeek(false);
    }
  };

  const filteredMembers = directory.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Danh mục thành viên</h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý hồ sơ nhân sự chung và phân bổ thành viên tham gia vào tuần báo cáo đang chọn.
          </p>
        </div>

        {isLeader && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-md shadow-emerald-500/20"
            >
              <Plus size={15} /> Thêm thành viên mới
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Directory Content */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md space-y-4">
        {/* Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative max-w-sm w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc vai trò..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#171b26] border border-[#262c3d] rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="text-xs text-slate-400">
            Đã đưa vào tuần này:{' '}
            <strong className="text-emerald-400 font-bold">{assignedIds.size}</strong> thành viên
            {savingWeek && <span className="ml-2 text-slate-500 animate-pulse">Đang cập nhật...</span>}
          </div>
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">Thành viên</th>
                <th className="py-2.5 px-3">Vai trò</th>
                <th className="py-2.5 px-3 text-center">Số tuần tham gia</th>
                <th className="py-2.5 px-3 text-center">Trạng thái</th>
                <th className="py-2.5 px-3 text-center">Tham gia tuần này</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Đang tải danh mục...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không tìm thấy thành viên nào.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const isAssigned = assignedIds.has(m.id);

                  return (
                    <tr key={m.id} className="hover:bg-[#161a24] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={m.name} size="sm" />
                          <span className="font-bold text-white text-xs">{m.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            m.role.toUpperCase() === 'QC'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-300">
                        {m.weekCount} tuần
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            m.active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          {m.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isLeader ? (
                          <button
                            onClick={() => handleToggleAssign(m.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                              isAssigned
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                                : 'bg-[#171b26] text-slate-400 border-[#262c3d] hover:border-slate-500'
                            }`}
                          >
                            {isAssigned && <Check size={13} />}
                            <span>{isAssigned ? 'Đang tham gia' : 'Thêm vào tuần'}</span>
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                              isAssigned
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-800/60 text-slate-500 border-slate-700/60'
                            }`}
                          >
                            {isAssigned && <Check size={13} />}
                            <span>{isAssigned ? 'Đang tham gia' : 'Chưa tham gia'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isLeader && (
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Sửa thông tin"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Sửa / Tạo thành viên */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMember ? 'Cập nhật thành viên' : 'Thêm thành viên mới'}
        subtitle="Họ tên và vai trò chung trong danh mục."
      >
        <form onSubmit={handleSaveMember} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Họ và tên</label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Ví dụ: Đặng Trường Huy"
              className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Vai trò trong dự án</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRoleInput('Annotator')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  roleInput === 'Annotator'
                    ? 'bg-blue-500/15 border-blue-500/60 shadow-md shadow-blue-500/10'
                    : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${roleInput === 'Annotator' ? 'text-blue-300' : 'text-slate-200'}`}>
                    Annotator
                  </span>
                  {roleInput === 'Annotator' && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Nhân sự gán nhãn dữ liệu LiDAR
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRoleInput('QC')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  roleInput === 'QC'
                    ? 'bg-purple-500/15 border-purple-500/60 shadow-md shadow-purple-500/10'
                    : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${roleInput === 'QC' ? 'text-purple-300' : 'text-slate-200'}`}>
                    QC (Kiểm tra chất lượng)
                  </span>
                  {roleInput === 'QC' && <span className="w-2 h-2 rounded-full bg-purple-400" />}
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Kiểm soát lỗi (vẫn tính KPI sản lượng)
                </div>
              </button>
            </div>
          </div>

          {editingMember && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="activeCheckbox"
                checked={activeInput}
                onChange={(e) => setActiveInput(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
              />
              <label htmlFor="activeCheckbox" className="text-xs text-slate-300 font-medium cursor-pointer">
                Đang hoạt động (cho phép phân công vào các tuần mới)
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[#232836]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={modalBusy}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {modalBusy ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
