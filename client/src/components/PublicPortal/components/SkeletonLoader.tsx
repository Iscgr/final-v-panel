import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader: React.FC = () => {
  return (
    <div className="skeleton-container">
      <div className="skeleton-header">
        <div className="skeleton-box skeleton-title"></div>
        <div className="skeleton-box skeleton-subtitle"></div>
      </div>

      <div className="skeleton-nav">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="skeleton-box skeleton-nav-item"></div>
        ))}
      </div>

      <div className="skeleton-content">
        <div className="skeleton-cards">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-box skeleton-card-header"></div>
              <div className="skeleton-box skeleton-card-body"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
