import React from 'react';
import { useWeek } from '../../context/WeekContext';
import { UserAvatar } from '../common/Avatar';
import { StatusBadge } from '../common/Badge';

export function Screen6Attitude() {
  const { report } = useWeek();
  if (!report) return null;

  const { week, members, summary } = report;
  const isCorrupted = week.leadName && (week.leadName.includes('Nguyá') || week.leadName.includes('Ä') || week.leadName.includes('Ã'));
  const leadDisplay =
    week.leadName && !isCorrupted && week.leadName !== 'Lê Sĩ Thành' && week.leadName.toUpperCase() !== 'LÊ SĨ THÀNH' && week.leadName !== 'Team Lead'
      ? week.leadName
      : 'Nguyễn Đăng Huân';

  // Sắp xếp theo điểm attitude giảm dần
  const sortedMembers = [...members].sort((a, b) => (b.attitude?.score || 0) - (a.attitude?.score || 0));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-1">
            {week.orgName} · {week.teamName} {week.discipline} · TEAM LEAD {leadDisplay.toUpperCase()}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Đánh giá Attitude thành viên</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-4xl leading-relaxed">
            Thang điểm 85–100 · Xuất sắc ≥ 95 · Tốt 90–94 · Khá 85–89. Căn cứ: đúng giờ, nghỉ có phép và báo trước, Complete đúng deadline, chủ động hỗ trợ nhóm (số liệu Tuần {week.weekNumber}: {week.startDate.slice(8, 10)}–{week.endDate.slice(8, 10)}/{week.startDate.slice(5, 7)}). Team Lead: {leadDisplay}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center px-4 py-2 bg-[#171b26] rounded-xl border border-[#262c3d]">
            <div className="text-xl font-extrabold text-white">{summary.attitudeAvg.toString().replace('.', ',')}</div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">TB Attitude Team</div>
          </div>
          <div className="text-center px-4 py-2 bg-[#171b26] rounded-xl border border-[#262c3d]">
            <div className="text-xl font-extrabold text-emerald-400">
              {week.jobsDone}/{week.jobsTotal}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Complete đúng hạn</div>
          </div>
        </div>
      </div>

      {/* Attitude Score Table */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Thành viên</th>
                <th className="py-3 px-3 min-w-[300px]">Điểm Attitude · Thang 85–100</th>
                <th className="py-3 px-3 text-center w-20">Điểm</th>
                <th className="py-3 px-3 text-center w-28">Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {sortedMembers.map((m, idx) => {
                const score = m.attitude?.score || 0;
                // Thang từ 80 đến 100
                const percent = Math.min(100, Math.max(0, ((score - 80) / 20) * 100));
                const barColor =
                  score >= 95 ? 'bg-emerald-500' : score >= 90 ? 'bg-amber-400' : score >= 85 ? 'bg-rose-400' : 'bg-slate-600';

                return (
                  <tr key={m.id} className="hover:bg-[#161a24] transition-colors">
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={m.name} initials={m.initials} size="sm" />
                        <span className="font-bold text-white text-xs">{m.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="relative w-full h-4 bg-slate-800/40 rounded-full overflow-hidden p-0.5">
                        {/* Guideline markers at 90 (50%) and 95 (75%) on 80-100 range */}
                        <div className="absolute top-0 bottom-0 left-[50%] border-r border-dashed border-amber-400/50 z-10" />
                        <div className="absolute top-0 bottom-0 left-[75%] border-r border-dashed border-emerald-400/50 z-10" />

                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-extrabold text-sm text-white">
                      {score || '–'}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <StatusBadge attitudeGrade={m.attitude?.grade} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 mt-5 pt-4 border-t border-[#232836] text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Xuất sắc ≥ 95</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Tốt 90–94</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Khá 85–89</span>
          <span className="flex items-center gap-1.5 text-amber-300 font-medium">┊ Mốc 90</span>
          <span className="flex items-center gap-1.5 text-emerald-300 font-medium">┊ Mốc 95</span>
        </div>
      </section>

      {/* Ghi chú · Lý do xếp loại */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <h2 className="text-base font-bold text-white tracking-tight mb-4">Ghi chú · Lý do xếp loại</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedMembers.map((m, idx) => (
            <div
              key={m.id}
              className="bg-[#171b26] border border-[#262c3d] rounded-2xl p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[#232836]">
                  <span className="font-bold text-white text-xs">
                    {idx + 1}. {m.name}
                  </span>
                  <StatusBadge attitudeGrade={m.attitude?.grade}>
                    {m.attitude?.score} · {m.attitude?.grade === 'excellent' ? 'Xuất sắc' : m.attitude?.grade === 'good' ? 'Tốt' : 'Khá'}
                  </StatusBadge>
                </div>
                <div className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                  {m.attitude?.note || 'Chưa có ghi chú.'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
