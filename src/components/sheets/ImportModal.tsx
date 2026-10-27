import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { apiDownloadTemplate, apiImportSheet } from '../../api/client';
import { Modal } from '../common/Modal';
import { SHEETS, type SheetKey } from '@shared/sheets';
import type { ImportResult, SheetRow } from '@shared/types';
import { showToast } from '../../utils/toast';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekId: number;
  sheetKey: SheetKey;
  onImportSuccess: (rows: SheetRow[]) => void;
}

export function ImportModal({ isOpen, onClose, weekId, sheetKey, onImportSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingExt, setDownloadingExt] = useState<'xlsx' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleDownload = async (ext: 'xlsx' | 'csv') => {
    setDownloadingExt(ext);
    setError(null);
    try {
      await apiDownloadTemplate(weekId, sheetKey, ext);
      showToast.success('Tải file mẫu thành công', `Đã tải mẫu .${ext} cho bảng "${def.label}"`);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Không thể tải file mẫu', msg);
    } finally {
      setDownloadingExt(null);
    }
  };

  const def = SHEETS[sheetKey];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
      );
      const res = await apiImportSheet(weekId, sheetKey, file.name, base64);
      setResult(res);
      showToast.success('Đọc file thành công', `Đã phân tích ${res.rows.length} dòng dữ liệu.`);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Lỗi phân tích file', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result || result.rows.length === 0) return;
    onImportSuccess(result.rows);
    showToast.success('Nạp dữ liệu thành công', `Đã áp dụng ${result.rows.length} dòng vào bảng tính.`);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Import file cho bảng: ${def.label}`}
      subtitle="Chấp nhận file .xlsx hoặc .csv theo mẫu chuẩn của hệ thống."
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-slate-300">
        {/* Step 1: Download Template */}
        <div className="p-4 rounded-xl bg-[#171b26] border border-[#262c3d] flex items-center justify-between gap-4">
          <div>
            <div className="font-bold text-white text-sm">Chưa có file mẫu?</div>
            <div className="text-slate-400 mt-0.5">
              Tải file mẫu có sẵn tên thành viên và cột theo tuần hiện tại.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleDownload('xlsx')}
              disabled={downloadingExt === 'xlsx'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold disabled:opacity-50"
            >
              <Download size={14} className={downloadingExt === 'xlsx' ? 'animate-bounce' : ''} />
              {downloadingExt === 'xlsx' ? 'Đang tải...' : 'Mẫu .xlsx'}
            </button>
            <button
              type="button"
              onClick={() => handleDownload('csv')}
              disabled={downloadingExt === 'csv'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold disabled:opacity-50"
            >
              <Download size={14} className={downloadingExt === 'csv' ? 'animate-bounce' : ''} />
              {downloadingExt === 'csv' ? 'Đang tải...' : 'Mẫu .csv'}
            </button>
          </div>
        </div>

        {/* Step 2: Upload File */}
        <div className="space-y-2">
          <label className="block font-semibold text-slate-200">Chọn file từ máy tính</label>
          <div className="border-2 border-dashed border-[#282f42] hover:border-slate-500 rounded-xl p-6 text-center cursor-pointer bg-[#141824] transition-colors relative">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileSpreadsheet size={32} className="mx-auto text-emerald-400 mb-2" />
            <div className="text-sm font-bold text-white">{file ? file.name : 'Kéo thả hoặc nhấn để chọn file'}</div>
            <div className="text-slate-400 text-[11px] mt-1">Hỗ trợ định dạng .xlsx, .csv (tối đa 5 MB)</div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Preview Results */}
        {result && (
          <div className="space-y-3 pt-2 border-t border-[#232836]">
            <div className="flex items-center justify-between">
              <div className="font-bold text-white text-sm">Kết quả kiểm tra dữ liệu:</div>
              <div className="text-xs">
                <span className="text-emerald-400 font-bold">{result.rows.length}</span> dòng hợp lệ
                {result.errors.length > 0 && (
                  <span className="text-rose-400 font-bold ml-2">({result.errors.length} lỗi)</span>
                )}
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                {result.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((err, i) => (
                  <div key={i}>
                    • <strong>Dòng {err.line}:</strong> {err.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#232836]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
          >
            Đóng
          </button>
          {!result ? (
            <button
              type="button"
              disabled={!file || loading}
              onClick={handleUpload}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Upload size={14} />
              {loading ? 'Đang đọc...' : 'Kiểm tra file'}
            </button>
          ) : (
            <button
              type="button"
              disabled={result.rows.length === 0}
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 size={14} />
              Áp dụng {result.rows.length} dòng vào bảng
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
