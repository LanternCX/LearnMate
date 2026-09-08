import { useEffect, useRef } from "react";

export default function AmbientBackground() {
  const background = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = background.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(pointer: fine)");
    const memory = "deviceMemory" in navigator ? Number(navigator.deviceMemory) : Infinity;
    const lowPower = memory <= 4 || navigator.hardwareConcurrency <= 4;
    const interval = 1000 / (lowPower ? 24 : 30);
    let frame = 0;
    let last = 0;
    let time = 0;
    let visible = true;
    let targetX = 0, targetY = 0, driftX = 0, driftY = 0;
    let lights: HTMLCanvasElement[] = [];
    const positions = [[.16, .26], [.78, .12], [.86, .86], [.25, .92]];

    const draw = () => {
      const width = canvas.width, height = canvas.height;
      const extent = Math.max(width, height);
      context.clearRect(0, 0, width, height);
      lights.forEach((light, index) => {
        const phase = time * 1.5 / (7 + index * 2) + index * 2;
        const [x, y] = positions[index];
        context.save();
        context.translate(
          (x + Math.sin(phase) * .16 + driftX) * width,
          (y + Math.cos(phase * .8) * .18 + driftY) * height,
        );
        context.rotate(Math.sin(phase * .6) * .4);
        context.scale(1 + Math.sin(phase) * .12, .8 + Math.cos(phase) * .1);
        context.globalAlpha = index === 2 ? .2 : index === 3 ? .48 : 1;
        context.drawImage(light, -extent * .4, -extent * .4, extent * .8, extent * .8);
        context.restore();
      });
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < interval) return;
      last = now - elapsed % interval;
      time += Math.min(elapsed, 100) / 1000;
      driftX += (targetX - driftX) * .08;
      driftY += (targetY - driftY) * .08;
      draw();
    };
    const update = () => {
      cancelAnimationFrame(frame);
      if (motion.matches) targetX = targetY = driftX = driftY = 0;
      if (document.hidden || !visible) return;
      draw();
      if (!motion.matches) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      // Soft light needs few pixels; cap work independently of display density.
      const scale = Math.min(lowPower ? .4 : .5, 960 / Math.max(width, height, 1));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      update();
    };
    const palette = () => {
      const style = getComputedStyle(canvas);
      // Cache the soft edges once per theme instead of blurring each frame.
      lights = ["--ambient-sage", "--ambient-gold", "--accent", "--surface"].map((name) => {
        const light = document.createElement("canvas");
        light.width = light.height = 128;
        const brush = light.getContext("2d");
        if (brush) {
          const gradient = brush.createRadialGradient(64, 64, 0, 64, 64, 64);
          gradient.addColorStop(0, style.getPropertyValue(name).trim());
          gradient.addColorStop(.3, style.getPropertyValue(name).trim());
          gradient.addColorStop(1, "transparent");
          brush.fillStyle = gradient;
          brush.fillRect(0, 0, 128, 128);
        }
        return light;
      });
      update();
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || !pointer.matches || document.hidden || !visible) return;
      targetX = (event.clientX / innerWidth - .5) * .04;
      targetY = (event.clientY / innerHeight - .5) * .04;
    };
    const sizeObserver = new ResizeObserver(resize);
    const themeObserver = new MutationObserver(palette);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    palette();
    resize();
    sizeObserver.observe(canvas);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    visibilityObserver.observe(canvas);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      themeObserver.disconnect();
      visibilityObserver.disconnect();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  return (
    <canvas className="ambient-background" ref={background} aria-hidden="true" />
  );
}
