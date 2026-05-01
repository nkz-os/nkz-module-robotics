import React from 'react';

type Status = 'ok' | 'warning' | 'critical' | 'info' | 'offline';

const colors: Record<Status, string> = {
  ok: 'bg-[color:var(--nkz-ok)]/20 text-[color:var(--nkz-ok)] border-[color:var(--nkz-ok)]/30',
  warning: 'bg-[color:var(--nkz-warning)]/20 text-[color:var(--nkz-warning)] border-[color:var(--nkz-warning)]/30',
  critical: 'bg-[color:var(--nkz-critical)]/20 text-[color:var(--nkz-critical)] border-[color:var(--nkz-critical)]/30',
  info: 'bg-[color:var(--nkz-info)]/20 text-[color:var(--nkz-info)] border-[color:var(--nkz-info)]/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const dots: Record<Status, string> = {
  ok: 'bg-[color:var(--nkz-ok)]',
  warning: 'bg-[color:var(--nkz-warning)]',
  critical: 'bg-[color:var(--nkz-critical)]',
  info: 'bg-[color:var(--nkz-info)]',
  offline: 'bg-slate-500',
};

export const StatusBadge: React.FC<{ status: Status; label: string; className?: string }> = ({ status, label, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]} ${className}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
    {label}
  </span>
);
