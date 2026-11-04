import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => { const el = dialog.current; if (el && !el.open) el.showModal(); return () => { if (el?.open) el.close(); }; }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={id} onCancel={onClose}><div className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20} /></button></div>{children}</dialog>;
}
export function downloadFile(name: string, content: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
