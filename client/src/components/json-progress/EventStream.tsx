import React, { useEffect, useRef } from 'react';
import { ProcessingEvent } from './types';

interface EventStreamProps { events: ProcessingEvent[]; }

export const EventStream: React.FC<EventStreamProps> = ({ events }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events]);
  return (
    <div className="json-progress-events" aria-label="رویدادهای پردازش">
      <div ref={ref} className="jp-events-scroll">
        {events.length === 0 && <div className="jp-event jp-empty">رویدادی ثبت نشده</div>}
        {events.map(ev => (
          <div key={ev.id} className={`jp-event jp-${ev.kind}`}>
            <span className="jp-event-time">{new Date(ev.ts).toLocaleTimeString('fa-IR',{hour12:false})}</span>
            <span className="jp-event-label">{ev.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
