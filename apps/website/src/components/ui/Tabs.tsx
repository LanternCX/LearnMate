import { useRef } from "react";
import type { KeyboardEvent } from "react";

type TabsProps = {
  ariaLabel: string;
  className?: string;
  idPrefix: string;
  items: readonly string[];
  onSelect: (index: number) => void;
  panelId: string;
  selectedIndex: number;
};

export function Tabs({ ariaLabel, className, idPrefix, items, onSelect, panelId, selectedIndex }: TabsProps) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % items.length
      : event.key === "ArrowLeft" ? (index + items.length - 1) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
    tabs.current[next]?.focus();
  }

  return <div className={["text-tabs", className].filter(Boolean).join(" ")} role="tablist" aria-label={ariaLabel}>
    {items.map((label, index) => <button key={label} id={`${idPrefix}-${index}`} type="button" role="tab"
      aria-selected={selectedIndex === index} aria-controls={panelId} tabIndex={selectedIndex === index ? 0 : -1}
      ref={element => { tabs.current[index] = element; }}
      onKeyDown={event => selectFromKeyboard(event, index)} onClick={() => onSelect(index)}>{label}</button>)}
  </div>;
}
