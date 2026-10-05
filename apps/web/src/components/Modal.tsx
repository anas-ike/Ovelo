import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="record-modal" onCancel={onClose} aria-label={title}>
    <div className="section-head"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">×</button></div>{children}
  </dialog>;
}
