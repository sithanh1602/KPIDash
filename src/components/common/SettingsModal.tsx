import React, { useEffect, useState } from 'react';
import { Check, Globe, Moon, Sun, Type } from 'lucide-react';
import { Modal } from './Modal';
import { showToast } from '../../utils/toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('app_theme') as 'dark' | 'light') || 'dark';
  });
  const [lang, setLang] = useState<'vi' | 'en'>(() => {
    return (localStorage.getItem('app_lang') as 'vi' | 'en') || 'vi';
  });

  const handleSelectTheme = (mode: 'dark' | 'light') => {
    setTheme(mode);
    localStorage.setItem('app_theme', mode);
    if (mode === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    showToast.info('Giao diện hiển thị', mode === 'dark' ? 'Đã kích hoạt chế độ Tối' : 'Đã kích hoạt chế độ Sáng');
  };

  const handleSelectLang = (l: 'vi' | 'en') => {
    setLang(l);
    localStorage.setItem('app_lang', l);
    showToast.info('Ngôn ngữ', l === 'vi' ? 'Đã chọn Tiếng Việt' : 'Language set to English');
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cài đặt hệ thống (Settings)"
      subtitle="Tùy chỉnh giao diện hiển thị sáng/tối và ngôn ngữ sử dụng."
    >
      <div className="space-y-5">
        {/* Theme Settings */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
            <span>Giao diện hiển thị (Theme)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                theme === 'dark'
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-800 text-emerald-400">
                  <Moon size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Chế độ Tối</div>
                  <div className="text-[10px] text-slate-400">Dark Mode (Mặc định)</div>
                </div>
              </div>
              {theme === 'dark' && <Check size={16} className="text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                theme === 'light'
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Sun size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Chế độ Sáng</div>
                  <div className="text-[10px] text-slate-400">Light Mode</div>
                </div>
              </div>
              {theme === 'light' && <Check size={16} className="text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Language Settings */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
            <Globe size={14} />
            <span>Ngôn ngữ hiển thị (Language)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSelectLang('vi')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                lang === 'vi'
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>🇻🇳 Tiếng Việt</span>
                </div>
                <div className="text-[10px] text-slate-400">Giao diện tiếng Việt chuẩn</div>
              </div>
              {lang === 'vi' && <Check size={16} className="text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => handleSelectLang('en')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                lang === 'en'
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-[#10131a] border-[#232836] hover:border-slate-700'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>🇺🇸 English</span>
                </div>
                <div className="text-[10px] text-slate-400">English Interface</div>
              </div>
              {lang === 'en' && <Check size={16} className="text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Typography note */}
        <div className="p-3 bg-[#151922] border border-[#232836] rounded-xl flex items-center gap-2.5 text-xs text-slate-300">
          <Type size={16} className="text-emerald-400 shrink-0" />
          <span>Kiểu chữ hệ thống đã được thiết lập mặc định sang phông chữ <strong>Arial</strong> chuẩn.</span>
        </div>

        <div className="flex justify-end pt-2 border-t border-[#232836]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-md shadow-emerald-500/20"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}
