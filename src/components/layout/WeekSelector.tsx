import React, { useState } from 'react';
import { CalendarDays, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { addDays, getIsoWeekNumber, weekRangeLabel } from '@shared/format';
import { Modal } from '../common/Modal';
import { apiCreateWeek, apiDeleteWeek } from '../../api/client';
import { showToast } from '../../utils/toast';

export function WeekSelector() {
  const { user } = useAuth();
  const { weeks, currentWeekId, setCurrentWeekId, refreshWeeks } = useWeek();

  // Create Week state
  const [createWeekModal, setCreateWeekModal] = useState(false);
  const [newWeekNumber, setNewWeekNumber] = useState<number>(() => {
    return getIsoWeekNumber(new Date().toISOString().slice(0, 10));
  });
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // Delete Week state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  const currentWeek = weeks.find((w) => w.id === currentWeekId);
  const isLeader = user?.role === 'leader';

  const handleStartDateChange = (val: string) => {
    setNewStartDate(val);
    if (val) {
      setNewEndDate(addDays(val, 5));
      setNewWeekNumber(getIsoWeekNumber(val));
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
      showToast.success('Đã xóa tuần báo cáo', 'Toàn bộ dữ liệu tuần đã được dọn sạch.');
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
        subtitle="Chọn ngày bắt đầu (Thứ Hai), hệ thống sẽ tự động điền ngày kết thúc (Thứ Bảy)."
      >
        <form onSubmit={handleCreateWeek} className="space-y-4">
          {createErr && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {createErr}
            </div>
          )}

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
              placeholder="Nhập số tuần (ví dụ: 43)"
              className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ngày bắt đầu (Thứ Hai)
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
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
              <span className="font-semibold">Xem trước hiển thị: </span>
              Tuần {newWeekNumber} ({weekRangeLabel(newStartDate, newEndDate)})
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
