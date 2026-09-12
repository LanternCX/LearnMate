import type { Slide } from "../../domain/learning";

function lines(text: string, limit: number) {
  const result: string[] = [];
  let line = "";
  for (const character of text) {
    line += character;
    if (line.length >= limit || /[。！？；]/.test(character)) {
      result.push(line);
      line = "";
    }
  }
  if (line) result.push(line);
  return result;
}

function TextLines({
  text,
  x,
  y,
  width,
  lineHeight,
  className,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  className: string;
}) {
  return (
    <text x={x} y={y} className={className}>
      {lines(text, width).map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index ? lineHeight : 0}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export default function SlideCanvas({ slide }: { slide: Slide }) {
  const titleLines = lines(slide.title, 12);
  const contentY = 250 + Math.max(0, titleLines.length - 1) * 66;
  const listX = slide.layout === "steps" ? 650 : 700;
  return (
    <svg
      className={`lesson-slide layout-${slide.layout}`}
      viewBox="0 0 1200 675"
      role="img"
      aria-label={`课件页面：${slide.title}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect className="slide-svg-background" width="1200" height="675" />
      <path className="slide-svg-rule" d="M80 72 H1120" />
      <circle className="slide-svg-index" cx="1090" cy="104" r="22" />
      <text className="slide-svg-index-text" x="1090" y="110" textAnchor="middle">
        Z
      </text>
      {slide.kicker && (
        <text className="slide-svg-kicker" x="84" y="112">
          {slide.kicker}
        </text>
      )}
      <text className="slide-svg-title" x="82" y="184">
        {titleLines.map((line, index) => (
          <tspan key={`${line}-${index}`} x="82" dy={index ? 66 : 0}>
            {line}
          </tspan>
        ))}
      </text>
      <TextLines
        text={slide.body}
        x={84}
        y={contentY}
        width={slide.layout === "explain" ? 24 : 20}
        lineHeight={38}
        className="slide-svg-body"
      />
      {slide.bullets.map((bullet, index) => {
        const y = 190 + index * 92;
        return (
          <g key={`${bullet}-${index}`} className="slide-svg-point">
            <text className="slide-svg-number" x={listX} y={y}>
              {String(index + 1).padStart(2, "0")}
            </text>
            <path d={`M${listX + 48} ${y - 9} H${listX + 78}`} />
            <TextLines
              text={bullet}
              x={listX + 92}
              y={y}
              width={16}
              lineHeight={30}
              className="slide-svg-point-text"
            />
          </g>
        );
      })}
    </svg>
  );
}
