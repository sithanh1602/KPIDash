import React from 'react';
import { useWeek } from '../../context/WeekContext';
import { fmtInt, weekRangeLabel } from '@shared/format';
import { UserAvatar } from '../common/Avatar';
import { StatusBadge } from '../common/Badge';
import { asOfLabel } from '@shared/kpi';

export function Screen1Overview() {
  const { report } = useWeek();
  if (!report) return null;

  const { week, summary, members } = report;
  const kpiPercent = summary.kpiPercent;
  const teamAvg = summary.teamAvg;

  // Arc calculations for the gauge
  const maxScale = 1600;
  const gaugePercent = Math.min(100, Math.max(0, (teamAvg / maxScale) * 100));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="text-xs uppercase tracking-widest text-slate-400 font-mono flex items-center gap-2">
            <span>BÁO CÁO TUẦN {week.weekNumber}</span>
            <span className="text-slate-600">·</span>
            <span className="font-bold text-slate-200">01 / 06</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {week.jobsDone}/{week.jobsTotal} JOB COMPLETE • TOOL QA {week.toolQaDone}/{week.jobsTotal}
            </span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
          Báo cáo KPI & chất lượng gán nhãn {week.discipline}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2">
          Tuần {week.weekNumber} ({weekRangeLabel(week.startDate, week.endDate)}) • số liệu đến {asOfLabel(week)} • Team lead {week.leadName || 'Lê Sĩ Thành'}
        </p>

        {/* 6 Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-[#232836]">
          <div className="bg-[#171b26] p-3.5 rounded-xl border border-[#262c3d]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TB / Ngày công</div>
            <div className="text-2xl font-extrabold text-white mt-1">
              {fmtInt(summary.teamAvg)} <span className="text-xs font-normal text-slate-400">cuboid</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{summary.workDays} ngày công có số</div>
          </div>

          <div className="bg-[#171b26] p-3.5 rounded-xl border border-[#262c3d]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">% KPI Team</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">{summary.kpiPercent}%</div>
            <div className="text-[11px] text-slate-400 mt-1">so với mốc {fmtInt(week.target)}</div>
          </div>

          <div className="bg-[#171b26] p-3.5 rounded-xl border border-[#262c3d]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tổng Cuboid</div>
            <div className="text-2xl font-extrabold text-white mt-1">{fmtInt(summary.total)}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {week.startDate.slice(8, 10)}–{week.endDate.slice(8, 10)}/{week.startDate.slice(5, 7)}
            </div>
          </div>

          <div className="bg-[#171b26] p-3.5 rounded-xl border border-[#262c3d]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Job hoàn thành</div>
            <div className="text-2xl font-extrabold text-white mt-1">
              {week.jobsDone} <span className="text-sm font-normal text-slate-400">/ {week.jobsTotal}</span>
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">trước deadline</div>
          </div>

          <div className="bg-[#171b26] p-3.5 rounded-xl border border-[#262c3d]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Track rủi ro cao</div>
            <div className="text-2xl font-extrabold text-amber-400 mt-1">{summary.riskHigh}</div>
            <div className="text-[11px] text-slate-400 mt-1">tool QA · chờ QC</div>
          </div>

          <div className="bg-[#171b26] p-3.5 rounded-xl border border-[#262c3d]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Issue chờ chốt</div>
            <div className="text-2xl font-extrabold text-rose-400 mt-1">{summary.issuesPending}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              {report.issues.filter((i) => i.priority === 'Cao').length} ưu tiên Cao
            </div>
          </div>
        </div>
      </div>

      {/* 01 Tóm tắt điều hành */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">01</span>
          <h2 className="text-base font-bold text-white tracking-tight">Tóm tắt điều hành</h2>
        </div>
        <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {summary.executive.map((line, idx) => {
            const parts = line.split(':');
            return (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
                <div>
                  {parts.length > 1 ? (
                    <>
                      <strong className="text-white font-semibold">{parts[0]}:</strong>
                      <span>{parts.slice(1).join(':')}</span>
                    </>
                  ) : (
                    line
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Two columns: Hôm nay & Gauge chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Hôm nay */}
        <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                HÔM NAY · {asOfLabel(week).toUpperCase()}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Tất cả đã Complete. Có số: sửa track ID lỗi 23/10 + làm track mới (≈ cuboid + 60).
            </p>

            <div className="space-y-2.5">
              {members.map((m) => {
                const isDone = m.today.status === 'done';
                const isLeave = m.today.status === 'leave';
                const isWork = m.today.status === 'work';

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#171b26] border border-[#262c3d]"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar name={m.name} initials={m.initials} size="sm" />
                      <div>
                        <div className="text-xs font-bold text-white">{m.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{m.today.note || '–'}</div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isWork && <span className="font-bold text-xs text-white">{fmtInt(m.today.cuboids || 0)}</span>}
                      {isDone && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                          • Done job
                        </span>
                      )}
                      {isLeave && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/30 text-slate-400 border border-slate-600/30">
                          • Nghỉ
                        </span>
                      )}
                      {isWork && <StatusBadge grade={m.grade} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Sản lượng trung bình tuần (Gauge chart) */}
        <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-1">
              SẢN LƯỢNG TRUNG BÌNH TUẦN
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Vàng: 1.000 bình thường · xanh: 1.200 xuất sắc
            </p>

            {/* Gauge SVG Chart */}
            <div className="relative flex flex-col items-center justify-center pt-2 pb-4">
              <svg viewBox="0 0 280 160" className="w-64 h-36 overflow-visible">
                {/* Background arc */}
                <path
                  d="M 30 140 A 110 110 0 0 1 250 140"
                  fill="none"
                  stroke="#232836"
                  strokeWidth="20"
                  strokeLinecap="round"
                />
                {/* Colored progress arc */}
                <path
                  d="M 30 140 A 110 110 0 0 1 250 140"
                  fill="none"
                  stroke={teamAvg >= week.excellentThreshold ? '#22c55e' : teamAvg >= week.normalThreshold ? '#eab308' : '#ef4444'}
                  strokeWidth="20"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${gaugePercent} 100`}
                />
                {/* Scale markers */}
                <text x="30" y="160" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">0</text>
                <text x="80" y="70" textAnchor="middle" fill="#64748b" fontSize="10">400</text>
                <text x="140" y="32" textAnchor="middle" fill="#64748b" fontSize="10">800</text>
                <text x="195" y="65" textAnchor="middle" fill="#64748b" fontSize="10">1k</text>
                <text x="215" y="85" textAnchor="middle" fill="#eab308" fontSize="10" fontWeight="bold">1,2k</text>
                <text x="250" y="160" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">1,6k</text>
              </svg>

              <div className="absolute top-[65px] text-center">
                <div className="text-3xl font-extrabold text-white tracking-tight">{fmtInt(teamAvg)}</div>
                <div className="text-xs font-semibold text-slate-400 mt-0.5">cuboid / ngày công</div>
              </div>
            </div>
          </div>

          {/* 3 Stats below Gauge */}
          <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[#232836]">
            <div className="text-center p-2 rounded-xl bg-[#171b26] border border-[#262c3d]">
              <div className="text-xl font-extrabold text-emerald-400">{summary.cellsExcellent}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">ngày-người ≥ 1.200</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#171b26] border border-[#262c3d]">
              <div className="text-xl font-extrabold text-amber-300">{summary.cellsNormal}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">1.000–1.199</div>
            </div>
            <div className="text-center p-2 rounded-xl bg-[#171b26] border border-[#262c3d]">
              <div className="text-xl font-extrabold text-rose-400">{summary.cellsBelow}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">&lt; 1.000</div>
            </div>
          </div>
        </section>
      </div>

      {/* ★ Điểm nổi bật tuần */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
          <span>★</span> ĐIỂM NỔI BẬT TUẦN
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {summary.highlights.map((h, idx) => {
            const borderColors = [
              'border-l-emerald-500',
              'border-l-blue-500',
              'border-l-rose-500',
              'border-l-amber-500',
            ][idx % 4];

            return (
              <div
                key={idx}
                className={`bg-[#171b26] p-4 rounded-xl border border-[#262c3d] border-l-4 ${borderColors} flex flex-col justify-between`}
              >
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h.label}</div>
                  <div className="text-2xl font-extrabold text-white mt-1">
                    {h.value} <span className="text-xs font-normal text-slate-400">{h.unit}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-200 mt-2">{h.title}</div>
                </div>
                <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">{h.detail}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
