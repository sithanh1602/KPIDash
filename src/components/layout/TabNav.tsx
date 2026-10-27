import React from 'react';
import { useWeek, type AppTab } from '../../context/WeekContext';
import {
  Activity,
  BarChart3,
  BookOpen,
  HeartHandshake,
  LayoutDashboard,
  ShieldAlert,
  Trophy,
  ClipboardCheck,
} from 'lucide-react';
import { WeekSelector } from './WeekSelector';

const SCREENS = [
  { key: 'overview' as AppTab, num: '01', title: 'Tổng quan', icon: LayoutDashboard },
  { key: 'daily_kpi' as AppTab, num: '02', title: 'KPI theo ngày', icon: BarChart3 },
  { key: 'ranking' as AppTab, num: '03', title: 'Bảng xếp hạng', icon: Trophy },
  { key: 'quality_qa' as AppTab, num: '04', title: 'Tool QA', icon: ShieldAlert },
  { key: 'manual_qa' as AppTab, num: '05', title: 'QA Manual', icon: ClipboardCheck },
  { key: 'coaching_issue' as AppTab, num: '06', title: 'Coaching & Issue', icon: BookOpen },
  { key: 'attitude' as AppTab, num: '07', title: 'Attitude', icon: HeartHandshake },
];

export function TabNav() {
  const { activeTab, setActiveTab } = useWeek();

  return (
    <nav className="border-b border-[#232836] bg-[#10131a]/80 backdrop-blur-sm sticky top-16 z-30 no-print">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-2">
          {/* Tabs list */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {SCREENS.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    isActive
                      ? 'bg-slate-200 text-slate-900 shadow-md font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#161922]'
                  }`}
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive ? 'bg-slate-900/15 text-slate-900 font-extrabold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s.num}
                  </span>
                  <Icon size={14} className={isActive ? 'text-slate-900' : 'text-slate-400'} />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>

          {/* Week selector aligned to the right */}
          <div className="shrink-0 pl-2 border-l border-[#232836]/60">
            <WeekSelector />
          </div>
        </div>
      </div>
    </nav>
  );
}
