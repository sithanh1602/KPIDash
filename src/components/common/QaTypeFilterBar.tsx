import React from 'react';
import { useWeek } from '../../context/WeekContext';
import { QA_TYPES } from '@shared/constants';
import { Filter } from 'lucide-react';

interface QaTypeFilterBarProps {
  label?: string;
  className?: string;
  compact?: boolean;
}

export function QaTypeFilterBar({
  label = 'Chọn loại lỗi tính vào báo cáo:',
  className = '',
  compact = false,
}: QaTypeFilterBarProps) {
  const { selectedQaTypes, setSelectedQaTypes } = useWeek();

  const toggleQaType = (key: string) => {
    if (selectedQaTypes.includes(key)) {
      if (selectedQaTypes.length === 1) return; // Luôn giữ ít nhất 1 loại
      setSelectedQaTypes(selectedQaTypes.filter((k) => k !== key));
    } else {
      setSelectedQaTypes([...selectedQaTypes, key]);
    }
  };

  const selectAllQaTypes = () => {
    setSelectedQaTypes(QA_TYPES.map((t) => t.key));
  };

  const isFiltered = selectedQaTypes.length < QA_TYPES.length;

  return (
    <div
      className={`bg-[#161a24] border border-[#232836] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mr-1 flex items-center gap-1.5 select-none">
          <Filter size={13} className="text-emerald-400" />
          {label}
        </span>
        {QA_TYPES.map((t) => {
          const isChecked = selectedQaTypes.includes(t.key);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => toggleQaType(t.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all select-none cursor-pointer ${
                isChecked
                  ? 'bg-slate-800/90 border-slate-600 text-white shadow-sm hover:border-slate-500'
                  : 'bg-transparent border-[#232836] text-slate-500 hover:text-slate-300 line-through opacity-50'
              }`}
              title={`${isChecked ? 'Đang tính' : 'Đang bỏ qua'} lỗi ${t.short} (${t.label})`}
            >
              <span
                className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                  isChecked
                    ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black'
                    : 'border-slate-600 bg-slate-900/50'
                }`}
              >
                {isChecked ? '✓' : ''}
              </span>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              <span>
                {t.short} {!compact && `(${t.label})`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {isFiltered && (
          <span className="text-amber-400 font-medium text-[11px] bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
            Đang tính {selectedQaTypes.length}/6 loại
          </span>
        )}
        {isFiltered && (
          <button
            type="button"
            onClick={selectAllQaTypes}
            className="text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold underline ml-1 cursor-pointer"
          >
            Chọn tất cả (6/6)
          </button>
        )}
      </div>
    </div>
  );
}
