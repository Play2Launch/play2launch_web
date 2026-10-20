import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

export function WarningNotice({title, children, urgent = false}: {title: string; children: ReactNode; urgent?: boolean}) {
  return <div className="warning-notice" role={urgent ? 'alert' : 'status'}>
    <TriangleAlert size={22} aria-hidden="true" />
    <div className="warning-notice-content"><strong>{title}</strong>{children}</div>
  </div>;
}
