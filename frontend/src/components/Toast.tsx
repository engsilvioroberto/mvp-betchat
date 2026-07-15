import { useState, useCallback } from 'react';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, show };
}

export function Toast({ toast, onClose }: { toast: { message: string; type: string } | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type}`} onClick={onClose}>
      {toast.message}
    </div>
  );
}