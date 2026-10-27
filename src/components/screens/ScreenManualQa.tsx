import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import { fmtDecimal, fmtInt } from '@shared/format';
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Box,
  Percent,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { apiDownloadTemplate } from '../../api/client';
import { ImportModal } from '../sheets/ImportModal';
import { showToast } from '../../utils/toast';

export function ScreenManualQa() {
  const { user } = useAuth();
  const { report, currentWeekId, refreshReport, setActiveTab, setSelectedSheetKey } = useWeek();
  const [importOpen, setImportOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!report) return null;

  const canEditManualQa = user?.role === 'leader' || user?.role === 'qc';

  const { members, summary } = report;

  // Filter members who have manual QA data or all members
  const membersWithManual = members.filter((m) => !!m.manualQa);
  const sortedMembers = [...membersWithManual].sort(
    (a, b) => (b.manualQa?.totalErrors || 0) - (a.manualQa?.totalErrors || 0),
  );

  const maxErrors = Math.max(...membersWithManual.map((m) => m.manualQa?.totalErrors || 0), 1);

  const handleDownloadTemplate = async () => {
    if (!currentWeekId) return;
    setDownloading(true);
    try {
      await apiDownloadTemplate(currentWeekId, 'manual_qa', 'xlsx');
      showToast.success('Tải file mẫu thành công', 'File mẫu Excel đã được tải về máy.');
    } catch (err) {
      showToast.error('Không thể tải file mẫu', (err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const handleGoToWebSheet = () => {
    setSelectedSheetKey('manual_qa');
    setActiveTab('web_sheets');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header section */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                05
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Chất lượng QA kiểm tra bằng tay (Manual QC)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Tổng hợp và đối chiếu lỗi do QC kiểm tra thủ công trên từng Job. Gồm 2 loại lỗi trọng điểm được mã hóa 2 màu riêng biệt.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
              title="Tải file mẫu Excel điền kết quả kiểm tra thủ công"
            >
              <Download size={14} className={downloading ? 'animate-bounce' : ''} />
              <span>{downloading ? 'Đang tải...' : 'Tải Excel mẫu'}</span>
            </button>

            {canEditManualQa && (
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-purple-600/20"
              >
                <Upload size={14} />
                <span>Import Excel kết quả</span>
              </button>
            )}

            {canEditManualQa && (
              <button
                onClick={handleGoToWebSheet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c2230] hover:bg-[#252d40] text-slate-300 border border-[#2d374d] text-xs font-semibold transition-all"
              >
                <FileSpreadsheet size={14} className="text-emerald-400" />
                <span>Nhập bảng trực tiếp</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Card 1: Tổng Cuboid kiểm tra */}
          <div className="bg-[#161a24] border border-[#232836] rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tổng Cuboid kiểm tra
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">
                {fmtInt(summary.manualTotalChecked)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Quét thủ công bởi QC</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300">
              <Box size={20} />
            </div>
          </div>

          {/* Card 2: Lỗi Bay box / Chìm box (MÀU TÍM) */}
          <div className="bg-[#1b1528] border border-purple-500/30 rounded-xl p-4 flex items-center justify-between relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-300">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Bay box / Chìm box
              </div>
              <div className="text-2xl font-extrabold text-purple-200 mt-1">
                {fmtInt(summary.manualTotalFloating)}
              </div>
              <div className="text-[11px] text-purple-400/80 mt-0.5">Sai cao độ Z so với mặt đất</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
              <Layers size={20} />
            </div>
          </div>

          {/* Card 3: Lỗi Box không ôm sát pointcloud (MÀU CYAN) */}
          <div className="bg-[#0f1d26] border border-cyan-500/30 rounded-xl p-4 flex items-center justify-between relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Không ôm sát pointcloud
              </div>
              <div className="text-2xl font-extrabold text-cyan-200 mt-1">
                {fmtInt(summary.manualTotalLoose)}
              </div>
              <div className="text-[11px] text-cyan-400/80 mt-0.5">Box lỏng / thừa khoảng trống</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-900/40 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-inner">
              <Box size={20} />
            </div>
          </div>

          {/* Card 4: Tỷ lệ lỗi toàn đội */}
          <div className="bg-[#161a24] border border-[#232836] rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tỷ lệ lỗi toàn đội
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">
                {fmtDecimal(summary.manualErrorRate)}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {summary.manualTotalErrors} lỗi / {summary.manualTotalChecked} cuboid
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300">
              <Percent size={20} />
            </div>
          </div>
        </div>
      </section>

      {/* Visual Chart: Defect distribution per annotator (Stacked Purple + Cyan) */}
      {membersWithManual.length > 0 && (
        <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Phân bổ 2 loại lỗi thủ công theo thành viên
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Biểu đồ thanh phân tầng trực quan so sánh tỷ lệ lỗi Bay/Chìm box (Tím) và Không ôm sát pointcloud (Cyan).
              </p>
            </div>
            {/* Color Legend */}
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-500 inline-block shadow-sm shadow-purple-500/50" />
                <span className="text-purple-300">Lỗi bay box / chìm box</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-cyan-500 inline-block shadow-sm shadow-cyan-500/50" />
                <span className="text-cyan-300">Lỗi box không ôm sát pointcloud</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {sortedMembers.map((m) => {
              const q = m.manualQa!;
              const floating = q.floatingBoxCount;
              const loose = q.looseBoxCount;
              const total = q.totalErrors;
              const floatingWidth = maxErrors > 0 ? (floating / maxErrors) * 100 : 0;
              const looseWidth = maxErrors > 0 ? (loose / maxErrors) * 100 : 0;

              return (
                <div key={m.id} className="group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white w-36 truncate">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Job: {q.jobCode || '–'}</span>
                      <span className="text-[10px] text-slate-500">({q.cuboidsChecked} cuboids)</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-purple-300 font-bold">{floating} bay/chìm</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-cyan-300 font-bold">{loose} không ôm</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-200 font-extrabold">{total} lỗi ({fmtDecimal(q.errorRate)}%)</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3.5 bg-[#171b26] rounded-lg overflow-hidden flex border border-[#232836]">
                    {floating > 0 && (
                      <div
                        style={{ width: `${floatingWidth}%` }}
                        className="bg-purple-500 hover:bg-purple-400 transition-all relative group/seg"
                        title={`Bay box / chìm box: ${floating}`}
                      />
                    )}
                    {loose > 0 && (
                      <div
                        style={{ width: `${looseWidth}%` }}
                        className="bg-cyan-500 hover:bg-cyan-400 transition-all relative group/seg"
                        title={`Không ôm sát pointcloud: ${loose}`}
                      />
                    )}
                    {total === 0 && (
                      <div className="w-full flex items-center justify-center text-[9px] text-emerald-400 font-semibold bg-emerald-500/10">
                        0 lỗi · Chuẩn 100%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Inspection Table */}
      <section className="bg-[#12151d] border border-[#232836] rounded-2xl p-6 shadow-md">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Bảng chi tiết kết quả Manual QC theo từng Annotator
          </h3>
          <span className="text-xs text-slate-400">
            {membersWithManual.length} / {members.length} thành viên đã có dữ liệu QC
          </span>
        </div>

        {membersWithManual.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <Info size={32} className="mx-auto text-slate-600" />
            <div className="text-sm">Chưa có kết quả kiểm tra thủ công cho tuần này.</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Bạn có thể tải file mẫu Excel về điền, import file kết quả từ máy tính hoặc bấm "Nhập bảng trực tiếp" để điền online.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleDownloadTemplate}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl"
              >
                Tải Excel mẫu
              </button>
              {canEditManualQa && (
                <button
                  onClick={() => setImportOpen(true)}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl"
                >
                  Import Excel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#232836] text-[11px] text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Annotator</th>
                  <th className="py-3 px-2 text-center">Mã Job</th>
                  <th className="py-3 px-2 text-right">Cuboid soi</th>
                  <th className="py-3 px-3 text-right bg-purple-950/20 text-purple-300 border-x border-purple-900/30">
                    Bay box / Chìm box
                  </th>
                  <th className="py-3 px-3 text-right bg-cyan-950/20 text-cyan-300 border-r border-cyan-900/30">
                    Không ôm sát pointcloud
                  </th>
                  <th className="py-3 px-2 text-right font-bold text-white">Tổng lỗi</th>
                  <th className="py-3 px-2 text-center">Tỷ lệ lỗi</th>
                  <th className="py-3 px-2 text-center">Đánh giá</th>
                  <th className="py-3 px-3">Người QC</th>
                  <th className="py-3 px-3">Ghi chú frame lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2330]">
                {members.map((m) => {
                  const q = m.manualQa;
                  if (!q) {
                    return (
                      <tr key={m.id} className="hover:bg-[#161a24] opacity-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-300">{m.name}</td>
                        <td colSpan={9} className="py-2.5 px-3 text-center text-slate-500 italic">
                          Chưa có dữ liệu Manual QC
                        </td>
                      </tr>
                    );
                  }

                  const isClean = q.totalErrors === 0;
                  const isHigh = q.errorRate > 2.0;

                  return (
                    <tr key={m.id} className="hover:bg-[#161a24] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{m.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                            {m.role}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                        {q.jobCode || '–'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                        {fmtInt(q.cuboidsChecked)}
                      </td>

                      {/* Cột lỗi Bay / Chìm box (TÍM) */}
                      <td className="py-2.5 px-3 text-right font-mono bg-purple-950/10 border-x border-purple-900/20">
                        {q.floatingBoxCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {q.floatingBoxCount}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Cột lỗi Không ôm sát pointcloud (CYAN) */}
                      <td className="py-2.5 px-3 text-right font-mono bg-cyan-950/10 border-r border-cyan-900/20">
                        {q.looseBoxCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            {q.looseBoxCount}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Tổng lỗi */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-white">
                        {q.totalErrors > 0 ? (
                          <span className="text-rose-400 font-bold">{q.totalErrors}</span>
                        ) : (
                          <span className="text-emerald-400">0</span>
                        )}
                      </td>

                      {/* Tỷ lệ lỗi */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold">
                        <span className={isClean ? 'text-emerald-400' : isHigh ? 'text-rose-400' : 'text-amber-300'}>
                          {fmtDecimal(q.errorRate)}%
                        </span>
                      </td>

                      {/* Đánh giá */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {isClean ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 size={11} />
                            Đạt chuẩn
                          </span>
                        ) : isHigh ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <AlertTriangle size={11} />
                            Cần rà soát
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            Đạt có nhắc
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        {q.qcName || '–'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate" title={q.note}>
                        {q.note || '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Total summary footer row */}
              <tfoot>
                <tr className="border-t-2 border-[#2b3244] bg-[#161a24] font-bold text-white">
                  <td className="py-3 px-3">TOÀN ĐỘI</td>
                  <td className="py-3 px-2 text-center text-slate-400">–</td>
                  <td className="py-3 px-2 text-right font-mono text-slate-200">
                    {fmtInt(summary.manualTotalChecked)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-purple-300 bg-purple-950/20 border-x border-purple-900/30">
                    {fmtInt(summary.manualTotalFloating)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-cyan-300 bg-cyan-950/20 border-r border-cyan-900/30">
                    {fmtInt(summary.manualTotalLoose)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-rose-400">
                    {summary.manualTotalErrors}
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-amber-300">
                    {fmtDecimal(summary.manualErrorRate)}%
                  </td>
                  <td className="py-3 px-2 text-center text-slate-400">–</td>
                  <td className="py-3 px-3 text-slate-400">–</td>
                  <td className="py-3 px-3 text-slate-400 text-[11px] font-normal italic">
                    Tổng kết lỗi kiểm tra thủ công tuần
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Import Modal */}
      {currentWeekId && (
        <ImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          weekId={currentWeekId}
          sheetKey="manual_qa"
          onImportSuccess={async () => {
            await refreshReport();
            showToast.success('Import kết quả Manual QA thành công', 'Đã lưu và cập nhật dữ liệu bảng kiểm tra.');
          }}
        />
      )}
    </div>
  );
}
