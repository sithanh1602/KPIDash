import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { fmtDecimal, fmtInt } from '@shared/format';
import { QA_TYPES } from '@shared/constants';
import { filterTrack, getMemberDynamicQa } from '@shared/qa';
import { Sparkles } from 'lucide-react';
import { ToolQaImportModal } from '../sheets/ToolQaImportModal';
import { QaTypeFilterBar } from '../common/QaTypeFilterBar';

export function Screen4QaQuality() {
  const { user } = useAuth();
  const { report, refreshReport, selectedQaTypes, setSelectedQaTypes } = useWeek();
  const [toolQaModalOpen, setToolQaModalOpen] = useState(false);
  if (!report) return null;

  const canImportToolQa = user?.role === 'leader' || user?.role === 'qc';
  const { members, tracks } = report;

  const toggleQaType = (key: string) => {
    if (selectedQaTypes.includes(key)) {
      if (selectedQaTypes.length === 1) return; // Giữ ít nhất 1 loại
      setSelectedQaTypes(selectedQaTypes.filter((k) => k !== key));
    } else {
      setSelectedQaTypes([...selectedQaTypes, key]);
    }
  };

  const selectAllQaTypes = () => {
    setSelectedQaTypes(QA_TYPES.map((t) => t.key));
  };

  const isFiltered = selectedQaTypes.length < QA_TYPES.length;

  // Tính toán số cảnh báo và % cảnh báo theo các loại lỗi đang được chọn
  const getMemberDynamicQa = (m: (typeof members)[0]) => {
    const q = m.qa;
    if (!q) return { total: 0, percent: 0 };
    const total = QA_TYPES.reduce((acc, t) => {
      return selectedQaTypes.includes(t.key) ? acc + (Number(q[t.key as keyof typeof q]) || 0) : acc;
    }, 0);
    const percent = q.cuboids > 0 ? Number(((total / q.cuboids) * 100).toFixed(1)) : 0;
    return { total, percent };
  };

  // Sắp xếp danh sách cho biểu đồ cột chồng theo tổng cảnh báo đã lọc giảm dần
  const sortedByWarnings = [...members]
    .map((m) => ({ ...m, dynamicQa: getMemberDynamicQa(m) }))
    .sort((a, b) => b.dynamicQa.total - a.dynamicQa.total);
  const maxWarnings = sortedByWarnings[0]?.dynamicQa.total || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 03 Chất lượng theo tool QA */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">03</span>
            <h2 className="text-lg font-bold text-white tracking-tight">Chất lượng theo tool QA</h2>
          </div>
          {canImportToolQa && (
            <button
              onClick={() => setToolQaModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 self-start sm:self-auto"
            >
              <Sparkles size={14} />
              <span>Import Tool QA (Datumaro)</span>
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Tool datamuro_qa trên export 7 job. Cảnh báo là nơi QC cần nhìn, chưa phải lỗi. Tích chọn các loại lỗi bên dưới để tính vào tổng cảnh báo và tỷ lệ %.
        </p>

        <QaTypeFilterBar className="mb-5" />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">Annotator</th>
                <th className="py-2.5 px-2 text-center">Job</th>
                <th className="py-2.5 px-2 text-right">Cuboid</th>
                <th className="py-2.5 px-2 text-right">
                  <div className="flex flex-col items-end">
                    <span>% Cảnh báo</span>
                    {isFiltered && <span className="text-[9px] text-amber-400 font-normal lowercase">(đã lọc)</span>}
                  </div>
                </th>
                {QA_TYPES.map((t) => {
                  const isChecked = selectedQaTypes.includes(t.key);
                  return (
                    <th key={t.key} className="py-2.5 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleQaType(t.key)}
                        className="inline-flex items-center justify-end gap-1 cursor-pointer group"
                        title={`Bấm để ${isChecked ? 'bỏ' : 'tính'} lỗi ${t.short} (${t.label})`}
                      >
                        <span
                          className={`w-3 h-3 rounded flex items-center justify-center border text-[8px] ${
                            isChecked
                              ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-bold'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isChecked ? '✓' : ''}
                        </span>
                        <span
                          className={`font-bold transition-colors ${
                            isChecked ? 'text-white' : 'text-slate-600 line-through'
                          }`}
                          style={isChecked ? { color: t.color } : {}}
                        >
                          {t.short}
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th className="py-2.5 px-2 text-center font-bold text-amber-400">Cao</th>
                <th className="py-2.5 px-2 text-center">TB</th>
                <th className="py-2.5 px-2 text-center">Thấp</th>
                <th className="py-2.5 px-3">Người QC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {members.map((m) => {
                const q = m.qa;
                if (!q) return null;
                const dynamic = getMemberDynamicQa(m);

                const highColor =
                  q.riskHigh <= 10
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    : q.riskHigh <= 15
                    ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

                return (
                  <tr key={m.id} className="hover:bg-[#161a24] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{m.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-400">{q.jobCode}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">{fmtInt(q.cuboids)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold whitespace-nowrap">
                      <span className={isFiltered ? 'text-amber-300' : 'text-slate-200'}>
                        {fmtDecimal(dynamic.percent)}%
                      </span>
                    </td>
                    {QA_TYPES.map((t) => {
                      const isChecked = selectedQaTypes.includes(t.key);
                      const val = q[t.key as keyof typeof q] as number;
                      return (
                        <td
                          key={t.key}
                          className={`py-2.5 px-2 text-right font-mono transition-all ${
                            isChecked
                              ? 'text-slate-300'
                              : 'text-slate-600 line-through opacity-40'
                          }`}
                          title={isChecked ? `${t.label}: ${val}` : `${t.label} đã bỏ chọn (không tính)`}
                        >
                          {val}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${highColor}`}>
                        • {q.riskHigh}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-300">{q.riskMid}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-slate-400">{q.riskLow}</td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{q.qcName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cảnh báo theo loại · Mỗi annotator (Biểu đồ cột chồng) */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex items-center justify-between gap-4 mb-1 flex-wrap">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
            CẢNH BÁO THEO LOẠI · MỖI ANNOTATOR {isFiltered && `(TÍNH ${selectedQaTypes.length}/6 LOẠI LỖI)`}
          </h3>
          {isFiltered && (
            <span className="text-xs text-amber-400 font-mono">
              Tổng đã loại bỏ: {QA_TYPES.filter((t) => !selectedQaTypes.includes(t.key)).map((t) => t.short).join(', ')}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Biểu đồ cột chồng tự động cập nhật độ dài và tổng số theo các loại lỗi đang được tích chọn.
        </p>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-xs text-slate-400 pb-3 border-b border-[#232836]">
          {QA_TYPES.map((t) => {
            const isChecked = selectedQaTypes.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => toggleQaType(t.key)}
                className={`flex items-center gap-1.5 font-medium transition-all ${
                  isChecked ? 'opacity-100 cursor-pointer' : 'opacity-40 line-through cursor-pointer'
                }`}
                title={`Nhấn để ${isChecked ? 'bỏ chọn' : 'chọn'} ${t.label}`}
              >
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
                <span className="font-bold text-slate-300">{t.short}</span> - {t.label}
              </button>
            );
          })}
        </div>

        {/* Stacked Bars */}
        <div className="space-y-3.5">
          {sortedByWarnings.map((m) => {
            const q = m.qa;
            if (!q) return null;
            const total = m.dynamicQa.total;
            const totalWidth = Math.min(100, (total / (maxWarnings * 1.1)) * 100);

            return (
              <div key={m.id} className="flex items-center text-xs">
                <div className="w-44 shrink-0 font-medium text-slate-300 truncate pr-3">{m.name}</div>
                <div className="flex-1 bg-slate-800/30 h-6 rounded-lg overflow-hidden flex" style={{ maxWidth: `${totalWidth}%` }}>
                  {QA_TYPES.filter((t) => selectedQaTypes.includes(t.key)).map((t) => {
                    const count = q[t.key as keyof typeof q] as number;
                    if (!count) return null;
                    const w = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div
                        key={t.key}
                        style={{ width: `${w}%`, backgroundColor: t.color }}
                        className="h-full hover:opacity-90 transition-opacity"
                        title={`${t.label}: ${count} cảnh báo`}
                      />
                    );
                  })}
                </div>
                <div className="w-20 pl-3 shrink-0 font-mono font-bold text-slate-200">
                  {fmtInt(total)}
                  {isFiltered && <span className="text-[10px] text-amber-400/80 font-normal ml-1">*</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 04 Lỗi chung cả nhóm */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">04</span>
            <h2 className="text-lg font-bold text-white tracking-tight">Lỗi chung cả nhóm</h2>
          </div>
          {isFiltered && (
            <span className="text-xs text-amber-400 font-mono">
              Hiển thị {tracks.filter((t) => filterTrack(t, selectedQaTypes).isVisible).length}/{tracks.length} track
              {tracks.filter((t) => !filterTrack(t, selectedQaTypes).isVisible).length > 0 &&
                ` · (Đã ẩn ${tracks.filter((t) => !filterTrack(t, selectedQaTypes).isVisible).length} track chỉ có lỗi đã bỏ chọn)`}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-5">
          Track rủi ro cao ở ≥ 4/7 job. Cả nhóm làm cùng pre-label nên thường là lỗi gốc chưa ai sửa → chốt cách sửa chung một lần.
        </p>

        {tracks.filter((t) => filterTrack(t, selectedQaTypes).isVisible).length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-[#161a24] rounded-xl border border-[#232836] text-xs">
            Không có track rủi ro cao nào thuộc các loại lỗi đang chọn ({selectedQaTypes.map((k) => k.toUpperCase()).join(', ')}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                  <th className="py-2.5 px-3">Track</th>
                  <th className="py-2.5 px-2">Class</th>
                  <th className="py-2.5 px-2 text-center">Số job</th>
                  <th className="py-2.5 px-3">Ở bài của</th>
                  <th className="py-2.5 px-2">
                    <div className="flex flex-col">
                      <span>Cảnh báo</span>
                      {isFiltered && <span className="text-[9px] text-amber-400 font-normal lowercase">(đã lọc)</span>}
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Biểu hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2330]">
                {tracks
                  .map((t) => ({ track: t, dynamic: filterTrack(t, selectedQaTypes) }))
                  .filter((item) => item.dynamic.isVisible)
                  .map(({ track: t, dynamic }) => {
                    const jobPillColor =
                      t.jobCount >= 6
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold'
                        : t.jobCount === 5
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

                    return (
                      <tr key={t.id} className="hover:bg-[#161a24] transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">{t.trackNo}</td>
                        <td className="py-3 px-2 text-slate-300 whitespace-nowrap">{t.className}</td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${jobPillColor}`}>
                            • {t.jobCount}/7
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] font-mono text-slate-300">{t.inJobs}</td>
                        <td className="py-3 px-2 font-mono font-semibold text-amber-300 whitespace-nowrap">
                          {dynamic.warningsText}
                        </td>
                        <td className="py-3 px-3 text-slate-300 text-xs leading-relaxed">{dynamic.symptomText}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ToolQaImportModal
        isOpen={toolQaModalOpen}
        onClose={() => setToolQaModalOpen(false)}
        onSuccess={() => refreshReport()}
      />
    </div>
  );
}
