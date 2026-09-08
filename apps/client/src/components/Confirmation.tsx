import { useEffect, useRef } from "react";

export default function Confirmation({
  text,
  answer,
}: {
  text: string;
  answer: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirmation"
      aria-labelledby="confirmation-title"
      onClose={() => answer(dialog.current?.returnValue === "confirm")}
    >
      <h2 id="confirmation-title">确认操作</h2>
      <p>{text}</p>
      <form method="dialog" className="inline-actions">
        <button className="secondary" value="cancel" autoFocus>
          取消
        </button>
        <button className="primary" value="confirm">
          确认
        </button>
      </form>
    </dialog>
  );
}
