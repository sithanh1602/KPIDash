import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toast } from '@heroui/react';
import { showToast } from './utils/toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WeekProvider, useWeek } from './context/WeekContext';
import { Navbar } from './components/layout/Navbar';
import { TabNav } from './components/layout/TabNav';
import { Screen1Overview } from './components/screens/Screen1Overview';
import { Screen2DailyKpi } from './components/screens/Screen2DailyKpi';
import { Screen3Ranking } from './components/screens/Screen3Ranking';
import { Screen4QaQuality } from './components/screens/Screen4QaQuality';
import { ScreenManualQa } from './components/screens/ScreenManualQa';
import { Screen5Coaching } from './components/screens/Screen5Coaching';
import { Screen6Attitude } from './components/screens/Screen6Attitude';
import { WebExcelGrid } from './components/sheets/WebExcelGrid';
import { MembersManager } from './components/members/MembersManager';
import { ExportModal } from './components/exports/ExportModal';
import type { ReportSectionKey } from '@shared/report-sections';
import { AlertCircle, LogIn } from 'lucide-react';
import { RubikLogo } from './components/common/RubikLogo';
import './styles.css';

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      showToast.success('Đăng nhập thành công', 'Chào mừng bạn quay trở lại!');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Đăng nhập thất bại', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0d12] relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#12151d] rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <RubikLogo size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">ADAS — KPI Dashboard</h1>
          <p className="text-xs text-slate-400">
            Hệ thống quản lý hiệu suất & chất lượng 3D LiDAR (Adas T012)
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email đăng nhập</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#171b26] border border-[#262c3d] rounded-none px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#171b26] border border-[#262c3d] rounded-none px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-none transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 pt-3"
          >
            {loading ? (
              'Đang đăng nhập...'
            ) : (
              <>
                <LogIn size={16} /> Đăng nhập hệ thống
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardApp() {
  const { user, loading: authLoading } = useAuth();
  const { activeTab, report, loading: reportLoading, currentWeekId } = useWeek();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [printSections, setPrintSections] = useState<ReportSectionKey[] | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] text-slate-400 text-xs">
        Đang khởi động phiên làm việc...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handlePrintPdf = (sections: ReportSectionKey[]) => {
    setPrintSections(sections);
    setTimeout(() => {
      window.print();
      setPrintSections(null);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#0b0d12] text-slate-100 flex flex-col">
      {/* Navbar & TabNav */}
      <Navbar onOpenExport={() => setExportModalOpen(true)} />
      <TabNav />

      {/* Main Container */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {reportLoading ? (
          <div className="py-24 text-center text-slate-500 text-sm">
            <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <div>Đang tính toán số liệu tuần...</div>
          </div>
        ) : !report && activeTab !== 'members' ? (
          <div className="py-24 text-center text-slate-400 text-sm">
            Chưa có báo cáo cho tuần này. Vui lòng chọn tuần hoặc tạo tuần mới.
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <Screen1Overview />}
            {activeTab === 'daily_kpi' && <Screen2DailyKpi />}
            {activeTab === 'ranking' && <Screen3Ranking />}
            {activeTab === 'quality_qa' && <Screen4QaQuality />}
            {activeTab === 'manual_qa' && <ScreenManualQa />}
            {activeTab === 'coaching_issue' && <Screen5Coaching />}
            {activeTab === 'attitude' && <Screen6Attitude />}
            {activeTab === 'web_sheets' && <WebExcelGrid />}
            {activeTab === 'members' && <MembersManager />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1c202b] bg-[#0e1117] py-6 px-4 text-center text-xs text-slate-500 no-print">
        <div>
          ADAS KPI — {report?.week.orgName || 'ADAS'} · {report?.week.teamName || 'Adas T012'} ({report?.week.discipline || '3D LiDAR'})
        </div>
        <div className="text-[11px] text-slate-600 mt-1">
          Hệ thống theo dõi hiệu suất, nâng cao chất lượng & phát triển đội ngũ.
        </div>
      </footer>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        weekId={currentWeekId}
        startDate={report?.week.startDate}
        onPrintPdf={handlePrintPdf}
      />

      {/* Hidden container specifically for clean window.print() PDF generation */}
      {printSections && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-8 z-[9999]">
          {printSections.includes('overview') && (
            <div className="print-page-break mb-8">
              <Screen1Overview />
            </div>
          )}
          {printSections.includes('kpi') && (
            <div className="print-page-break mb-8">
              <Screen2DailyKpi />
            </div>
          )}
          {printSections.includes('ranking') && (
            <div className="print-page-break mb-8">
              <Screen3Ranking />
            </div>
          )}
          {printSections.includes('quality') && (
            <div className="print-page-break mb-8">
              <Screen4QaQuality />
            </div>
          )}
          {printSections.includes('manual_qa') && (
            <div className="print-page-break mb-8">
              <ScreenManualQa />
            </div>
          )}
          {printSections.includes('coaching') && (
            <div className="print-page-break mb-8">
              <Screen5Coaching />
            </div>
          )}
          {printSections.includes('attitude') && (
            <div className="print-page-break">
              <Screen6Attitude />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <>
        <Toast.Provider placement="bottom end" />
        <AuthProvider>
          <WeekProvider>
            <DashboardApp />
          </WeekProvider>
        </AuthProvider>
      </>
    </React.StrictMode>,
  );
}
