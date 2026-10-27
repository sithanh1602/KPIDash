import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  ListTree,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useWeek } from '../../context/WeekContext';
import {
  apiApplyToolQaResult,
  apiDeleteQaFile,
  apiDownloadQaFile,
  apiGetWeekMembers,
  apiListQaFiles,
  apiParseToolQaPreview,
  type QaStoredFile,
  type ToolQaPreviewResponse,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import type { Member } from '@shared/types';
import { QA_TYPES } from '@shared/constants';

interface ToolQaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ToolQaImportModal({ isOpen, onClose, onSuccess }: ToolQaImportModalProps) {
  const { user } = useAuth();
  const { currentWeekId, refreshReport } = useWeek();

  const [members, setMembers] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [storedFiles, setStoredFiles] = useState<QaStoredFile[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');

  // Upload & preview state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ToolQaPreviewResponse | null>(null);
  const [base64Data, setBase64Data] = useState<string>('');

  // Form selections
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [jobCode, setJobCode] = useState('Job_01');
  const [qcName, setQcName] = useState(user?.name || 'Lê Sĩ Thành');
  const [applyCoaching, setApplyCoaching] = useState(true);
  const [applySharedTracks, setApplySharedTracks] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadInitialData = async () => {
    if (!currentWeekId) return;
    try {
      const [membersData, filesData] = await Promise.all([
        apiGetWeekMembers(currentWeekId),
        apiListQaFiles(currentWeekId),
      ]);
      setMembers(membersData);
      setStoredFiles(filesData);
      if (membersData.length > 0 && !selectedMemberId) {
        setSelectedMemberId(membersData[0].id);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      setSubmitSuccess(null);
      setParseError(null);
    }
  }, [isOpen, currentWeekId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWeekId) return;

    setSelectedFile(file);
    setParsing(true);
    setParseError(null);
    setSubmitSuccess(null);
    setPreview(null);

    // Tự động gợi ý job code theo tên file
    const cleanJob = file.name.replace(/\.[^/.]+$/, '');
    setJobCode(cleanJob);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const b64 = (evt.target?.result as string).split(',')[1];
          setBase64Data(b64);
          const res = await apiParseToolQaPreview(currentWeekId, file.name, b64);
          setPreview(res);
          showToast.success('Phân tích file Tool QA thành công', `Đã tìm thấy ${res.parsed.cuboids} cuboids và ${res.parsed.totalWarnings} cảnh báo.`);
          if (res.suggestedMemberId) {
            setSelectedMemberId(res.suggestedMemberId);
          }
        } catch (err) {
          const msg = (err as Error).message;
          setParseError(msg);
          showToast.error('Lỗi phân tích file Tool QA', msg);
        } finally {
          setParsing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const msg = (err as Error).message;
      setParseError(msg);
      showToast.error('Không thể đọc file', msg);
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentWeekId || !preview || !selectedMemberId || !selectedFile) return;

    setSubmitting(true);
    setParseError(null);
    try {
      await apiApplyToolQaResult(currentWeekId, {
        memberId: selectedMemberId,
        jobCode: jobCode.trim() || 'Job_01',
        qcName: qcName.trim() || 'Leader',
        fileName: selectedFile.name,
        fileBase64: base64Data,
        metrics: preview.parsed,
        applyToCoaching: applyCoaching,
        applyToSharedTracks: applySharedTracks,
      });

      setSubmitSuccess('Đã tổng hợp thành công kết quả Tool QA và lưu trữ sheet gốc!');
      showToast.success('Áp dụng kết quả Tool QA thành công', 'Đã lưu trữ file sheet gốc và tự động cập nhật thống kê.');
      await refreshReport();
      await loadInitialData();
      if (onSuccess) onSuccess();

      // Reset file selection
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      const msg = (err as Error).message;
      setParseError(msg);
      showToast.error('Không thể áp dụng kết quả', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHistory = async (fileId: number) => {
    if (!currentWeekId) return;
    try {
      await apiDeleteQaFile(currentWeekId, fileId);
      showToast.success('Đã xóa file lưu trữ', 'File sheet đã được xóa khỏi danh sách.');
      await loadInitialData();
    } catch (err) {
      showToast.error('Không thể xóa file', (err as Error).message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Báo cáo Tool QA (Datumaro 3D Quality Report)"
      subtitle="Tự động bóc tách số liệu chất lượng, phân tích lỗi hay gặp và lưu trữ sheet gốc."
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#232836]">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload size={14} /> Tải file & Bóc tách số liệu
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet size={14} /> File gốc đã lưu trữ ({storedFiles.length})
          </button>
        </div>

        {submitSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{submitSuccess}</span>
          </div>
        )}

        {parseError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{parseError}</span>
          </div>
        )}

        {activeTab === 'upload' ? (
          <div className="space-y-4">
            {/* Step 1: File Upload Drop Area */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Chọn file báo cáo Tool QA (.xlsx / .csv)
              </label>
              <div className="border-2 border-dashed border-[#282f42] hover:border-emerald-500/50 rounded-2xl p-6 text-center cursor-pointer bg-[#10131a] transition-all relative">
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                    {parsing ? <RefreshCw size={22} className="animate-spin" /> : <FileSpreadsheet size={22} />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">
                      {selectedFile ? selectedFile.name : 'Kéo thả hoặc bấm để chọn file Tool QA'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : 'Hỗ trợ định dạng Datumaro Excel (.xlsx) với các tab Summary, Matrix, By_Track'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Parsed Preview & Member Selection */}
            {preview && (
              <div className="p-4 rounded-2xl bg-[#141824] border border-[#262c3d] space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-[#232836] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Kết quả bóc tách tự động
                    </span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    {preview.parsed.cuboids.toLocaleString()} Cuboid · {preview.parsed.totalWarnings} Cảnh báo ({preview.parsed.warningPercent}%)
                  </span>
                </div>

                {/* Grid warning metrics */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  {QA_TYPES.map((t) => {
                    const count = preview.parsed[t.key as keyof typeof preview.parsed] as number;
                    return (
                      <div key={t.key} className="p-2 rounded-xl bg-[#10131a] border border-[#232836]">
                        <div className="text-[10px] font-bold" style={{ color: t.color }}>
                          {t.short} ({t.label})
                        </div>
                        <div className="text-base font-extrabold text-white mt-0.5">{count || 0}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Risk Distribution */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#10131a] border border-[#232836]">
                  <span className="text-slate-400 font-semibold">Phân loại rủi ro theo Track:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-rose-400 font-bold">• Cao: {preview.parsed.riskHigh}</span>
                    <span className="text-amber-400 font-semibold">• TB: {preview.parsed.riskMid}</span>
                    <span className="text-emerald-400 font-medium">• Thấp: {preview.parsed.riskLow}</span>
                  </div>
                </div>

                {/* Configuration: Owner & Job */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
                      <User size={13} className="text-emerald-400" />
                      <span>Chủ nhân kết quả Anno</span>
                    </label>
                    <select
                      value={selectedMemberId || ''}
                      onChange={(e) => setSelectedMemberId(Number(e.target.value))}
                      className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#10131a]">
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mã Job kiểm tra</label>
                    <input
                      type="text"
                      value={jobCode}
                      onChange={(e) => setJobCode(e.target.value)}
                      placeholder="Ví dụ: Job_01"
                      className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Người thực hiện QC</label>
                    <input
                      type="text"
                      value={qcName}
                      onChange={(e) => setQcName(e.target.value)}
                      placeholder="Tên QC..."
                      className="w-full bg-[#10131a] border border-[#232836] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Auto synthesis checkboxes */}
                <div className="space-y-2 pt-2 border-t border-[#232836]">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyCoaching}
                      onChange={(e) => setApplyCoaching(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-200">
                        Tự động tổng hợp "Lỗi hay gặp" & đề xuất đào tạo vào Tab Coaching (Screen 05)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        Nhóm lỗi chính đề xuất: <span className="text-amber-300 font-semibold">{preview.parsed.suggestedCoaching.focusTags}</span>
                      </p>
                    </div>
                  </label>

                  {preview.parsed.highRiskTracks.length > 0 && (
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applySharedTracks}
                        onChange={(e) => setApplySharedTracks(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4 mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-200">
                          Tự động thêm {preview.parsed.highRiskTracks.length} track rủi ro cao vào "Lỗi chung cả nhóm" (Screen 04)
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          Ví dụ: {preview.parsed.highRiskTracks.slice(0, 3).map((t) => `${t.trackNo} (${t.totalIssues} lỗi)`).join(', ')}...
                        </p>
                      </div>
                    </label>
                  )}
                </div>

                {/* Submit action */}
                <div className="flex justify-end gap-2 pt-3 border-t border-[#232836]">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !selectedMemberId}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20"
                  >
                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{submitting ? 'Đang tổng hợp...' : 'Xác nhận tổng hợp & Lưu sheet'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Tab History: Saved Tool QA Files */
          <div className="space-y-3">
            <div className="text-xs text-slate-400">
              Toàn bộ file báo cáo Tool QA gốc được lưu trữ nguyên vẹn để đối soát và tải về lại bất cứ lúc nào.
            </div>

            {storedFiles.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border border-[#232836] rounded-xl bg-[#10131a]">
                Chưa có file Tool QA nào được lưu cho tuần này.
              </div>
            ) : (
              <div className="border border-[#232836] rounded-xl overflow-hidden bg-[#10131a] divide-y divide-[#1e2330]">
                {storedFiles.map((f) => (
                  <div key={f.id} className="p-3 flex items-center justify-between gap-3 hover:bg-[#161a24] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-800 text-emerald-400">
                        <FileSpreadsheet size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs">{f.file_name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Chủ nhân: <strong className="text-slate-200">{f.member_name}</strong></span>
                          <span>•</span>
                          <span>{(f.file_size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{new Date(f.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => currentWeekId && apiDownloadQaFile(currentWeekId, f.id, f.file_name)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#171b26] hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-[#262c3d] transition-colors"
                        title="Tải lại file Excel gốc"
                      >
                        <Download size={13} /> Tải file gốc
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(f.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Xóa file lưu trữ"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
