import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import ActivityFeed, { ActivityItem } from './ActivityFeed';

interface VirtualizedActivityFeedProps {
  items: ActivityItem[];
  height?: number;            // ارتفاع نمای قابل اسکرول
  rowHeight?: number;         // ارتفاع تقریبی هر ردیف (px)
  overscan?: number;          // تعداد ردیف‌های اضافه در بالا/پایین برای کاهش پرش
  className?: string;
  'aria-label'?: string;
}

/**
 * VirtualizedActivityFeed
 * Windowing سبک بدون وابستگی خارجی برای لیست Activity
 * محدودیت‌ها: فرض ارتفاع نزدیک به ثابت؛ برای ردیف‌های بسیار متغیر مناسب نیست.
 */
const VirtualizedActivityFeed: React.FC<VirtualizedActivityFeedProps> = ({
  items,
  height = 300,
  rowHeight = 48,
  overscan = 6,
  className = '',
  'aria-label': ariaLabel = 'فعالیت مجازی'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const total = items.length;
  const totalHeight = total * rowHeight;

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = (e.target as HTMLDivElement).scrollTop;
    setScrollTop(top);
  }, []);

  // محاسبه ایندکس‌ها
  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const viewportCount = Math.ceil(height / rowHeight) + overscan * 2;
    const end = Math.min(total - 1, start + viewportCount - 1);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, rowHeight, height, overscan, total]);

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex + 1), [items, startIndex, endIndex]);
  const topSpacer = startIndex * rowHeight;
  const bottomSpacer = totalHeight - (endIndex + 1) * rowHeight;

  // لاگ سبک برای تحلیل (می‌توان با feature flag خاموش کرد)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('VIRT_WIN', { startIndex, endIndex, total });
    }
  }, [startIndex, endIndex, total]);

  // اگر آیتم کم است virtualization ارزش ندارد
  if (total <= 25) {
    return <ActivityFeed items={items} />;
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className={`relative overflow-auto custom-scrollbar rounded border bg-background ${className}`}
      style={{ height }}
      aria-label={ariaLabel}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ height: topSpacer }} />
        <div className="px-0.5">
          <ActivityFeed items={visibleItems} />
        </div>
        <div style={{ height: bottomSpacer }} />
      </div>
    </div>
  );
};

export default VirtualizedActivityFeed;
