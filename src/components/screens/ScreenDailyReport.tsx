import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  apiBackupAllDailyReports,
  apiDeleteDailyReport,
  apiGetDailyReport,
  apiGetDailyReportDates,
  apiListMembers,
  apiRestoreDailyReports,
  apiSaveDailyReport,
} from '../../api/client';
import type { DailyReportData, DailyReportMember } from '@shared/types';
import { showToast } from '../../utils/toast';

const DEFAULT_GOAL = 800;

function num(value: any, min = 0, max = 10000000): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

function pct(n: number): string {
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) + '%';
}

function viDate(iso: string): string {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || 'NV').toUpperCase();
}

function shortName(name: string): string {
  const s = (name || '').trim().split(/\s+/);
  return s.length <= 2 ? name : s.slice(-2).join(' ');
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: any): string {
  let v = String(value ?? '');
  if (/^[=+@-]/.test(v)) v = "'" + v;
  return '"' + v.replaceAll('"', '""') + '"';
}

export function ScreenDailyReport() {
  const [date, setDate] = useState<string>(todayIso());
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [data, setData] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: number; name: string }[]>([]);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // Tải danh sách thành viên mẫu từ hệ thống (nếu cần gợi ý tên)
  useEffect(() => {
    apiListMembers()
      .then((mList) => {
        setTeamMembers(mList.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name })));
      })
      .catch(() => {});
  }, []);

  // Tải danh sách các ngày đã có báo cáo
  const refreshAvailableDates = async () => {
    try {
      const dates = await apiGetDailyReportDates();
      setAvailableDates(dates);
    } catch {}
  };

  useEffect(() => {
    refreshAvailableDates();
  }, []);

  // Tải báo cáo cho ngày đang chọn
  const loadReport = async (targetDate: string) => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      const res = await apiGetDailyReport(targetDate);
      setData(res);
    } catch (err: any) {
      showToast.error('Không thể tải báo cáo ngày', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(date);
  }, [date]);

  // Chuyển ngày
  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    setDate(newDate);
  };

  const handleStepDay = (step: number) => {
    try {
      const cur = new Date(`${date}T12:00:00Z`);
      cur.setUTCDate(cur.getUTCDate() + step);
      const iso = cur.toISOString().slice(0, 10);
      setDate(iso);
    } catch {}
  };

  // Lưu báo cáo vào MySQL
  const handleSave = async (showNotification = true) => {
    if (!data) return;
    setSaving(true);
    try {
      await apiSaveDailyReport(data);
      setSaveSuccess(true);
      if (showNotification) {
        showToast.success('Đã lưu thành công', `Báo cáo ngày ${viDate(data.date)} đã được lưu vào cơ sở dữ liệu.`);
      }
      refreshAvailableDates();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      showToast.error('Lỗi khi lưu báo cáo', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Tính toán số liệu thống kê
  const stats = useMemo(() => {
    if (!data) return null;
    const members = data.members || [];
    const working = members.filter((m) => m.active);
    const off = members.filter((m) => !m.active);
    const goal = num(data.goal, 1, 1000000);
    const target = working.length * goal;
    const total = working.reduce((s, m) => s + num(m.cuboids), 0);
    const ids = working.reduce((s, m) => s + num(m.ids), 0);
    const rate = target > 0 ? (total / target) * 100 : 0;
    const achieved = working.filter((m) => m.cuboids >= goal);
    const near = working.filter((m) => m.cuboids < goal && m.cuboids >= goal * 0.8);
    const low = working.filter((m) => m.cuboids < goal * 0.8);
    const missing = Math.max(0, target - total);

    const leader = [...working].sort((a, b) => b.cuboids - a.cuboids)[0] || null;
    const lowest = [...working].sort((a, b) => a.cuboids - b.cuboids)[0] || null;

    return {
      working,
      off,
      goal,
      target,
      total,
      ids,
      rate,
      achieved,
      near,
      low,
      missing,
      leader,
      lowest,
    };
  }, [data]);

  // Phân loại xếp loại từng thành viên
  const classify = (m: DailyReportMember, goal: number) => {
    if (!m.active) return 'off';
    if (m.cuboids >= goal) return 'green';
    if (m.cuboids >= goal * 0.8) return 'gold';
    return 'red';
  };

  const statusName = (c: string) => {
    switch (c) {
      case 'green':
        return 'Đạt';
      case 'gold':
        return 'Gần đạt';
      case 'red':
        return 'Chưa đạt';
      default:
        return 'Nghỉ phép';
    }
  };

  // Danh sách dòng xếp hạng
  const sortedMembers = useMemo(() => {
    if (!data) return [];
    return [...data.members].sort((a, b) => {
      return Number(b.active) - Number(a.active) || b.cuboids - a.cuboids || a.name.localeCompare(b.name, 'vi');
    });
  }, [data]);

  // Cập nhật giá trị member
  const handleMemberChange = (key: string, field: keyof DailyReportMember, value: any) => {
    if (!data) return;
    setData((prev) => {
      if (!prev) return prev;
      const nextMembers = prev.members.map((m) => {
        if (m.key !== key) return m;
        if (field === 'active') return { ...m, active: Boolean(value) };
        if (field === 'ids' || field === 'cuboids') return { ...m, [field]: num(value) };
        return { ...m, [field]: value };
      });
      return { ...prev, members: nextMembers };
    });
  };

  // Thêm thành viên mới
  const handleAddMember = (name = 'Thành viên mới') => {
    if (!data) return;
    if (data.members.length >= 500) {
      showToast.error('Đạt giới hạn', 'Tối đa 500 thành viên trong một báo cáo');
      return;
    }
    const newKey = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newM: DailyReportMember = {
      key: newKey,
      name,
      ids: 0,
      cuboids: 0,
      active: true,
    };
    setData((prev) => (prev ? { ...prev, members: [...prev.members, newM] } : prev));
    showToast.success('Đã thêm thành viên', 'Hãy điền số ID và số cuboid');
  };

  // Đồng bộ toàn bộ thành viên từ hệ thống
  const handleSyncFromTeam = () => {
    if (!data || teamMembers.length === 0) return;
    if (
      !confirm(
        `Nạp ${teamMembers.length} thành viên đang hoạt động từ hệ thống vào ngày ${viDate(data.date)}? Các số liệu hiện tại của ngày này sẽ được đặt về 0.`,
      )
    ) {
      return;
    }
    const synced: DailyReportMember[] = teamMembers.map((m, idx) => ({
      key: `m${idx + 1}`,
      name: m.name,
      ids: 0,
      cuboids: 0,
      active: true,
    }));
    setData((prev) => (prev ? { ...prev, members: synced } : prev));
    showToast.success('Đã đồng bộ', `Đã nạp ${synced.length} thành viên từ danh mục hệ thống.`);
  };

  // Xóa thành viên
  const handleDeleteMember = (key: string, name: string) => {
    if (!confirm(`Xóa ${name} khỏi báo cáo ngày ${viDate(date)}?`)) return;
    setData((prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.key !== key) } : prev));
  };

  // Reset ngày về 0
  const handleClearDayData = () => {
    if (!confirm(`Đặt toàn bộ số ID và Cuboid của ngày ${viDate(date)} về 0? Danh sách tên nhân sự vẫn được giữ nguyên.`)) {
      return;
    }
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        note: '',
        members: prev.members.map((m) => ({ ...m, ids: 0, cuboids: 0, active: true })),
      };
    });
    showToast.info('Đã xóa số liệu', 'Toàn bộ ID và cuboid đã được đặt về 0.');
  };

  // Xuất file CSV (tương thích Excel Windows có UTF-8 BOM)
  const handleExportCSV = () => {
    if (!data || !stats) return;
    const rows: (string | number)[][] = [
      ['BÁO CÁO KPI CUBOID THEO NGÀY', data.team],
      ['Ngày', viDate(data.date)],
      ['Ca làm việc', data.session],
      ['Dự án', data.project],
      ['Mục tiêu mỗi người', stats.goal],
      [],
      ['Hạng', 'Thành viên', 'Số ID', 'Số cuboid', 'Trạng thái', 'KPI (%)', 'Chênh lệch mục tiêu'],
    ];

    let rank = 0;
    sortedMembers.forEach((m) => {
      const p = m.active ? (m.cuboids / stats.goal) * 100 : 0;
      if (m.active) rank++;
      rows.push([
        m.active ? rank : '',
        m.name,
        m.active ? m.ids : '',
        m.active ? m.cuboids : '',
        m.active ? statusName(classify(m, stats.goal)) : 'Nghỉ phép',
        m.active ? p.toFixed(1) + '%' : '',
        m.active ? (m.cuboids >= stats.goal ? `+${m.cuboids - stats.goal}` : `-${stats.goal - m.cuboids}`) : '',
      ]);
    });

    rows.push(
      [],
      ['Tổng thành viên', data.members.length],
      ['Làm việc', stats.working.length],
      ['Nghỉ phép', stats.off.length],
      ['Tổng ID', stats.ids],
      ['Tổng cuboid', stats.total],
      ['Mục tiêu nhóm', stats.target],
      ['KPI toàn nhóm (%)', stats.rate.toFixed(1) + '%'],
      ['Đạt KPI', stats.achieved.length],
      ['Gần đạt', stats.near.length],
      ['Chưa đạt', stats.low.length],
      ['Còn thiếu', stats.missing],
      ['Ghi chú', data.note],
    );

    const csvContent = '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    downloadFile(`KPI_Ngay_${data.date}_${data.team.replace(/[^a-zA-Z0-9-]/g, '_')}.csv`, csvContent, 'text/csv;charset=utf-8');
    showToast.success('Đã xuất file CSV', `File đã được tải xuống mở được trong Excel.`);
  };

  // Sao lưu JSON
  const handleBackupJSON = async () => {
    try {
      const backupData = await apiBackupAllDailyReports();
      downloadFile(
        `Sao_luu_KPI_Hang_Ngay_${todayIso()}.json`,
        JSON.stringify(backupData, null, 2),
        'application/json;charset=utf-8',
      );
      showToast.success('Đã tải file sao lưu', 'Đã lưu trữ toàn bộ dữ liệu báo cáo các ngày.');
    } catch (err: any) {
      showToast.error('Lỗi sao lưu', err.message);
    }
  };

  // Khôi phục JSON
  const handleRestoreJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.reports || typeof parsed.reports !== 'object') {
        throw new Error('Tệp không đúng định dạng sao lưu KPI ngày.');
      }
      const count = Object.keys(parsed.reports).length;
      if (!confirm(`Khôi phục ${count} ngày báo cáo từ file sao lưu? Các số liệu trùng ngày sẽ được cập nhật.`)) {
        return;
      }
      const res = await apiRestoreDailyReports(parsed.reports);
      showToast.success('Khôi phục thành công', `Đã khôi phục ${res.restoredCount} ngày báo cáo.`);
      loadReport(date);
      refreshAvailableDates();
    } catch (err: any) {
      showToast.error('Không thể khôi phục', err.message);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-24 text-center text-slate-500 text-sm">
        <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <div>Đang tải dữ liệu báo cáo ngày {viDate(date)}...</div>
      </div>
    );
  }

  if (!data || !stats) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* TOOLBAR */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-4 shadow-md no-print flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Left: Mode toggle & Date navigation */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 p-1 bg-[#171b26] border border-[#262c3d] rounded-xl">
            <button
              onClick={() => setMode('view')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'view'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ◉ Báo cáo
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'edit'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ✎ Nhập số liệu
            </button>
          </div>

          {/* Date Picker & Prev/Next */}
          <div className="flex items-center gap-1 bg-[#171b26] border border-[#262c3d] rounded-xl p-1">
            <button
              onClick={() => handleStepDay(-1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Ngày trước"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-white text-xs font-bold px-2 py-1 outline-none font-mono cursor-pointer"
            />
            <button
              onClick={() => handleStepDay(1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Ngày sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => {
              const t = todayIso();
              setDate(t);
              setMode('edit');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#171b26] hover:bg-slate-800 border border-[#262c3d] rounded-xl text-xs font-bold text-slate-300 transition-colors"
          >
            <Clock size={13} className="text-amber-400" />
            <span>Hôm nay</span>
          </button>

          {data.isExisting ? (
            <span className="text-[11px] font-medium text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1">
              <Check size={11} /> Đã có trên MySQL
            </span>
          ) : (
            <span className="text-[11px] font-medium text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1">
              ✨ Ngày mới tạo
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#171b26] hover:bg-slate-800 border border-[#262c3d] rounded-xl text-xs font-semibold text-slate-300 transition-colors"
            title="Xuất file CSV mở trên Excel"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Excel/CSV</span>
          </button>

          <button
            onClick={handleBackupJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#171b26] hover:bg-slate-800 border border-[#262c3d] rounded-xl text-xs font-semibold text-slate-300 transition-colors"
            title="Tải tệp sao lưu JSON"
          >
            <Download size={14} className="text-blue-400" />
            <span className="hidden sm:inline">Sao lưu</span>
          </button>

          <button
            onClick={() => jsonFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#171b26] hover:bg-slate-800 border border-[#262c3d] rounded-xl text-xs font-semibold text-slate-300 transition-colors"
            title="Khôi phục từ tệp JSON"
          >
            <Upload size={14} className="text-purple-400" />
            <span className="hidden sm:inline">Khôi phục</span>
          </button>
          <input
            ref={jsonFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreJSON}
            className="hidden"
          />

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#171b26] hover:bg-slate-800 border border-[#262c3d] rounded-xl text-xs font-semibold text-slate-300 transition-colors"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">In / PDF</span>
          </button>

          {/* Nút lưu vào MySQL */}
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : saveSuccess ? <Check size={13} /> : <Save size={13} />}
            <span>{saving ? 'Đang lưu...' : saveSuccess ? 'Đã lưu MySQL!' : 'Lưu dữ liệu'}</span>
          </button>
        </div>
      </div>

      {/* SETTINGS PANEL (Khi ở chế độ EDIT) */}
      {mode === 'edit' && (
        <section className="bg-[#12151d] border border-amber-500/30 rounded-2xl p-5 shadow-lg space-y-4 no-print">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#232836] pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                <span>Thiết lập & thông tin ngày {viDate(data.date)}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chỉnh sửa mục tiêu và thông tin báo cáo. Nhấn &quot;Lưu dữ liệu&quot; ở góc trên để lưu vào cơ sở dữ liệu.
              </p>
            </div>
            {teamMembers.length > 0 && (
              <button
                type="button"
                onClick={handleSyncFromTeam}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition-colors"
              >
                <UserCheck size={14} />
                <span>Nạp {teamMembers.length} thành viên từ hệ thống</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Tên nhóm
              </label>
              <input
                type="text"
                value={data.team}
                onChange={(e) => setData({ ...data, team: e.target.value })}
                className="w-full bg-[#171b26] border border-[#262c3d] rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-amber-400"
                placeholder="Team 12"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Dự án
              </label>
              <input
                type="text"
                value={data.project}
                onChange={(e) => setData({ ...data, project: e.target.value })}
                className="w-full bg-[#171b26] border border-[#262c3d] rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-amber-400"
                placeholder="3D LiDAR · Cuboid"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Mục tiêu KPI / người / buổi
              </label>
              <input
                type="number"
                min={1}
                max={1000000}
                value={data.goal}
                onChange={(e) => setData({ ...data, goal: num(e.target.value, 1, 1000000) })}
                className="w-full bg-[#171b26] border border-[#262c3d] rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Ca làm việc
              </label>
              <select
                value={data.session}
                onChange={(e) => setData({ ...data, session: e.target.value })}
                className="w-full bg-[#171b26] border border-[#262c3d] rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="Buổi sáng">Buổi sáng</option>
                <option value="Buổi chiều">Buổi chiều</option>
                <option value="Buổi tối">Buổi tối</option>
                <option value="Cả ngày">Cả ngày</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* HERO BANNER */}
      <header className="bg-gradient-to-br from-[#1a1c24] via-[#14151b] to-[#101116] border border-[#232836] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 font-black text-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              {(data.team.match(/\d+/) || ['T12'])[0] ? 'T' + (data.team.match(/\d+/) || ['12'])[0] : 'T'}
            </div>
            <div>
              <div className="text-[10px] tracking-widest font-extrabold uppercase text-slate-400 font-mono">
                AI DATA LABELING · {data.project.toUpperCase()}
              </div>
              <div className="text-sm font-extrabold text-white">{data.team}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 font-bold text-xs tracking-wider uppercase font-mono">
              KPI {fmt(stats.goal)} CUBOID / BUỔI
            </span>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono">
          BÁO CÁO KPI · {data.session.toUpperCase()} · {viDate(data.date)}
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight mt-1 mb-2">
          Báo cáo KPI sản lượng gắn nhãn
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">
          Báo cáo ngày <strong className="text-white">{viDate(data.date)}</strong> · Mức KPI{' '}
          <strong className="text-emerald-400">{fmt(stats.goal)} cuboid</strong> mỗi người cho 1 ca làm việc.
        </p>

        {/* 6 STAT CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#171a23] border border-[#262c3d] rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thành viên</div>
            <div className="text-2xl font-black text-white mt-1">{fmt(data.members.length)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {stats.working.length} làm · {stats.off.length} nghỉ
            </div>
          </div>

          <div className="bg-[#171a23] border border-[#262c3d] rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng ID</div>
            <div className="text-2xl font-black text-white mt-1">{fmt(stats.ids)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">track đã gắn</div>
          </div>

          <div className="bg-[#171a23] border border-[#262c3d] rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng cuboid</div>
            <div className="text-2xl font-black text-white mt-1">{fmt(stats.total)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">trên mục tiêu {fmt(stats.target)}</div>
          </div>

          <div className="bg-gradient-to-br from-[#2a2618] to-[#1e1b12] border border-amber-500/40 rounded-2xl p-4">
            <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">KPI toàn nhóm</div>
            <div className="text-2xl font-black text-amber-300 mt-1">{pct(stats.rate)}</div>
            <div className="text-[11px] text-amber-200/80 mt-0.5">
              {fmt(stats.total)} / {fmt(stats.target)}
            </div>
          </div>

          <div className="bg-[#171a23] border border-[#262c3d] rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đạt KPI</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {stats.achieved.length}/{stats.working.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">người đủ {fmt(stats.goal)}</div>
          </div>

          <div className="bg-[#171a23] border border-[#262c3d] rounded-2xl p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Còn thiếu</div>
            <div className="text-2xl font-black text-rose-400 mt-1">{fmt(stats.missing)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">cuboid so với KPI</div>
          </div>
        </div>
      </header>

      {/* SECTION 01: BẢNG SẢN LƯỢNG & BIỂU ĐỒ DONUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Table ranking (8 cols) */}
        <section className="lg:col-span-8 bg-[#12151d] border border-[#232836] rounded-2xl p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#232836] mb-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
                  01 · SẢN LƯỢNG THEO NGƯỜI
                </div>
                <h2 className="text-lg font-extrabold text-white">Xếp hạng sản lượng thành viên</h2>
              </div>
              <div className="text-xs text-slate-400 text-right">
                {mode === 'edit' ? (
                  <span className="text-amber-300 font-medium">Chế độ sửa số liệu</span>
                ) : (
                  <span>Vạch đứt là mốc 100% KPI</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#232836] text-[10px] uppercase font-bold text-slate-400">
                    <th className="py-2.5 px-3 w-12 text-center">Hạng</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Thành viên</th>
                    <th className="py-2.5 px-3 text-right w-24">ID</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Tiến độ</th>
                    <th className="py-2.5 px-3 text-right w-28">Cuboid</th>
                    <th className="py-2.5 px-3 text-center w-28">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2330]">
                  {sortedMembers.map((m, idx) => {
                    const c = classify(m, stats.goal);
                    const p = m.active ? (m.cuboids / stats.goal) * 100 : 0;
                    const pos = m.active ? String(idx + 1).padStart(2, '0') : '–';
                    const diff = m.active
                      ? m.cuboids >= stats.goal
                        ? `+${fmt(m.cuboids - stats.goal)}`
                        : `−${fmt(stats.goal - m.cuboids)}`
                      : '—';

                    return (
                      <tr
                        key={m.key}
                        className={`hover:bg-[#161a24] transition-colors ${
                          !m.active ? 'opacity-50 bg-[#14161f]/40' : ''
                        }`}
                      >
                        {/* Hạng */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">{pos}</td>

                        {/* Thành viên */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-700">
                              {getInitials(m.name)}
                            </span>
                            <div className="min-w-0 flex-1">
                              {mode === 'view' ? (
                                <>
                                  <div className="font-bold text-white text-xs truncate">{m.name}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {m.active ? `${fmt(m.ids)} ID` : 'Nghỉ phép có lý do'}
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={m.name}
                                    list="teamMembersList"
                                    onChange={(e) => handleMemberChange(m.key, 'name', e.target.value)}
                                    className="w-full bg-[#171b26] border border-[#262c3d] rounded-lg px-2 py-1 text-xs font-bold text-white outline-none focus:border-amber-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMember(m.key, m.name)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
                                  >
                                    <Trash2 size={10} /> Xóa dòng
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* ID */}
                        <td className="py-3 px-3 text-right">
                          {mode === 'view' ? (
                            <span className="font-mono text-slate-300 font-semibold">
                              {m.active ? `${fmt(m.ids)} ID` : '—'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              disabled={!m.active}
                              value={m.ids}
                              onChange={(e) => handleMemberChange(m.key, 'ids', e.target.value)}
                              className="w-20 bg-[#171b26] border border-[#262c3d] rounded-lg px-2 py-1 text-xs font-bold text-right text-slate-200 outline-none focus:border-amber-400 disabled:opacity-40"
                            />
                          )}
                        </td>

                        {/* Tiến độ (Bar) */}
                        <td className="py-3 px-3">
                          <div className="w-full bg-slate-800/50 h-2.5 rounded-full overflow-hidden p-0.5 relative border border-slate-700/50">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                c === 'green'
                                  ? 'bg-emerald-500'
                                  : c === 'gold'
                                  ? 'bg-amber-400'
                                  : c === 'red'
                                  ? 'bg-rose-400'
                                  : 'bg-slate-700'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, p))}%` }}
                            />
                          </div>
                        </td>

                        {/* Cuboid */}
                        <td className="py-3 px-3 text-right">
                          {mode === 'view' ? (
                            <div>
                              <div className="font-bold text-white text-xs font-mono">
                                {m.active ? fmt(m.cuboids) : '—'}
                              </div>
                              <div
                                className={`text-[10px] font-semibold ${
                                  m.cuboids >= stats.goal ? 'text-emerald-400' : 'text-slate-500'
                                }`}
                              >
                                {diff}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <input
                                type="number"
                                min={0}
                                disabled={!m.active}
                                value={m.cuboids}
                                onChange={(e) => handleMemberChange(m.key, 'cuboids', e.target.value)}
                                className="w-24 bg-[#171b26] border border-[#262c3d] rounded-lg px-2 py-1 text-xs font-bold text-right text-emerald-400 outline-none focus:border-amber-400 disabled:opacity-40"
                              />
                              <div className="text-[10px] text-slate-400 text-right font-mono">{pct(p)}</div>
                            </div>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3 px-3 text-center">
                          {mode === 'view' ? (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block border ${
                                c === 'green'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : c === 'gold'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : c === 'red'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {statusName(c)}
                            </span>
                          ) : (
                            <select
                              value={m.active ? 'true' : 'false'}
                              onChange={(e) => handleMemberChange(m.key, 'active', e.target.value === 'true')}
                              className="bg-[#171b26] border border-[#262c3d] rounded-lg px-2 py-1 text-xs font-semibold text-white outline-none focus:border-amber-400 cursor-pointer"
                            >
                              <option value="true">Đi làm</option>
                              <option value="false">Nghỉ phép</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Datalist gợi ý tên thành viên */}
          <datalist id="teamMembersList">
            {teamMembers.map((tm) => (
              <option key={tm.id} value={tm.name} />
            ))}
          </datalist>

          {/* Edit Footer Buttons */}
          {mode === 'edit' && (
            <div className="mt-4 pt-4 border-t border-[#232836] flex flex-wrap items-center justify-between gap-3 no-print">
              <button
                type="button"
                onClick={() => handleAddMember('Thành viên mới')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-colors"
              >
                <Plus size={14} /> Thêm thành viên
              </button>
              <button
                type="button"
                onClick={handleClearDayData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors"
              >
                <RotateCcw size={13} /> Xóa số liệu ngày này (về 0)
              </button>
            </div>
          )}
        </section>

        {/* Right: Donut Chart & Legend (4 cols) */}
        <section className="lg:col-span-4 bg-[#12151d] border border-[#232836] rounded-2xl p-5 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-[#232836] mb-6">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
                KPI TOÀN NHÓM
              </div>
              <h2 className="text-lg font-extrabold text-white">Tỷ lệ hoàn thành mục tiêu</h2>
              <div className="text-xs text-slate-400 mt-1">Đạt ≥100% · Gần đạt 80–99% · Chưa đạt &lt;80%</div>
            </div>

            {/* Donut Chart */}
            <div className="flex items-center justify-center py-6">
              <div
                className="w-52 h-52 rounded-full flex items-center justify-center relative shadow-xl"
                style={{
                  background: `conic-gradient(#10b981 0 ${Math.min(100, Math.max(0, stats.rate))}%, #1e2330 ${Math.min(
                    100,
                    Math.max(0, stats.rate),
                  )}% 100%)`,
                }}
              >
                <div className="w-36 h-36 rounded-full bg-[#12151d] border border-[#262c3d] flex flex-col items-center justify-center text-center p-2 shadow-inner">
                  <div className="text-3xl font-black text-white tracking-tight">{pct(stats.rate)}</div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">so với KPI nhóm</div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend Boxes */}
          <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-[#232836]">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
              <b className="block text-xl font-black text-emerald-400 leading-none">{stats.achieved.length}</b>
              <span className="block mt-1.5 text-[11px] font-bold text-emerald-300">Đạt</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
              <b className="block text-xl font-black text-amber-400 leading-none">{stats.near.length}</b>
              <span className="block mt-1.5 text-[11px] font-bold text-amber-300">Gần đạt</span>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-center">
              <b className="block text-xl font-black text-rose-400 leading-none">{stats.low.length}</b>
              <span className="block mt-1.5 text-[11px] font-bold text-rose-300">Chưa đạt</span>
            </div>
          </div>
        </section>
      </div>

      {/* SECTION ★: ĐIỂM NỔI BẬT */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono text-amber-400">★</span>
          <h2 className="text-base font-extrabold text-white uppercase tracking-wider">Điểm nổi bật</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Sản lượng cao nhất */}
          <div className="bg-[#12151d] border-t-4 border-emerald-500 border border-[#232836] rounded-2xl p-5 shadow-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Sản lượng cao nhất
            </div>
            <div className="text-3xl font-black text-white mt-1">
              {stats.leader ? fmt(stats.leader.cuboids) : '—'}{' '}
              <span className="text-xs font-normal text-slate-400">cuboid</span>
            </div>
            <strong className="block text-sm font-bold text-emerald-300 mt-2 truncate">
              {stats.leader ? stats.leader.name : 'Chưa có dữ liệu'}
            </strong>
            <div className="text-xs text-slate-400 mt-0.5">
              {stats.leader
                ? `${fmt(stats.leader.ids)} ID · đạt ${pct((stats.leader.cuboids / stats.goal) * 100)} KPI`
                : 'Chưa có thành viên làm việc'}
            </div>
          </div>

          {/* Card 2: Sát KPI */}
          <div className="bg-[#12151d] border-t-4 border-purple-500 border border-[#232836] rounded-2xl p-5 shadow-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Sát KPI</div>
            <div className="text-3xl font-black text-white mt-1">
              {stats.near.length} <span className="text-xs font-normal text-slate-400">người</span>
            </div>
            <strong className="block text-sm font-bold text-purple-300 mt-2 truncate">
              {stats.near.length ? stats.near.map((x) => shortName(x.name)).join(', ') : 'Không có thành viên sát KPI'}
            </strong>
            <div className="text-xs text-slate-400 mt-0.5">Đạt từ 80% đến dưới 100% KPI</div>
          </div>

          {/* Card 3: Cần theo dõi */}
          <div className="bg-[#12151d] border-t-4 border-rose-500 border border-[#232836] rounded-2xl p-5 shadow-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Cần theo dõi</div>
            <div className="text-3xl font-black text-rose-400 mt-1">
              {stats.lowest ? pct((stats.lowest.cuboids / stats.goal) * 100) : '—'}
            </div>
            <strong className="block text-sm font-bold text-rose-300 mt-2 truncate">
              {stats.lowest ? stats.lowest.name : 'Chưa có dữ liệu'}
            </strong>
            <div className="text-xs text-slate-400 mt-0.5">
              {stats.lowest
                ? `${fmt(stats.lowest.cuboids)} cuboid · ${
                    stats.lowest.cuboids < stats.goal
                      ? `thiếu ${fmt(stats.goal - stats.lowest.cuboids)} so với KPI`
                      : `vượt ${fmt(stats.lowest.cuboids - stats.goal)} so với KPI`
                  }`
                : 'Chưa có thành viên'}
            </div>
          </div>

          {/* Card 4: Nghỉ phép */}
          <div className="bg-[#12151d] border-t-4 border-slate-500 border border-[#232836] rounded-2xl p-5 shadow-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Nghỉ phép</div>
            <div className="text-3xl font-black text-slate-300 mt-1">
              {stats.off.length} <span className="text-xs font-normal text-slate-400">người</span>
            </div>
            <strong className="block text-sm font-bold text-slate-300 mt-2 truncate">
              {stats.off.length ? stats.off.map((m) => m.name).join(', ') : 'Không ai nghỉ phép'}
            </strong>
            <div className="text-xs text-slate-400 mt-0.5">
              {stats.off.length ? 'Nghỉ có phép · Không tính KPI' : 'Tất cả đều đi làm'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: GHI CHÚ SỐ LIỆU */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-5 sm:p-6 shadow-md space-y-3">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
          GHI CHÚ SỐ LIỆU
        </div>

        <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
          <li>
            Tỷ lệ KPI = số cuboid hoàn thành / ({fmt(stats.goal)} × {stats.working.length} người làm việc ={' '}
            {fmt(stats.target)} cuboid).
          </li>
          <li>
            Mục tiêu toàn nhóm được tính theo số người đi làm; {stats.off.length} người nghỉ phép không tính vào KPI.
          </li>
          <li>Ngưỡng xếp loại: Đạt ≥100%, Gần đạt 80–99,9%, Chưa đạt &lt;80%. Số liệu được lưu trữ độc lập theo ngày.</li>
        </ul>

        {mode === 'edit' ? (
          <div className="pt-3 border-t border-[#232836]">
            <label className="block text-xs font-bold text-amber-300 mb-1">
              Ghi chú thêm cho ngày {viDate(data.date)}:
            </label>
            <textarea
              rows={3}
              value={data.note}
              onChange={(e) => setData({ ...data, note: e.target.value })}
              placeholder="Ví dụ: Có thay đổi phân công; gặp sự cố dữ liệu camera/LiDAR; lưu ý chất lượng..."
              className="w-full bg-[#171b26] border border-[#262c3d] rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-amber-400 resize-y"
            />
          </div>
        ) : data.note ? (
          <div className="pt-3 border-t border-[#232836] text-xs text-amber-200/90 bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
            <strong>Ghi chú thêm:</strong> {data.note}
          </div>
        ) : null}
      </section>

      {/* FOOTER */}
      <footer className="text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 pb-6 border-t border-[#1e2330]">
        <span>
          Báo cáo KPI gắn nhãn {data.project} · {data.session.toLowerCase()} · ngày {viDate(data.date)}
        </span>
        <span className="font-bold text-slate-400">{data.team}</span>
      </footer>
    </div>
  );
}
