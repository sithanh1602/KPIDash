import React, { createContext, useContext, useEffect, useState } from 'react';
import type { WeekListItem, WeekReport } from '@shared/types';
import type { SheetKey } from '@shared/sheets';
import { apiGetWeekReport, apiListWeeks } from '../api/client';
import { useAuth } from './AuthContext';

export type AppTab =
  | 'overview' // 01
  | 'daily_kpi' // 02
  | 'ranking' // 03
  | 'quality_qa' // 04 Tool QA
  | 'manual_qa' // 05 QA Manual
  | 'coaching_issue' // 06
  | 'attitude' // 07
  | 'web_sheets' // Nhập liệu trực tiếp bảng Excel trên web
  | 'members'; // Quản lý danh mục thành viên

interface WeekContextType {
  weeks: WeekListItem[];
  currentWeekId: number | null;
  setCurrentWeekId: (id: number) => void;
  report: WeekReport | null;
  loading: boolean;
  error: string | null;
  refreshReport: () => Promise<void>;
  refreshWeeks: () => Promise<void>;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  selectedSheetKey: SheetKey;
  setSelectedSheetKey: (key: SheetKey) => void;
}

const WeekContext = createContext<WeekContextType | null>(null);

export function WeekProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [weeks, setWeeks] = useState<WeekListItem[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<number | null>(null);
  const [report, setReport] = useState<WeekReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [selectedSheetKey, setSelectedSheetKey] = useState<SheetKey>('production');

  const refreshWeeks = async () => {
    if (!user) return;
    try {
      const list = await apiListWeeks();
      setWeeks(list);
      if (list.length > 0 && currentWeekId === null) {
        setCurrentWeekId(list[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const refreshReport = async () => {
    if (!currentWeekId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetWeekReport(currentWeekId);
      setReport(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshWeeks();
    } else {
      setWeeks([]);
      setReport(null);
      setCurrentWeekId(null);
    }
  }, [user]);

  useEffect(() => {
    if (currentWeekId) {
      refreshReport();
    }
  }, [currentWeekId]);

  return (
    <WeekContext.Provider
      value={{
        weeks,
        currentWeekId,
        setCurrentWeekId,
        report,
        loading,
        error,
        refreshReport,
        refreshWeeks,
        activeTab,
        setActiveTab,
        selectedSheetKey,
        setSelectedSheetKey,
      }}
    >
      {children}
    </WeekContext.Provider>
  );
}

export function useWeek() {
  const ctx = useContext(WeekContext);
  if (!ctx) throw new Error('useWeek must be used within WeekProvider');
  return ctx;
}
