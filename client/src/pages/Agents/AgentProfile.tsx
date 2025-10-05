import React, { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner from '@/components/LoadingSpinner';

const EditAgentProfile = React.lazy(() => import('@/components/EditAgentProfile'));

const AgentProfile = ({ agent }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      <h1>Agent Profile</h1>
      {/* Other profile details */}
      <Button onClick={() => setIsEditing((prev) => !prev)}>
        {isEditing ? 'Cancel' : 'Edit Profile'}
      </Button>
      {isEditing && (
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <EditAgentProfile agent={agent} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default AgentProfile;