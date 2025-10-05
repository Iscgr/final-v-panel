import React from 'react';
import { EngineInfo } from './types';

export const EngineIndicator: React.FC<{ engine: EngineInfo }> = ({ engine }) => {
  return (
    <div className="json-progress-engine" aria-label="موتور پردازش">
      <div className="jp-engine-name">
        <span className={`jp-engine-dot jp-${engine.runtime}`}></span>
        {engine.name} {engine.version && <span className="jp-engine-version">v{engine.version}</span>}
      </div>
      {engine.latencyMsAvg != null && (
        <div className="jp-engine-latency" title="میانگین تأخیر تقریبی">
          ~{Math.round(engine.latencyMsAvg)}ms
        </div>
      )}
    </div>
  );
};
