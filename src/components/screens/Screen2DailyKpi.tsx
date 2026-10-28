import React from 'react';
import { useWeek } from '../../context/WeekContext';
import { fmtDecimal, fmtInt } from '@shared/format';
import { QA_TYPES } from '@shared/constants';
import { getMemberDynamicQa, getMemberDynamicRiskAndInsight } from '@shared/qa';
import { StatusBadge } from '../common/Badge';
import { QaTypeFilterBar } from '../common/QaTypeFilterBar';

export function Screen2DailyKpi() {
  const { report, selectedQaTypes } = useWeek();
  if (!report) return null;

  const { week, members, dayLabels, actions, tracks } = report;
  const isFiltered = selectedQaTypes.length < QA_TYPES.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 02 Bảng KPI theo ngày */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">02</span>
            <h2 className="text-lg font-bold text-white tracking-tight">Bảng KPI theo ngày</h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/50" /> Xuất sắc ≥ 1.200</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/50" /> Bình thường 1.000–1.199</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500/50" /> Dưới KPI &lt; 1.000</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500/20 border border-indigo-500/50" /> Done job</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-700/30 border border-slate-600/50" /> Nghỉ</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          Ô = cuboid hoàn thành. * = ước tính.{week.dataNotes ? ` ${week.dataNotes}.` : ''} % KPI = TB ÷ {fmtInt(week.target)}.
        </p>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3">Annotator</th>
                {dayLabels.map((lbl, i) => (
                  <th key={i} className="py-3 px-2 text-center whitespace-nowrap">{lbl}</th>
                ))}
                <th className="py-3 px-3 text-right">TB / ngày</th>
                <th className="py-3 px-3 text-right">% KPI</th>
                <th className="py-3 px-3 text-center">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-[#161a24] transition-colors">
                  <td className="py-3 px-3 font-bold text-white whitespace-nowrap">{m.name}</td>
                  {m.days.map((day, i) => {
                    if (!day) {
                      return (
                        <td key={i} className="py-2.5 px-1.5 text-center">
                          <span className="text-slate-600">–</span>
                        </td>
                      );
                    }

                    if (day.status === 'leave') {
                      return (
                        <td key={i} className="py-2.5 px-1.5 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/60 text-slate-400 border border-slate-700/50">
                            Nghỉ
                          </span>
                        </td>
                      );
                    }

                    if (day.status === 'done') {
                      return (
                        <td key={i} className="py-2.5 px-1.5 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            Done job
                          </span>
                        </td>
                      );
                    }

                    const cuboids = day.cuboids ?? 0;
                    const isEx = cuboids >= week.excellentThreshold;
                    const isNorm = cuboids >= week.normalThreshold;
                    const cellStyle = isEx
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold'
                      : isNorm
                      ? 'bg-amber-500/15 text-amber-200 border-amber-500/30 font-semibold'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-semibold';

                    return (
                      <td key={i} className="py-2.5 px-1.5 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[70px] px-2 py-1 rounded-md border text-xs relative ${cellStyle}`}>
                          {fmtInt(cuboids)}
                          {day.estimated && (
                            <span className="text-emerald-400 font-bold ml-0.5" title="Ước tính">*</span>
                          )}
                        </span>
                      </td>
                    );
                  })}

                  <td className="py-3 px-3 text-right font-extrabold text-sm text-white whitespace-nowrap">
                    {fmtInt(m.avg)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-xs text-slate-300 whitespace-nowrap">
                    {m.kpiPercent}%
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <StatusBadge grade={m.grade} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Middle Two Panels: Trung bình cuboid / ngày làm & Đạt KPI thì chất lượng thế nào */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Bar chart */}
        <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1">
              TRUNG BÌNH CUBOID / NGÀY LÀM
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Vạch đứt vàng {fmtInt(week.normalThreshold)} - xanh {fmtInt(week.excellentThreshold)}
            </p>

            <div className="space-y-4 relative">
              {/* Vertical guideline markers at 1000 (62.5%) and 1200 (75%) based on 1600 scale */}
              <div className="absolute top-0 bottom-0 left-[200px] right-8 pointer-events-none">
                <div
                  className="absolute top-0 bottom-0 border-r border-dashed border-amber-400/40 z-10"
                  style={{ left: `${(week.normalThreshold / 1600) * 100}%` }}
                >
                  <span className="text-[10px] text-amber-300 font-bold absolute -top-5 -translate-x-1/2">
                    {fmtInt(week.normalThreshold)}
                  </span>
                </div>
                <div
                  className="absolute top-0 bottom-0 border-r border-dashed border-emerald-400/40 z-10"
                  style={{ left: `${(week.excellentThreshold / 1600) * 100}%` }}
                >
                  <span className="text-[10px] text-emerald-300 font-bold absolute -top-5 -translate-x-1/2">
                    {fmtInt(week.excellentThreshold)}
                  </span>
                </div>
              </div>

              {members.map((m) => {
                const barWidth = Math.min(100, Math.max(5, (m.avg / 1600) * 100));
                const barColor =
                  m.grade === 'excellent'
                    ? 'bg-emerald-500'
                    : m.grade === 'normal'
                    ? 'bg-amber-400'
                    : 'bg-rose-400';

                return (
                  <div key={m.id} className="flex items-center text-xs">
                    <div className="w-[200px] shrink-0 font-medium text-slate-300 truncate pr-3">{m.name}</div>
                    <div className="flex-1 bg-slate-800/40 h-5 rounded-full overflow-hidden p-0.5 relative">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="w-24 text-right shrink-0 font-mono font-bold text-slate-200 text-xs pl-2">
                      {fmtInt(m.avg)} · {m.kpiPercent}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Đạt KPI thì chất lượng thế nào */}
        <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                ĐẠT KPI THÌ CHẤT LƯỢNG THẾ NÀO?
              </h3>
              {isFiltered && (
                <span className="text-[11px] text-amber-400 font-mono">
                  (Đang tính {selectedQaTypes.length}/6 loại lỗi)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Kết hợp sản lượng và rủi ro để đưa ra nhận định (đồng bộ theo bộ chọn lỗi)
            </p>

            <QaTypeFilterBar compact className="mb-4 text-xs py-2 px-3" label="Lọc lỗi:" />

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                    <th className="py-2 px-2">Annotator</th>
                    <th className="py-2 px-1 text-center">% KPI</th>
                    <th className="py-2 px-2 text-center">Xếp loại</th>
                    <th className="py-2 px-2 text-right">
                      <div className="flex flex-col items-end">
                        <span>Cảnh báo</span>
                        {isFiltered && <span className="text-[9px] text-amber-400 font-normal lowercase">(đã lọc)</span>}
                      </div>
                    </th>
                    <th className="py-2 px-2 text-right">
                      <div className="flex flex-col items-end">
                        <span>Track rủi ro</span>
                        {isFiltered && <span className="text-[9px] text-amber-400 font-normal lowercase">(đã lọc)</span>}
                      </div>
                    </th>
                    <th className="py-2 px-3">Nhận định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2330]">
                  {members.map((m) => {
                    const dynamicQa = getMemberDynamicQa(m.qa, selectedQaTypes);
                    const { riskHigh: dynamicRiskHigh, insight: dynamicInsight } = getMemberDynamicRiskAndInsight(
                      m,
                      selectedQaTypes,
                      tracks,
                    );

                    return (
                      <tr key={m.id} className="hover:bg-[#161a24] transition-colors">
                        <td className="py-2.5 px-2 font-bold text-white whitespace-nowrap">{m.name}</td>
                        <td className="py-2.5 px-1 text-center font-bold text-slate-300">{m.kpiPercent}%</td>
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <StatusBadge grade={m.grade} />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                          {m.qa ? (
                            <span className={isFiltered ? 'text-amber-300 font-bold' : ''}>
                              {fmtDecimal(dynamicQa.percent)}%
                            </span>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-400">
                          {m.qa ? dynamicRiskHigh : '–'}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-tight">
                          {dynamicInsight}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Kế hoạch hành động tuần tới */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-4">
          KẾ HOẠCH HÀNH ĐỘNG TUẦN TỚI
        </h3>

        <div className="space-y-3">
          {actions.map((act, i) => (
            <div
              key={act.id}
              className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-[#171b26] border border-[#262c3d]"
            >
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="text-xs font-bold text-white">{act.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{act.detail}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium text-slate-400">{act.owner}</span>
                <StatusBadge priority={act.priority} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
