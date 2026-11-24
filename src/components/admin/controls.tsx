"use client";

import { useId, useRef } from "react";

// Client building blocks of the admin design system.

/** Accessible on/off switch (role="switch"), 44 px tall touch area. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  labelledBy,
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible name when there is no visible label to point at. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  return (
    <span className="adm-switch-hit">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="adm-switch"
      />
    </span>
  );
}

/**
 * A button that asks first in a native <dialog> (focus trap, Escape and the
 * backdrop come from the browser). Replaces window.confirm().
 */
export function ConfirmButton({
  children,
  className = "adm-btn adm-btn-danger",
  title,
  body,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => ref.current?.showModal()}>
        {children}
      </button>
      <dialog ref={ref} className="adm-dialog" aria-labelledby={titleId}>
        <form method="dialog" className="p-6">
          <h2 id={titleId}>{title}</h2>
          <div className="mt-2 text-[15px] text-[color:var(--adm-ink-2)]">{body}</div>
          <div className="adm-dialog-actions">
            <button type="submit" className="adm-btn" autoFocus>
              Volver
            </button>
            <button
              type="submit"
              className="adm-btn adm-btn-danger-solid"
              onClick={() => onConfirm()}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
