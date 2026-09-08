import { useEffect, useRef } from "react";

export type ConfirmationOptions = {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
};

export default function Confirmation({
  title,
  text,
  confirmLabel,
  danger,
  answer,
}: ConfirmationOptions & {
  answer: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirmation"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const first = cancelButton.current;
        const last = confirmButton.current;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClose={() => answer(dialog.current?.returnValue === "confirm")}
    >
      <h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-description">{text}</p>
      <form method="dialog" className="inline-actions">
        <button ref={cancelButton} className="secondary" value="cancel" autoFocus>
          取消
        </button>
        <button ref={confirmButton} className={`primary${danger ? " danger" : ""}`} value="confirm">
          {confirmLabel}
        </button>
      </form>
    </dialog>
  );
}
