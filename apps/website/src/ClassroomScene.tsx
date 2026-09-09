import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Symmetric residuals keep the least-squares line exactly y = 0.65x + 0.7.
const samples = [[1, 1.6], [2, 1.6], [3, 2.8], [4, 3.3], [5, 3.95], [6, 4.75], [7, 4.85], [8, 6.15]];
const duration = 12;
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const sumX = samples.reduce((sum, [x]) => sum + x, 0);
const sumY = samples.reduce((sum, [, y]) => sum + y, 0);
const slope = (samples.length * samples.reduce((sum, [x, y]) => sum + x * y, 0) - sumX * sumY)
  / (samples.length * samples.reduce((sum, [x]) => sum + x * x, 0) - sumX * sumX);
const intercept = (sumY - slope * sumX) / samples.length;
const predict = (x: number) => slope * x + intercept;
const steps = ["观察数据", "拟合直线", "进行预测"];

export default function ClassroomScene() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const reduced = useRef(matchMedia("(prefers-reduced-motion: reduce)").matches);
  const step = Math.min(2, Math.floor(time / 4));

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reduced.current = preference.matches;
      if (preference.matches) { setPlaying(false); setTime(duration); }
    };
    update();
    preference.addEventListener("change", update);
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    if (canvas.current) observer.observe(canvas.current);
    return () => { observer.disconnect(); preference.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | undefined;
    const tick = (now: number) => {
      const delta = previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.1);
      previous = now;
      setTime(value => Math.min(duration, value + delta));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    if (time >= duration) setPlaying(false);
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const { width, height } = size;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (element.width !== Math.round(width * dpr) || element.height !== Math.round(height * dpr)) {
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const narrow = width < 641;
    const plotWidth = Math.min(width - (narrow ? 72 : 160), 760);
    const left = (width - plotWidth) / 2;
    const bottom = height - (narrow ? 134 : 126);
    const top = Math.min(narrow ? 308 : 324, bottom - 100);
    const plotHeight = Math.max(100, bottom - top);
    const x = (value: number) => left + value / 10 * plotWidth;
    const y = (value: number) => bottom - value / 8 * plotHeight;
    const line = (ax: number, ay: number, bx: number, by: number, color: string, weight = 1) => {
      ctx.strokeStyle = color; ctx.lineWidth = weight;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    };
    ctx.font = '12px "Consolas", monospace';
    ctx.textAlign = "center";
    for (let i = 0; i <= 10; i++) {
      line(x(i), top, x(i), bottom, "#222628");
      if (i % 2 === 0) { ctx.fillStyle = "#898f91"; ctx.fillText(String(i), x(i), bottom + 20); }
    }
    for (let i = 0; i <= 8; i += 2) {
      line(left, y(i), left + plotWidth, y(i), "#222628");
      ctx.fillStyle = "#898f91"; ctx.fillText(String(i), left - 18, y(i) + 4);
    }
    line(left, bottom, left + plotWidth + 12, bottom, "#828889");
    line(left, bottom, left, top - 12, "#828889");
    ctx.fillStyle = "#bac3c3"; ctx.fillText("x", left + plotWidth + 18, bottom + 4);
    ctx.fillText("y", left, top - 22);
    const dataProgress = ease(time / 2);
    samples.forEach(([sx, sy], index) => {
      const reveal = ease(dataProgress * 2 - index / samples.length + 0.15);
      ctx.globalAlpha = reveal;
      ctx.beginPath(); ctx.arc(x(sx), y(sy), 4.5 * reveal + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#84d5c6"; ctx.fill();
      ctx.globalAlpha = 1;
    });
    const fitProgress = ease((time - 4) / 2.8);
    if (fitProgress > 0) {
      samples.forEach(([sx, sy]) => {
        ctx.globalAlpha = fitProgress * 0.65;
        line(x(sx), y(sy), x(sx), y(predict(sx)), "#d9bc77", 1);
      });
      ctx.globalAlpha = 1;
      line(x(0), y(predict(0)), x(10 * fitProgress), y(predict(10 * fitProgress)), "#82b9ed", 2);
      ctx.textAlign = "right";
      ctx.font = narrow ? 'italic 16px Georgia, serif' : 'italic 22px Georgia, serif';
      ctx.fillStyle = "#a2caf0";
      ctx.fillText("y = " + slope.toFixed(2) + "x + " + intercept.toFixed(2), left + plotWidth, top - 22);
    }
    if (time >= 8) {
      const position = 8 * ease((time - 8) / 2.5);
      ctx.setLineDash([4, 5]);
      line(x(position), bottom, x(position), y(predict(position)), "#f0b59a");
      line(left, y(predict(position)), x(position), y(predict(position)), "#f0b59a");
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x(position), y(predict(position)), 7, 0, Math.PI * 2);
      ctx.fillStyle = "#111415"; ctx.fill();
      ctx.strokeStyle = "#f0b59a"; ctx.lineWidth = 2; ctx.stroke();
    }
  }, [time, size]);

  const seek = (index: number) => { setPlaying(false); setTime([2.5, 7.5, 12][index]); };
  const replay = () => { setTime(reduced.current ? duration : 0); setPlaying(!reduced.current); };
  const toggle = () => {
    if (playing) setPlaying(false);
    else if (reduced.current) setTime(duration);
    else { if (time >= duration) setTime(0); setPlaying(true); }
  };

  return (
    <figure className="classroom-scene">
      <canvas ref={canvas} role="img" aria-label="线性回归示意：观察散点，画出最小二乘拟合直线，再用直线预测数值" />
      <figcaption className="scene-caption">
        <span className="scene-overline">教学概念示意</span>
        <div className="scene-controls">
          <div className="scene-steps" aria-label="动画章节">
            {steps.map((label, index) => <button type="button" key={label} aria-pressed={step === index} onClick={() => seek(index)}><span>0{index + 1}</span> {label}</button>)}
          </div>
          <div className="playback-controls">
            <button type="button" className="icon-button" disabled={reduced.current} aria-label={playing ? "暂停动画" : "继续动画"} title={reduced.current ? "系统已启用减少动态效果" : playing ? "暂停动画" : "继续动画"} onClick={toggle}>{playing ? <Pause /> : <Play />}</button>
            <button type="button" className="icon-button" disabled={reduced.current} aria-label="重新播放动画" title={reduced.current ? "系统已启用减少动态效果" : "重新播放动画"} onClick={replay}><RotateCcw /></button>
          </div>
        </div>
        <p role="status">{step === 0 ? "观察数据点之间的关系。" : step === 1 ? "让数据点到直线的竖直距离平方和最小。" : time < 10.5 ? "用拟合直线估计对应的 y 值。" : `沿拟合直线，x = 8 时预测 y ≈ ${predict(8).toFixed(2)}。`}</p>
      </figcaption>
    </figure>
  );
}
