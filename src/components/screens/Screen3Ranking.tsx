import React from 'react';
import { useWeek } from '../../context/WeekContext';
import { fmtDecimal, fmtInt } from '@shared/format';
import { QA_TYPES } from '@shared/constants';
import { getMemberDynamicQa, getMemberDynamicRiskAndInsight } from '@shared/qa';
import { UserAvatar } from '../common/Avatar';
import { StatusBadge } from '../common/Badge';
import { splitLines } from '@shared/text';

export function Screen3Ranking() {
  const { report, selectedQaTypes } = useWeek();
  if (!report) return null;

  const { week, ranking, summary, tracks } = report;
  const isFiltered = selectedQaTypes.length < QA_TYPES.length;
  const top1 = ranking[0];
  const top2 = ranking[1];
  const top3 = ranking[2];
  const belowKpi = ranking.filter((m) => m.grade === 'below');

  const getDynamicRisk = (m: (typeof ranking)[0]) => {
    return getMemberDynamicRiskAndInsight(m, selectedQaTypes, tracks).riskHigh;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-1">
            {week.orgName} · {week.teamName} {week.discipline} · Tuần {week.weekNumber}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Bảng xếp hạng thành viên</h1>
          <p className="text-xs text-slate-400 mt-1">
            Xếp hạng theo sản lượng trung bình cuboid / ngày làm (mốc {fmtInt(week.normalThreshold)} bình thường · {fmtInt(week.excellentThreshold)} xuất sắc). Cột Track Cao = số track rủi ro cao theo tool QA.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center px-4 py-2 bg-[#171b26] rounded-xl border border-[#262c3d]">
            <div className="text-lg font-extrabold text-white">{fmtInt(summary.teamAvg)}</div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">TB Team / ngày</div>
          </div>
          <div className="text-center px-4 py-2 bg-[#171b26] rounded-xl border border-[#262c3d]">
            <div className="text-lg font-extrabold text-emerald-400">{summary.kpiPercent}%</div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">% KPI Team</div>
          </div>
          <div className="text-center px-4 py-2 bg-[#171b26] rounded-xl border border-[#262c3d]">
            <div className="text-lg font-extrabold text-emerald-400">{summary.membersMet}/{summary.membersTotal}</div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Đạt ≥ {fmtInt(week.normalThreshold)}</div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {top1 && top2 && top3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4">
          {/* TOP 2 */}
          <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-5 text-center flex flex-col justify-between shadow-lg relative overflow-hidden order-2 md:order-1">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center mx-auto mb-3 border border-slate-700">
              2
            </div>
            <UserAvatar name={top2.name} initials={top2.initials} size="lg" className="mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">{top2.name}</h3>
            <div className="text-2xl font-extrabold text-white mt-1">
              {fmtInt(top2.avg)} <span className="text-xs font-normal text-slate-400">CUBOID / NGÀY</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Tổng tuần <strong className="text-slate-300">{fmtInt(top2.total)}</strong> cuboid · {top2.workDays} ngày làm
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <StatusBadge grade={top2.grade} />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {getDynamicRisk(top2)} track Cao
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 bg-[#161a24] p-2 rounded-xl border border-[#262c3d]">
              {top2.rankNote || 'Done job trước 12h · 4/4 ngày xuất sắc'}
            </div>
            <div className="mt-4 pt-3 border-t border-[#232836] text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              TOP 2
            </div>
          </div>

          {/* TOP 1 - Highlighted */}
          <div className="bg-[#141824] border-2 border-emerald-500/50 rounded-2xl p-6 text-center flex flex-col justify-between shadow-2xl relative overflow-hidden order-1 md:order-2 md:-translate-y-3">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/30">
              1
            </div>
            <UserAvatar name={top1.name} initials={top1.initials} size="xl" className="mx-auto mb-3" />
            <h3 className="text-lg font-extrabold text-white">{top1.name}</h3>
            <div className="text-3xl font-extrabold text-emerald-400 mt-1">
              {fmtInt(top1.avg)} <span className="text-xs font-normal text-slate-400">CUBOID / NGÀY</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Tổng tuần <strong className="text-white">{fmtInt(top1.total)}</strong> cuboid · {top1.workDays} ngày làm
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <StatusBadge grade={top1.grade} />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                {getDynamicRisk(top1)} track Cao
              </span>
            </div>
            <div className="mt-3 text-[11px] text-emerald-300/80 bg-emerald-950/20 p-2 rounded-xl border border-emerald-900/40">
              {top1.rankNote || 'Done job trước 12h · vòng 2 giảm 80% lỗi scale'}
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-500/20 text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
              👑 TOP 1
            </div>
          </div>

          {/* TOP 3 */}
          <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-5 text-center flex flex-col justify-between shadow-lg relative overflow-hidden order-3">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center mx-auto mb-3 border border-slate-700">
              3
            </div>
            <UserAvatar name={top3.name} initials={top3.initials} size="lg" className="mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">{top3.name}</h3>
            <div className="text-2xl font-extrabold text-white mt-1">
              {fmtInt(top3.avg)} <span className="text-xs font-normal text-slate-400">CUBOID / NGÀY</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Tổng tuần <strong className="text-slate-300">{fmtInt(top3.total)}</strong> cuboid · {top3.workDays} ngày làm
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <StatusBadge grade={top3.grade} />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {getDynamicRisk(top3)} track Cao
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-400 bg-[#161a24] p-2 rounded-xl border border-[#262c3d]">
              {top3.rankNote || 'Ổn định, kích thước box đồng bộ'}
            </div>
            <div className="mt-4 pt-3 border-t border-[#232836] text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              TOP 3
            </div>
          </div>
        </div>
      )}

      {/* Full Ranking Table */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Thành viên</th>
                <th className="py-3 px-3">TB cuboid / ngày · so với mốc</th>
                <th className="py-3 px-3 text-right">TB / ngày</th>
                <th className="py-3 px-3 text-right">Tổng tuần</th>
                <th className="py-3 px-3 text-right">% KPI</th>
                <th className="py-3 px-3 text-right">Track Cao</th>
                <th className="py-3 px-3 text-center">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {ranking.map((m, idx) => {
                const rankNum = String(idx + 1).padStart(2, '0');
                const barWidth = Math.min(100, Math.max(5, (m.avg / 1600) * 100));
                const barColor =
                  m.grade === 'excellent'
                    ? 'bg-emerald-500'
                    : m.grade === 'normal'
                    ? 'bg-amber-400'
                    : 'bg-rose-400';

                return (
                  <tr key={m.id} className="hover:bg-[#161a24] transition-colors">
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">{rankNum}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={m.name} initials={m.initials} size="sm" />
                        <div>
                          <div className="font-bold text-white text-xs">{m.name}</div>
                          <div className="text-[11px] text-slate-400">{m.rankNote}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 min-w-[200px]">
                      <div className="w-full bg-slate-800/40 h-3 rounded-full overflow-hidden p-0.5 relative">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-white text-sm whitespace-nowrap">
                      {fmtInt(m.avg)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 whitespace-nowrap">
                      {fmtInt(m.total)} <span className="text-[10px] text-slate-500">· {m.workDays} ngày</span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-300 whitespace-nowrap">
                      {m.kpiPercent}%
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-400 whitespace-nowrap">
                      {m.qa ? getDynamicRisk(m) : '–'}
                      {m.qa && (
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          ({fmtDecimal(getMemberDynamicQa(m.qa, selectedQaTypes).percent)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <StatusBadge grade={m.grade} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Kế hoạch training tuần sau · nhóm dưới KPI */}
      {belowKpi.length > 0 && (
        <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-4">
            KẾ HOẠCH TRAINING TUẦN SAU · NHÓM DƯỚI KPI
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {belowKpi.map((m) => {
              const coaching = m.coaching;
              const errors = splitLines(coaching?.commonErrors || '');
              const training = splitLines(coaching?.training || '');
              const goals = (coaching?.goals || '').split(';').map((g) => g.trim()).filter(Boolean);

              return (
                <div
                  key={m.id}
                  className="bg-[#171b26] border border-[#262c3d] rounded-2xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Header card */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#232836]">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={m.name} initials={m.initials} size="md" />
                        <div>
                          <div className="font-bold text-white text-sm">{m.name}</div>
                          <div className="text-[11px] text-slate-400">
                            Hạng {String(m.rank).padStart(2, '0')} · TB {fmtInt(m.avg)}/ngày · {m.kpiPercent}% KPI · {m.qa?.riskHigh || 0} track Cao
                          </div>
                        </div>
                      </div>
                      <StatusBadge grade="below" />
                    </div>

                    {/* Absence / Downtime notes */}
                    {coaching?.absenceNote && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                        {coaching.absenceNote}
                      </div>
                    )}

                    {/* Lỗi chính */}
                    {errors.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          LỖI CHÍNH
                        </div>
                        <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                          {errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Training tuần sau */}
                    {training.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          TRAINING TUẦN SAU
                        </div>
                        <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                          {training.map((tr, i) => (
                            <li key={i}>{tr}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Goal Badges */}
                  {goals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#232836]">
                      {goals.map((g, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
