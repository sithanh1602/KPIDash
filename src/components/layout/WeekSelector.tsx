import React, { useState } from 'react';
import { CalendarDays, ChevronDown, Edit3, Plus, Settings2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { addDays, getIsoWeekNumber, getMonday, weekRangeLabel } from '@shared/format';
import { Modal } from '../common/Modal';
import { apiCreateWeek, apiDeleteWeek, apiUpdateWeek } from '../../api/client';
import { showToast } from '../../utils/toast';

export function WeekSelector() {
  const { user } = useAuth();
  const { weeks, currentWeekId, setCurrentWeekId, refreshWeeks, report, refreshReport } = useWeek();

  // Create Week state
  const [createWeekModal, setCreateWeekModal] = useState(false);
  const [newWeekNumber, setNewWeekNumber] = useState<number>(() => {
    return getIsoWeekNumber(new Date().toISOString().slice(0, 10));
  });
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newProjectTag, setNewProjectTag] = useState('VF-ADAS-2026');
  const [newTarget, setNewTarget] = useState(1000);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // Edit Week state
  const [editWeekModal, setEditWeekModal] = useState(false);
  const [editWeekNumber, setEditWeekNumber] = useState(1);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editProjectTag, setEditProjectTag] = useState('VF-ADAS-2026');
  const [editTarget, setEditTarget] = useState(1000);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErr, setEditErr] = useState('');

  // Delete Week state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  const currentWeek = weeks.find((w) => w.id === currentWeekId);
  const isLeader = user?.role === 'leader';

  const handleStartDateChange = (val: string) => {
    if (!val) {
      setNewStartDate('');
      setNewEndDate('');
      return;
    }
    const monday = getMonday(val);
    setNewStartDate(monday);
    setNewEndDate(addDays(monday, 5));
    setNewWeekNumber(getIsoWeekNumber(monday));
  };

  const handleEditStartDateChange = (val: string) => {
    if (!val) {
      setEditStartDate('');
      setEditEndDate('');
      return;
    }
    const monday = getMonday(val);
    setEditStartDate(monday);
    setEditEndDate(addDays(monday, 5));
    setEditWeekNumber(getIsoWeekNumber(monday));
  };

  const openEditModal = () => {
    if (!currentWeek) return;
    setEditWeekNumber(currentWeek.weekNumber);
    setEditStartDate(currentWeek.startDate);
    setEditEndDate(currentWeek.endDate);
    setEditProjectTag(report?.week.projectTag || currentWeek.projectTag || 'VF-ADAS-2026');
    setEditTarget(report?.week.target || 1000);
    setEditErr('');
    setEditWeekModal(true);
  };

  const handleSaveEditWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWeekId || !editStartDate || !editEndDate || !editWeekNumber) return;
    setSavingEdit(true);
    setEditErr('');
    try {
      await apiUpdateWeek(currentWeekId, {
        weekNumber: Number(editWeekNumber),
        startDate: editStartDate,
        endDate: editEndDate,
        projectTag: editProjectTag.trim(),
        target: Number(editTarget),
      });
      await refreshWeeks();
      await refreshReport();
      setEditWeekModal(false);
      showToast.success('Cập nhật tuần thành công', `Đã cập nhật Tuần ${editWeekNumber} (${weekRangeLabel(editStartDate, editEndDate)})`);
    } catch (err) {
      const msg = (err as Error).message;
      setEditErr(msg);
      showToast.error('Không thể cập nhật tuần', msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartDate || !newEndDate || !newWeekNumber) return;
    setCreating(true);
    setCreateErr('');
    try {
      const created = await apiCreateWeek({
        weekNumber: Number(newWeekNumber),
        startDate: newStartDate,
        endDate: newEndDate,
        projectTag: newProjectTag.trim(),
        target: Number(newTarget),
      });
      await refreshWeeks();
      setCurrentWeekId(created.id);
      setCreateWeekModal(false);
      setNewStartDate('');
      setNewEndDate('');
      showToast.success('Tạo tuần thành công', `Đã tạo Tuần ${created.weekNumber} (${weekRangeLabel(created.startDate, created.endDate)})`);
    } catch (err) {
      const msg = (err as Error).message;
      setCreateErr(msg);
      showToast.error('Không thể tạo tuần', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWeek = async () => {
    if (!currentWeekId) return;
    setDeleting(true);
    setDeleteErr('');
    try {
      await apiDeleteWeek(currentWeekId);
      await refreshWeeks();
      setDeleteConfirmModal(false);
      showToast.success('Xóa tuần thành công', 'Tuần báo cáo đã được xóa.');
    } catch (err) {
      const msg = (err as Error).message;
      setDeleteErr(msg);
      showToast.error('Không thể xóa tuần', msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Dropdown danh sách tuần */}
        <div className="relative flex items-center bg-[#151922] border border-[#232836] rounded-xl px-2.5 py-1 hover:border-slate-600 transition-colors shadow-sm">
          <CalendarDays size={14} className="text-emerald-400 mr-2 shrink-0" />
          <div className="flex flex-col text-left mr-1">
            <span className="text-[9px] text-slate-400 leading-none font-semibold uppercase tracking-wider">
              Tuần báo cáo
            </span>
            <select
              aria-label="Chọn tuần báo cáo"
              value={currentWeekId ?? ''}
              onChange={(e) => setCurrentWeekId(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer pr-4 appearance-none"
            >
              {weeks.length === 0 ? (
                <option value="" disabled className="bg-[#151922] text-slate-400">
                  Chưa có tuần nào
                </option>
              ) : (
                weeks.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#151922] text-slate-200">
                    Tuần {w.weekNumber} ({weekRangeLabel(w.startDate, w.endDate)})
                  </option>
                ))
              )}
            </select>
          </div>
          <ChevronDown size={13} className="text-slate-400 pointer-events-none" />
        </div>

        {/* Nút thêm tuần mới (Chỉ Leader) */}
        {isLeader && (
          <button
            onClick={() => setCreateWeekModal(true)}
            title="Tạo tuần mới"
            className="p-1.5 bg-[#151922] hover:bg-slate-800 text-slate-300 hover:text-white border border-[#232836] rounded-xl transition-colors"
          >
            <Plus size={15} />
          </button>
        )}

        {/* Nút sửa tuần (chỉ Leader) */}
        {isLeader && currentWeek && (
          <button
            onClick={openEditModal}
            title="Chỉnh sửa thông tin tuần hiện tại (lịch, mốc KPI, tag dự án)"
            className="p-1.5 bg-[#151922] hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-[#232836] hover:border-emerald-500/40 rounded-xl transition-colors"
          >
            <Edit3 size={15} />
          </button>
        )}

        {/* Nút xóa tuần (chỉ Leader) */}
        {isLeader && currentWeek && (
          <button
            onClick={() => setDeleteConfirmModal(true)}
            title="Xóa tuần hiện tại"
            className="p-1.5 bg-[#151922] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-[#232836] hover:border-rose-500/40 rounded-xl transition-colors"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Modal Tạo tuần mới */}
      <Modal
        isOpen={createWeekModal}
        onClose={() => setCreateWeekModal(false)}
        title="Tạo tuần báo cáo mới"
        subtitle="Chọn ngày bất kỳ trong tuần, hệ thống sẽ tự động căn chuẩn từ Thứ Hai đến Thứ Bảy."
      >
        <form onSubmit={handleCreateWeek} className="space-y-4">
          {createErr && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {createErr}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Số thứ tự tuần (Ví dụ: 43)
              </label>
              <input
                type="number"
                min="1"
                max="53"
                required
                value={newWeekNumber}
                onChange={(e) => setNewWeekNumber(Number(e.target.value))}
                placeholder="43"
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tag Dự án (Project Tag)
              </label>
              <input
                type="text"
                required
                value={newProjectTag}
                onChange={(e) => setNewProjectTag(e.target.value)}
                placeholder="VD: VF-ADAS-2026"
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mốc KPI ngày (Mặc định: 1.000 cuboid)
            </label>
            <input
              type="number"
              min="100"
              max="10000"
              required
              value={newTarget}
              onChange={(e) => setNewTarget(Number(e.target.value))}
              className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ngày bắt đầu (Tự động căn về Thứ Hai)
              </label>
              <input
                type="date"
                required
                value={newStartDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ngày kết thúc (Thứ Bảy)
              </label>
              <input
                type="date"
                required
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {newStartDate && newEndDate && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 space-y-1">
              <div>
                <span className="font-semibold">Xem trước lịch: </span>
                Tuần {newWeekNumber} ({weekRangeLabel(newStartDate, newEndDate)})
              </div>
              <div className="text-[11px] text-emerald-400/80">
                Tag Dự án: <strong className="font-mono">{newProjectTag}</strong> · Mốc KPI: <strong>{newTarget} cuboid/ngày</strong>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateWeekModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={creating || !newStartDate || !newEndDate || !newWeekNumber}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {creating ? 'Đang tạo...' : 'Tạo tuần'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Chỉnh sửa thông tin tuần */}
      <Modal
        isOpen={editWeekModal}
        onClose={() => setEditWeekModal(false)}
        title="Chỉnh sửa thông tin tuần báo cáo"
        subtitle="Cập nhật lại lịch gốc (Thứ Hai đến Thứ Bảy), Tag dự án và Mốc KPI cho tuần."
      >
        <form onSubmit={handleSaveEditWeek} className="space-y-4">
          {editErr && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {editErr}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Số thứ tự tuần
              </label>
              <input
                type="number"
                min="1"
                max="53"
                required
                value={editWeekNumber}
                onChange={(e) => setEditWeekNumber(Number(e.target.value))}
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tag Dự án (Project Tag)
              </label>
              <input
                type="text"
                required
                value={editProjectTag}
                onChange={(e) => setEditProjectTag(e.target.value)}
                placeholder="VD: VF-ADAS-2026"
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mốc KPI ngày (Mặc định: 1.000 cuboid)
            </label>
            <input
              type="number"
              min="100"
              max="10000"
              required
              value={editTarget}
              onChange={(e) => setEditTarget(Number(e.target.value))}
              className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ngày bắt đầu (Thứ Hai chuẩn)
              </label>
              <input
                type="date"
                required
                value={editStartDate}
                onChange={(e) => handleEditStartDateChange(e.target.value)}
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ngày kết thúc (Thứ Bảy chuẩn)
              </label>
              <input
                type="date"
                required
                value={editEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {editStartDate && editEndDate && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 space-y-1">
              <div>
                <span className="font-semibold">Lịch sau cập nhật: </span>
                Tuần {editWeekNumber} ({weekRangeLabel(editStartDate, editEndDate)})
              </div>
              <div className="text-[11px] text-blue-400/80">
                Tag Dự án: <strong className="font-mono">{editProjectTag}</strong> · Mốc KPI: <strong>{editTarget} cuboid/ngày</strong>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#232836]">
            <button
              type="button"
              onClick={() => setEditWeekModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingEdit || !editStartDate || !editEndDate || !editWeekNumber}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Xác nhận Xóa tuần */}
      <Modal
        isOpen={deleteConfirmModal}
        onClose={() => setDeleteConfirmModal(false)}
        title="Xác nhận xóa tuần báo cáo"
        subtitle="Hành động này chỉ Leader mới có quyền thực hiện."
      >
        <div className="space-y-4">
          {deleteErr && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {deleteErr}
            </div>
          )}
          <p className="text-xs text-slate-300 leading-relaxed">
            Bạn có chắc chắn muốn xóa{' '}
            <strong className="text-white">
              Tuần {currentWeek?.weekNumber} ({currentWeek && weekRangeLabel(currentWeek.startDate, currentWeek.endDate)})
            </strong>
            ? Toàn bộ số liệu sản lượng, QA, ý thức và coaching của tuần này sẽ bị xóa vĩnh viễn.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#232836]">
            <button
              type="button"
              onClick={() => setDeleteConfirmModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleDeleteWeek}
              disabled={deleting}
              className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 shadow-md shadow-rose-500/20"
            >
              {deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}