import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  loading?: boolean;
  trend?: { value: number; direction: 'up' | 'down' | 'flat' };
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, description, loading, trend }) => {
  return (
    <div
      className={cn('rounded-lg border bg-card text-card-foreground p-4 flex flex-col gap-2 relative overflow-hidden min-h-[120px]')}
      aria-label={`شاخص ${title}${!loading && typeof value === 'string' ? ' مقدار ' + value : ''}`}
      role="group"
    >
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {loading ? (
        <div className="h-6 w-20 animate-pulse rounded bg-muted" />
      ) : (
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      )}
      {description && <div className="text-[11px] text-muted-foreground leading-relaxed">{description}</div>}
      {trend && (
        <div className="text-[11px] mt-auto">
          {trend.direction === 'up' && <span className="text-emerald-500">▲ {trend.value}%</span>}
          {trend.direction === 'down' && <span className="text-red-500">▼ {trend.value}%</span>}
          {trend.direction === 'flat' && <span className="text-gray-400">— {trend.value}%</span>}
        </div>
      )}
    </div>
  );
};

export default StatCard;
