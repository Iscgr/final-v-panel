import React from 'react';

interface QuickActionsPanelProps {
  role?: string;
}

interface ActionDef {
  id: string;
  label: string;
  onClick: () => void;
  roles?: string[]; // مجاز
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ role = 'ADMIN' }) => {
  const actions: ActionDef[] = [
    { id: 'create-rep', label: 'ایجاد نماینده', onClick: () => console.log('create rep'), roles: ['ADMIN','SUPER_ADMIN'] },
    { id: 'upload-invoice', label: 'بارگذاری فاکتور', onClick: () => console.log('upload invoice'), roles: ['ADMIN','OPERATOR','SUPER_ADMIN'] },
    { id: 'export-report', label: 'گزارش PDF', onClick: () => console.log('export pdf'), roles: ['ADMIN','SUPER_ADMIN'] },
  ];

  const visible = actions.filter(a => !a.roles || a.roles.includes(role));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border p-4 bg-card" aria-label="عملیات سریع">
      <h2 className="text-sm font-semibold mb-3">اقدامات سریع</h2>
      <div className="flex flex-wrap gap-2">
        {visible.map(a => (
          <button
            key={a.id}
            onClick={a.onClick}
            className="text-xs px-3 py-2 rounded bg-primary/10 hover:bg-primary/20 text-primary-foreground transition"
            aria-label={a.label}
          >{a.label}</button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionsPanel;