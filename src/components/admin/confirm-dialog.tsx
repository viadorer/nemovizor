"use client";

import { useT } from "@/i18n/provider";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();

  if (!open) return null;

  return (
    <div className="admin-dialog-overlay" onClick={onCancel}>
      <div className="admin-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="admin-dialog-actions">
          <button className="admin-btn admin-btn--secondary" onClick={onCancel}>
            {t.admin.cancelLabel}
          </button>
          <button
            className={`admin-btn ${danger ? "admin-btn--danger" : "admin-btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel || t.admin.confirmDefault}
          </button>
        </div>
      </div>
    </div>
  );
}
