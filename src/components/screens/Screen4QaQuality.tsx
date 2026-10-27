import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { fmtDecimal, fmtInt } from '@shared/format';
import { QA_TYPES } from '@shared/constants';
import { Sparkles, Upload } from 'lucide-react';
import { ToolQaImportModal } from '../sheets/ToolQaImportModal';

export function Screen4QaQuality() {
  const { user } = useAuth();
  const { report, refreshReport } = useWeek();
  const [toolQaModalOpen, setToolQaModalOpen] = useState(false);
  if (!report) return null;

  const canImportToolQa = user?.role === 'leader' || user?.role === 'qc';

  const { members, tracks } = report;

  // Sắp xếp danh sách cho biểu đồ cột chồng theo tổng cảnh báo giảm dần
  const sortedByWarnings = [...members].sort((a, b) => b.qaTotalWarnings - a.qaTotalWarnings);
  const maxWarnings = sortedByWarnings[0]?.qaTotalWarnings || 1;

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
        <p className="text-xs text-slate-400 mb-5">
          Tool datamuro_qa trên export 7 job. Cảnh báo là nơi QC cần nhìn, chưa phải lỗi. S scale · K kích thước · Z độ cao · H hướng · O chồng lấn · D quá xa.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">Annotator</th>
                <th className="py-2.5 px-2 text-center">Job</th>
                <th className="py-2.5 px-2 text-right">Cuboid</th>
                <th className="py-2.5 px-2 text-right">% Cảnh báo</th>
                <th className="py-2.5 px-2 text-right text-purple-300">S</th>
                <th className="py-2.5 px-2 text-right text-blue-300">K</th>
                <th className="py-2.5 px-2 text-right text-slate-400">Z</th>
                <th className="py-2.5 px-2 text-right text-rose-300">H</th>
                <th className="py-2.5 px-2 text-right text-amber-300">O</th>
                <th className="py-2.5 px-2 text-right text-emerald-300">D</th>
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
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-200">
                      {fmtDecimal(q.warningPercent)}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">{q.s}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">{q.k}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400">{q.z}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">{q.h}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">{q.o}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-300">{q.d}</td>
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
        <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1">
          CẢNH BÁO THEO LOẠI · MỖI ANNOTATOR
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          K chủ yếu do ngưỡng two-wheel 1,5 m và pedestrian 0,65 m đang chờ dự án xác nhận.
        </p>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-xs text-slate-400 pb-3 border-b border-[#232836]">
          {QA_TYPES.map((t) => (
            <span key={t.key} className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
              <span className="font-bold text-slate-300">{t.short}</span> - {t.label}
            </span>
          ))}
        </div>

        {/* Stacked Bars */}
        <div className="space-y-3.5">
          {sortedByWarnings.map((m) => {
            const q = m.qa;
            if (!q) return null;
            const total = m.qaTotalWarnings;
            const totalWidth = Math.min(100, (total / (maxWarnings * 1.1)) * 100);

            return (
              <div key={m.id} className="flex items-center text-xs">
                <div className="w-44 shrink-0 font-medium text-slate-300 truncate pr-3">{m.name}</div>
                <div className="flex-1 bg-slate-800/30 h-6 rounded-lg overflow-hidden flex" style={{ maxWidth: `${totalWidth}%` }}>
                  {QA_TYPES.map((t) => {
                    const count = q[t.key as keyof typeof q] as number;
                    if (!count) return null;
                    const w = (count / total) * 100;
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
                <div className="w-20 pl-3 shrink-0 font-mono font-bold text-slate-200">{fmtInt(total)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 04 Lỗi chung cả nhóm */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">04</span>
          <h2 className="text-lg font-bold text-white tracking-tight">Lỗi chung cả nhóm</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          Track rủi ro cao ở ≥ 4/7 job. Cả nhóm làm cùng pre-label nên thường là lỗi gốc chưa ai sửa → chốt cách sửa chung một lần.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">Track</th>
                <th className="py-2.5 px-2">Class</th>
                <th className="py-2.5 px-2 text-center">Số job</th>
                <th className="py-2.5 px-3">Ở bài của</th>
                <th className="py-2.5 px-2">Cảnh báo</th>
                <th className="py-2.5 px-3">Biểu hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {tracks.map((t) => {
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
                    <td className="py-3 px-2 font-mono font-semibold text-amber-300 whitespace-nowrap">{t.warnings}</td>
                    <td className="py-3 px-3 text-slate-300 text-xs leading-relaxed">{t.symptom}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ToolQaImportModal
        isOpen={toolQaModalOpen}
        onClose={() => setToolQaModalOpen(false)}
        onSuccess={() => refreshReport()}
      />
    </div>
  );
}
