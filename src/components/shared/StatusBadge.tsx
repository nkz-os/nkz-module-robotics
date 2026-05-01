import React from 'react';

type Status = 'ok' | 'warning' | 'critical' | 'info' | 'offline';

const colors: Record<Status, string> = {
  ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const dots: Record<Status, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  info: 'bg-blue-500',
  offline: 'bg-slate-500',
};

export const StatusBadge: React.FC<{ status: Status; label: string; className?: string }> = ({ status, label, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]} ${className}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
    {label}
  </span>
);
