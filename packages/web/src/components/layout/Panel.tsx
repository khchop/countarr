import { ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Panel({ title, subtitle, children, className = '', noPadding = false }: PanelProps) {
  return (
    <div className={`panel ${className}`}>
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-medium text-text">{title}</h3>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className={noPadding ? '' : 'p-4'}>
        {children}
      </div>
    </div>
  );
}

export function PanelSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`panel ${className}`}>
      <div className="px-4 py-3 border-b border-border">
        <div className="h-5 w-32 skeleton rounded" />
      </div>
      <div className="p-4">
        <div className="h-48 skeleton rounded" />
      </div>
    </div>
  );
}
