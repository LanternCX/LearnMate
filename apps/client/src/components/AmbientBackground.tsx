import { useEffect, useRef } from "react";

export default function AmbientBackground() {
  const background = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(pointer: fine)");
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches) return;
      const x = (event.clientX / window.innerWidth - 0.5) * 80;
      const y = (event.clientY / window.innerHeight - 0.5) * 56;
      background.current?.style.setProperty("--drift-x", `${x}px`);
      background.current?.style.setProperty("--drift-y", `${y}px`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <div className="ambient-background" ref={background} aria-hidden="true">
      <div className="ambient-light">
        <span className="ambient-patch" />
        <span className="ambient-patch" />
        <span className="ambient-patch" />
        <span className="ambient-patch" />
      </div>
    </div>
  );
}
