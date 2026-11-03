import React from 'react';
import { useWeek, type AppTab } from '../../context/WeekContext';
import { useAuth } from '../../context/AuthContext';
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  HeartHandshake,
  LayoutDashboard,
  ShieldAlert,
  Trophy,
  ClipboardCheck,
} from 'lucide-react';
import { WeekSelector } from './WeekSelector';

const BASE_SCREENS = [
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
  const { user } = useAuth();
  const isLeader = user?.role === 'leader';

  // Chỉ hiển thị tab "Báo cáo ngày" cho Leader
  const screens = React.useMemo(() => {
    if (isLeader) {
      return [
        ...BASE_SCREENS,
        { key: 'daily_report' as AppTab, num: '08', title: 'Báo cáo ngày', icon: CalendarDays },
      ];
    }
    return BASE_SCREENS;
  }, [isLeader]);

  return (
    <nav className="border-b border-[#232836] bg-[#10131a]/80 backdrop-blur-sm sticky top-16 z-30 no-print">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-2">
          {/* Tabs list */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {screens.map((s) => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              const isSpecial = s.key === 'daily_report';
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveTab(s.key)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    isActive
                      ? isSpecial
                        ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                        : 'bg-slate-200 text-slate-900 shadow-md font-bold'
                      : isSpecial
                      ? 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#161922]'
                  }`}
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isActive
                        ? 'bg-slate-900/15 text-slate-900 font-extrabold'
                        : isSpecial
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s.num}
                  </span>
                  <Icon size={14} className={isActive ? 'text-slate-900' : isSpecial ? 'text-amber-300' : 'text-slate-400'} />
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>

          {/* Week selector aligned to the right */}
          <div className="shrink-0 pl-2 border-l border-[#232836]/60">
            {activeTab === 'daily_report' ? (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#161922] border border-amber-500/20 rounded-xl text-xs text-amber-300 font-medium">
                <CalendarDays size={13} />
                <span>Chế độ báo cáo ngày độc lập</span>
              </div>
            ) : (
              <WeekSelector />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
