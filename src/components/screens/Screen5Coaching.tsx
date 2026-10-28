import React from 'react';
import { useWeek } from '../../context/WeekContext';
import { QA_TYPES } from '@shared/constants';
import { filterMemberCoaching, getMemberDynamicRiskAndInsight } from '@shared/qa';
import { StatusBadge } from '../common/Badge';
import { QaTypeFilterBar } from '../common/QaTypeFilterBar';

export function Screen5Coaching() {
  const { report, selectedQaTypes } = useWeek();
  if (!report) return null;

  const { week, members, issues, tracks } = report;
  const isFiltered = selectedQaTypes.length < QA_TYPES.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 05 Lỗi hay gặp & đề xuất training */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">05</span>
            <h2 className="text-lg font-bold text-white tracking-tight">Lỗi hay gặp & đề xuất training</h2>
          </div>
          {isFiltered && (
            <span className="text-xs text-amber-400 font-mono">
              (Đồng bộ theo {selectedQaTypes.length}/6 loại lỗi đang chọn)
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Từ tool QA 7 job + case khó trong Daily. Lỗi hay gặp, tag trọng tâm và training tự động đồng bộ theo loại lỗi đang tích chọn.
        </p>

        <QaTypeFilterBar className="mb-6" label="Lọc lỗi phân tích & training:" />

        {/* 7 Members Coaching Cards + 1 Ghi chú số liệu Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((m) => {
            const coaching = filterMemberCoaching(m.coaching, selectedQaTypes);
            const { riskHigh } = getMemberDynamicRiskAndInsight(m, selectedQaTypes, tracks);

            const circleColor =
              m.kpiPercent >= 110
                ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                : m.kpiPercent >= 90
                ? 'border-amber-400/40 text-amber-300 bg-amber-500/10'
                : 'border-rose-400/40 text-rose-400 bg-rose-500/10';

            return (
              <div
                key={m.id}
                className="bg-[#171b26] border border-[#262c3d] rounded-2xl p-4 flex flex-col justify-between text-xs space-y-3"
              >
                <div>
                  {/* Top info */}
                  <div className="flex items-start gap-3 pb-3 border-b border-[#232836]">
                    <div
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 ${circleColor}`}
                    >
                      {m.kpiPercent}%
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{m.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {m.grade === 'excellent' ? 'Xuất sắc' : m.grade === 'normal' ? 'Bình thường' : 'Dưới KPI'} · {riskHigh} track rủi ro · QC {m.qa?.qcName || '–'}
                      </div>
                    </div>
                  </div>

                  {/* Focus Tags */}
                  {coaching.focusTags && (
                    <div className="mt-2.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {coaching.focusTags}
                      </span>
                    </div>
                  )}

                  {/* Style */}
                  {m.coaching?.style && (
                    <div className="mt-3">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PHONG CÁCH</div>
                      <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{m.coaching.style}</div>
                    </div>
                  )}

                  {/* Common Errors */}
                  <div className="mt-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>LỖI HAY GẶP</span>
                      {isFiltered && <span className="text-[9px] text-amber-400 font-normal lowercase">(đã tính lại %)</span>}
                    </div>
                    {coaching.commonErrors.length > 0 ? (
                      <ul className="text-[11px] text-slate-300 mt-0.5 space-y-1 list-disc list-inside leading-relaxed">
                        {coaching.commonErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic mt-0.5">
                        Không có cảnh báo thuộc các loại lỗi đang chọn.
                      </div>
                    )}
                  </div>

                  {/* Training */}
                  <div className="mt-3">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">TRAINING</div>
                    {coaching.training.length > 0 ? (
                      <ul className="text-[11px] text-emerald-200/90 mt-0.5 space-y-1 list-disc list-inside leading-relaxed">
                        {coaching.training.map((tr, i) => (
                          <li key={i}>{tr}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[11px] text-emerald-400/80 italic mt-0.5">
                        Duy trì kỹ năng hiện tại, không có lỗi cần training thêm.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Ghi chú số liệu box */}
          <div className="bg-[#151922] border border-[#282f42] rounded-2xl p-4 flex flex-col justify-between text-xs">
            <div>
              <div className="font-extrabold text-white text-xs uppercase tracking-wider mb-2">
                GHI CHÚ SỐ LIỆU
              </div>
              <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line space-y-2">
                {week.dataNotes || 'Chưa có ghi chú số liệu cho tuần này. Bạn có thể cập nhật trong phần nhập liệu.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ISSUE ĐANG MỞ */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <h2 className="text-base font-bold text-white tracking-tight uppercase">
            ISSUE ĐANG MỞ · {issues.length}
          </h2>
          <span className="text-xs text-slate-400">
            Đã chốt 6 issue: ISS-02, ISS-06, ISS-08, ISS-09, ISS-10, ISS-11.
          </span>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-2">Người báo</th>
                <th className="py-2.5 px-3">Vấn đề</th>
                <th className="py-2.5 px-3">Phương án tạm</th>
                <th className="py-2.5 px-3">Bước tiếp</th>
                <th className="py-2.5 px-2 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2330]">
              {issues.map((i) => (
                <tr key={i.id} className="hover:bg-[#161a24] transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">{i.code}</td>
                  <td className="py-3 px-2 text-slate-300 whitespace-nowrap">{i.reporter}</td>
                  <td className="py-3 px-3 text-white text-xs font-medium leading-relaxed">{i.title}</td>
                  <td className="py-3 px-3 text-slate-300 text-xs leading-relaxed">{i.interim || '–'}</td>
                  <td className="py-3 px-3 text-slate-300 text-xs leading-relaxed">{i.nextStep || '–'}</td>
                  <td className="py-3 px-2 text-center whitespace-nowrap">
                    <StatusBadge issueStatus={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
