import React from 'react';
import type { AttitudeGrade, Grade, IssueStatus, Priority } from '@shared/types';
import { ATTITUDE_LABEL, GRADE_LABEL } from '@shared/constants';

interface StatusBadgeProps {
  grade?: Grade;
  attitudeGrade?: AttitudeGrade;
  priority?: Priority;
  issueStatus?: IssueStatus;
  children?: React.ReactNode;
  className?: string;
}

export function StatusBadge({ grade, attitudeGrade, priority, issueStatus, children, className = '' }: StatusBadgeProps) {
  if (grade) {
    const styles = {
      excellent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      normal: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      below: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    }[grade];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {GRADE_LABEL[grade]}
      </span>
    );
  }

  if (attitudeGrade && attitudeGrade !== 'none') {
    const styles = {
      excellent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      good: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      fair: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      poor: 'bg-rose-950/40 text-rose-400 border-rose-800/40',
      none: 'bg-slate-800 text-slate-400 border-slate-700',
    }[attitudeGrade];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {ATTITUDE_LABEL[attitudeGrade]}
      </span>
    );
  }

  if (priority) {
    const styles = {
      Cao: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      TB: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      Thấp: 'bg-slate-700/30 text-slate-400 border-slate-600/30',
    }[priority];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {priority}
      </span>
    );
  }

  if (issueStatus) {
    const styles = {
      'Chờ chốt': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      'Tạm thời': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      'Đã chốt': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    }[issueStatus];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {issueStatus}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 ${className}`}>
      {children}
    </span>
  );
}
