import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  FileSpreadsheet,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { apiDownloadTemplate, apiLoadSheet, apiSaveSheet, getTemplateUrl } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { SHEET_ORDER, SHEETS, type SheetKey, type ColumnDef } from '@shared/sheets';
import type { SheetRow } from '@shared/types';
import { ImportModal } from './ImportModal';
import { showToast } from '../../utils/toast';

export function WebExcelGrid() {
  const { user } = useAuth();
  const { currentWeekId, selectedSheetKey, setSelectedSheetKey, refreshReport, report } = useWeek();
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const isLeader = user?.role === 'leader';
  const isQc = user?.role === 'qc';
  const userMemberId = user?.memberId;

  // Phân quyền trên bảng hiện tại:
  const canEditCurrentSheet =
    isLeader ||
    (isQc && selectedSheetKey !== 'attitude') ||
    (selectedSheetKey === 'production' || selectedSheetKey === 'issues');

  const canImportCurrentSheet =
    isLeader ||
    (isQc && selectedSheetKey !== 'attitude' && selectedSheetKey !== 'production');

  const isRowEditable = (row: SheetRow) => {
    if (isLeader) return true;
    if (selectedSheetKey === 'attitude') return false;
    if (['qa', 'manual_qa', 'coaching', 'tracks', 'actions'].includes(selectedSheetKey)) {
      return isQc;
    }
    if (selectedSheetKey === 'issues') return true;
    if (selectedSheetKey === 'production') {
      return !!userMemberId && row.memberId === userMemberId;
    }
    return false;
  };

  const canModifyFreeRows = isLeader || isQc || selectedSheetKey === 'issues';

  const handleDownloadTemplate = async () => {
    if (!currentWeekId) return;
    setDownloadingTemplate(true);
    try {
      await apiDownloadTemplate(currentWeekId, selectedSheetKey, 'xlsx');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const currentDef = SHEETS[selectedSheetKey];

  const activeColumns: ColumnDef[] = React.useMemo(() => {
    if (selectedSheetKey === 'production' && report?.dayLabels) {
      const nonDayBefore = currentDef.columns.filter((c) => c.type !== 'cell' && c.key !== 'todayNote');
      const dayCols: ColumnDef[] = report.dayLabels.map((lbl, idx) => ({
        key: `d${idx}`,
        header: lbl,
        type: 'cell' as const,
        width: 95,
        hint: `Số cuboid hoàn thành ngày ${lbl}.`,
      }));
      const nonDayAfter = currentDef.columns.filter((c) => c.key === 'todayNote');
      return [...nonDayBefore, ...dayCols, ...nonDayAfter];
    }
    return currentDef.columns;
  }, [selectedSheetKey, currentDef, report?.dayLabels]);

  const loadData = async (sheetKey: SheetKey) => {
    if (!currentWeekId) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const data = await apiLoadSheet(currentWeekId, sheetKey);
      setRows(data.rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedSheetKey);
  }, [currentWeekId, selectedSheetKey]);

  const handleCellChange = (rowIndex: number, columnKey: string, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIndex ? { ...r, values: { ...r.values, [columnKey]: value } } : r)),
    );
  };

  const handleAddRow = () => {
    if (currentDef.scope !== 'free') return;
    const emptyValues: Record<string, string> = {};
    currentDef.columns.forEach((c) => {
      emptyValues[c.key] = '';
    });

    // Tự động sinh ID và giá trị mặc định cho tab Issue (ISS-01, ISS-02...)
    if (selectedSheetKey === 'issues') {
      let maxNum = 0;
      rows.forEach((r) => {
        const code = r.values?.code || '';
        const match = code.match(/ISS[^\d]*(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const nextId = `ISS-${String(maxNum + 1).padStart(2, '0')}`;
      emptyValues.code = nextId;
      emptyValues.reporter = user?.name || '';
      emptyValues.status = 'Chờ chốt';
      emptyValues.priority = 'TB';
    }

    setRows((prev) => [...prev, { memberId: null, values: emptyValues }]);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (currentDef.scope !== 'free') return;
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const handleSave = async () => {
    if (!currentWeekId) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiSaveSheet(currentWeekId, selectedSheetKey, rows);
      setSuccess(true);
      showToast.success('Lưu dữ liệu thành công', `Đã lưu bảng "${currentDef.label}" (${rows.length} dòng)`);
      await refreshReport();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Không thể lưu bảng', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleImportSuccess = (importedRows: SheetRow[]) => {
    if (currentDef.scope === 'member') {
      // Merge by memberId
      const map = new Map(importedRows.map((r) => [r.memberId, r]));
      setRows((prev) =>
        prev.map((r) => {
          const match = map.get(r.memberId);
          return match ? { ...r, values: { ...r.values, ...match.values } } : r;
        }),
      );
    } else {
      setRows(importedRows);
    }
    setSuccess(true);
    showToast.success('Import dữ liệu thành công', `Đã nạp ${importedRows.length} dòng vào bảng "${currentDef.label}"`);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Sub-navigation between sheets */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {SHEET_ORDER.map((key) => {
              const def = SHEETS[key];
              const isActive = selectedSheetKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSheetKey(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-[#171b26]'
                  }`}
                >
                  {def.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Tải mẫu .xlsx */}
            {currentWeekId && (
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171b26] hover:bg-slate-800 text-slate-300 border border-[#262c3d] rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                title="Tải file mẫu Excel"
              >
                <Download size={13} className={downloadingTemplate ? 'animate-bounce' : ''} />
                <span className="hidden sm:inline">{downloadingTemplate ? 'Đang tải...' : 'Mẫu Excel'}</span>
              </button>
            )}

            {/* Import file */}
            {canImportCurrentSheet && (
              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171b26] hover:bg-slate-800 text-slate-300 border border-[#262c3d] rounded-xl text-xs font-medium transition-colors"
              >
                <Upload size={13} />
                <span className="hidden sm:inline">Import file</span>
              </button>
            )}

            {/* Lưu */}
            {canEditCurrentSheet ? (
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50 shadow-md shadow-emerald-500/20"
              >
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                <span>
                  {saving
                    ? 'Đang lưu...'
                    : selectedSheetKey === 'production' && !isLeader
                    ? 'Lưu sản lượng của tôi'
                    : 'Lưu bảng'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171b26] text-slate-400 border border-[#262c3d] rounded-xl text-xs font-medium">
                <Lock size={13} />
                <span>Chỉ xem ({user?.role.toUpperCase()})</span>
              </div>
            )}
          </div>
        </div>

        {/* Description & Notice */}
        <div className="mt-3 pt-3 border-t border-[#232836] flex items-center justify-between text-xs text-slate-400">
          <div>
            <strong className="text-white">{currentDef.label}:</strong> {currentDef.description}
          </div>
          {currentDef.scope === 'free' && canModifyFreeRows && (
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <Plus size={14} /> Thêm dòng mới
            </button>
          )}
        </div>
      </div>

      {/* Role Notice Banners */}
      {selectedSheetKey === 'production' && !isLeader && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center gap-2">
          <User size={15} className="shrink-0 text-blue-400" />
          <span>
            <strong>Chế độ cá nhân ({user?.role.toUpperCase()}):</strong> Bạn chỉ có quyền nhập và lưu ô sản lượng tại dòng tên của chính mình (được viền sáng). Các dòng của thành viên khác được khóa để bảo vệ dữ liệu.
          </span>
        </div>
      )}
      {!canEditCurrentSheet && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
          <Lock size={15} className="shrink-0 text-amber-400" />
          <span>
            <strong>Chế độ chỉ xem:</strong> Bảng <strong>{currentDef.label}</strong> chỉ dành cho {selectedSheetKey === 'attitude' ? 'Leader' : 'Leader & QC'} chỉnh sửa. Tài khoản vai trò {user?.role.toUpperCase()} không có quyền sửa bảng này.
          </span>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <Check size={15} />
          <span>Đã lưu thành công vào MySQL! Báo cáo đã được cập nhật.</span>
        </div>
      )}

      {/* Web Excel Grid Table */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl shadow-md overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">Đang tải dữ liệu bảng...</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            Bảng chưa có dữ liệu.{' '}
            {currentDef.scope === 'free' ? (
              <button onClick={handleAddRow} className="text-emerald-400 underline font-semibold ml-1">
                Nhấn vào đây để thêm dòng mới
              </button>
            ) : (
              'Hãy thêm thành viên vào tuần trước khi nhập liệu.'
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#161a24] z-20 border-b border-[#232836]">
                <tr className="text-slate-400 text-[11px] uppercase font-semibold">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  {activeColumns.map((col) => {
                    return (
                      <th
                        key={col.key}
                        style={{ minWidth: col.width || 120 }}
                        className="py-2.5 px-3 whitespace-nowrap"
                        title={col.hint}
                      >
                        {col.header}
                      </th>
                    );
                  })}
                  {currentDef.scope === 'free' && canModifyFreeRows && <th className="py-2.5 px-2 w-10 text-center">Xóa</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2330]">
                {rows.map((row, rowIndex) => {
                  const isSelf = !!userMemberId && row.memberId === userMemberId;
                  const rowEditable = isRowEditable(row);

                  return (
                    <tr
                      key={rowIndex}
                      className={`hover:bg-[#161a24]/60 transition-colors ${
                        isSelf ? 'bg-emerald-500/5 ring-1 ring-emerald-500/30' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">
                        {rowIndex + 1}
                      </td>

                      {activeColumns.map((col) => {
                        const val = row.values[col.key] ?? '';
                        const isReadOnly = col.readOnly;

                        if (isReadOnly) {
                          return (
                            <td key={col.key} className="py-2 px-3 font-bold text-white whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{val}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-normal">
                                    Bạn
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (!rowEditable) {
                          return (
                            <td key={col.key} className="py-2 px-3 font-mono text-slate-400 text-xs whitespace-pre-wrap">
                              {val || '–'}
                            </td>
                          );
                        }

                        if (col.type === 'select' && col.options) {
                        return (
                          <td key={col.key} className="py-1 px-1">
                            <select
                              aria-label={col.header}
                              value={val}
                              onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                              className="w-full bg-[#171b26] border border-[#282f42] rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                            >
                              <option value="">Chọn...</option>
                              {col.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      if (col.type === 'longtext') {
                        return (
                          <td key={col.key} className="py-1 px-1 min-w-[200px]">
                            <textarea
                              aria-label={col.header}
                              value={val}
                              rows={2}
                              onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                              className="w-full bg-[#171b26] border border-[#282f42] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500 resize-y leading-tight"
                            />
                          </td>
                        );
                      }

                      // Ô nhập sản lượng ngày (cuboid: 400, 500, 600, 1000, 1200...) với menu chọn nhanh
                      if (selectedSheetKey === 'production' && col.type === 'cell') {
                        const CUBOID_PRESETS = ['400', '500', '600', '1000', '1200', 'Nghỉ', 'Done job'];
                        const datalistId = `cuboid-presets-${col.key}-${rowIndex}`;
                        return (
                          <td key={col.key} className="py-1 px-1">
                            <div className="relative flex items-center group">
                              <input
                                aria-label={col.header}
                                list={datalistId}
                                type="text"
                                value={val}
                                onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                                className="w-full bg-[#171b26] border border-[#282f42] rounded-lg pl-2 pr-6 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500 font-mono"
                                placeholder="–"
                              />
                              <datalist id={datalistId}>
                                {CUBOID_PRESETS.map((p) => (
                                  <option key={p} value={p} />
                                ))}
                              </datalist>
                              <select
                                aria-label={`${col.header} chọn nhanh`}
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) handleCellChange(rowIndex, col.key, e.target.value);
                                }}
                                className="absolute right-0.5 top-0 bottom-0 w-6 opacity-40 group-hover:opacity-100 hover:opacity-100 bg-transparent text-slate-400 hover:text-emerald-400 cursor-pointer text-[11px] outline-none text-center font-bold"
                                title="Chọn nhanh số cuboid: 400, 500, 600, 1000, 1200..."
                              >
                                <option value="" disabled hidden>▾</option>
                                <optgroup label="Sản lượng chuẩn (1.0 công)" className="bg-[#171b26] text-slate-300 font-sans">
                                  <option value="400" className="bg-[#171b26] text-white font-mono">400 cuboid</option>
                                  <option value="500" className="bg-[#171b26] text-white font-mono">500 cuboid</option>
                                  <option value="600" className="bg-[#171b26] text-white font-mono">600 cuboid</option>
                                  <option value="1000" className="bg-[#171b26] text-white font-mono">1000 cuboid (KPI)</option>
                                  <option value="1200" className="bg-[#171b26] text-white font-mono">1200 cuboid</option>
                                </optgroup>
                                <optgroup label="Nghỉ nửa ngày (0.5 công - Giảm 50% KPI)" className="bg-[#171b26] text-amber-300 font-sans">
                                  <option value="Nghỉ 0.5" className="bg-[#171b26] text-amber-400 font-sans">Nghỉ 0.5 (Nghỉ nửa ngày)</option>
                                  <option value="400 (0.5)" className="bg-[#171b26] text-amber-200 font-mono">400 (0.5 công)</option>
                                  <option value="500 (0.5)" className="bg-[#171b26] text-amber-200 font-mono">500 (0.5 công)</option>
                                  <option value="600 (0.5)" className="bg-[#171b26] text-amber-200 font-mono">600 (0.5 công)</option>
                                </optgroup>
                                <optgroup label="Nghỉ cả ngày (0 công - Giảm 100% KPI)" className="bg-[#171b26] text-rose-300 font-sans">
                                  <option value="Nghỉ" className="bg-[#171b26] text-rose-400 font-sans">Nghỉ (Nghỉ 1 ngày)</option>
                                  <option value="Done job" className="bg-[#171b26] text-blue-400 font-sans">Done job</option>
                                </optgroup>
                              </select>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className="py-1 px-1">
                          <input
                            aria-label={col.header}
                            type="text"
                            value={val}
                            onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                            className="w-full bg-[#171b26] border border-[#282f42] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500 font-mono"
                          />
                        </td>
                      );
                    })}

                    {currentDef.scope === 'free' && canModifyFreeRows && (
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleDeleteRow(rowIndex)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Xóa dòng"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {currentWeekId && (
        <ImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          weekId={currentWeekId}
          sheetKey={selectedSheetKey}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}
