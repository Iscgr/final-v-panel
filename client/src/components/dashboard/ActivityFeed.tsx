import React from 'react';

// رنگ‌بندی معنایی Badge بر اساس نوع رویداد
const typeBadgeClass: Record<ActivityItem['type'], string> = {
  invoice_created: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  invoice_updated: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
  invoice_deleted: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
  system_error: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
};

export interface ActivityItem {
  id: string;
  type: 'invoice_created' | 'invoice_updated' | 'invoice_deleted' | 'system_error';
  actor?: string;
  at: string; // ISO timestamp
  meta?: Record<string, any>;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
}

const typeLabel: Record<ActivityItem['type'], string> = {
  invoice_created: 'ایجاد فاکتور',
  invoice_updated: 'ویرایش فاکتور',
  invoice_deleted: 'حذف فاکتور',
  system_error: 'خطای سیستم'
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ items, loading }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }
  if (!items.length) {
    return <div className="text-xs text-muted-foreground">رویدادی ثبت نشده است.</div>;
  }
  return (
    <ul className="space-y-3 text-xs leading-relaxed" aria-label="لیست فعالیت‌های اخیر">
      {items.map(item => {
        const timeLabel = new Date(item.at).toLocaleString('fa-IR');
        const badgeClass = typeBadgeClass[item.type];
        return (
          <li
            key={item.id}
            className="flex items-start gap-2"
            aria-label={`رویداد: ${typeLabel[item.type]} توسط ${item.actor || 'سیستم'} در ${timeLabel}`}
          >
            <span
              className={`inline-flex min-w-20 items-center justify-center rounded border px-2 py-0.5 text-[10px] font-medium tracking-tight ${badgeClass}`}
              role="status"
              aria-label={typeLabel[item.type]}
            >
              {typeLabel[item.type]}
            </span>
            <div className="flex-1">
              <div className="font-medium text-foreground">{item.actor || 'سیستم'}</div>
              <div className="text-muted-foreground" aria-label={`زمان رویداد ${timeLabel}`}>{timeLabel}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default ActivityFeed;
