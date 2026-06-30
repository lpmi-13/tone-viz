import { registerBands, toneTemplates } from "./data.js";
import type {
  ComparisonCue,
  ComparisonSegment,
  ChartPlayback,
  DrawToneChartOptions,
  RegisterBand,
  ToneId,
  TonePoint
} from "./types.js";

interface PlotArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface DrawCurveOptions {
  stroke: string;
  width: number;
  alpha?: number;
  dash?: number[];
  halo?: string;
  markers?: boolean;
}

const colors: Record<string, string> = {
  canvasTop: "#ffffff",
  canvasBottom: "#f8fbfd",
  plotBorder: "#b8c5d1",
  target: "#0f766e",
  learner: "#c026d3",
  grid: "rgba(100, 116, 139, 0.34)",
  text: "#26384d",
  muted: "#64748b",
  highlight: "rgba(220, 38, 38, 0.14)",
  cue: "#b91c1c",
  low: "#eaf3ff",
  mid: "#eef9f3",
  high: "#fff5d7",
  legendBackground: "rgba(255, 255, 255, 0.86)",
  labelBackground: "rgba(255, 255, 255, 0.94)",
  playhead: "#0f172a"
};

export function drawToneChart(canvas: HTMLCanvasElement, options: DrawToneChartOptions = {}): void {
  const {
    target = null,
    learner = null,
    toneId = null,
    showTemplates = false,
    segments = [],
    cues = [],
    freeform = false,
    emptyText = "No contour yet",
    playback = null
  } = options;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width || canvas.width));
  const height = Math.max(260, Math.floor(rect.height || canvas.height));

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  drawCanvasBackground(context, width, height);

  const plot = {
    left: width < 460 ? 56 : 72,
    right: width - 22,
    top: 48,
    bottom: height - 58
  };

  drawBands(context, plot);
  drawSegments(context, plot, segments);
  drawGrid(context, plot);

  if (showTemplates) {
    drawTemplates(context, plot, toneId);
  }

  if (target?.length) {
    drawCurve(context, plot, target, {
      stroke: colors.target,
      width: 4,
      halo: "rgba(255, 255, 255, 0.96)",
      markers: true
    });
  }

  if (learner?.length) {
    drawCurve(context, plot, learner, {
      stroke: colors.learner,
      width: 4.4,
      halo: "rgba(255, 255, 255, 0.96)",
      markers: true
    });
  }

  if (!target?.length && !learner?.length) {
    drawEmpty(context, plot, emptyText);
  }

  if (cues.length) {
    drawCues(context, plot, cues, learner, target);
  }

  drawPlayback(context, plot, playback, target, learner, freeform);

  if (target?.length) {
    drawEndpointLabel(context, plot, target[target.length - 1], "target", colors.target, -14);
  }

  if (learner?.length) {
    drawEndpointLabel(context, plot, learner[learner.length - 1], freeform ? "recording" : "you", colors.learner, 16);
  }

  drawLegend(context, plot, {
    hasTarget: Boolean(target?.length),
    hasLearner: Boolean(learner?.length),
    showTemplates
  });
  drawAxisLabels(context, plot, freeform);
}

function drawCanvasBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, colors.canvasTop);
  gradient.addColorStop(1, colors.canvasBottom);

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawBands(context: CanvasRenderingContext2D, plot: PlotArea): void {
  context.save();
  clipPlot(context, plot);

  for (const band of registerBands) {
    context.fillStyle = colors[band.id];
    const yTop = yToCanvas(plot, band.to);
    const yBottom = yToCanvas(plot, band.from);
    context.fillRect(plot.left, yTop, plot.right - plot.left, yBottom - yTop);
  }

  context.restore();

  for (const band of registerBands) {
    const yTop = yToCanvas(plot, band.to);
    const yBottom = yToCanvas(plot, band.from);
    drawBandLabel(context, band, yTop, yBottom);
  }
}

function drawBandLabel(
  context: CanvasRenderingContext2D,
  band: RegisterBand,
  yTop: number,
  yBottom: number
): void {
  const label = band.label.replace(" register", "");
  const x = 14;
  const y = yTop + (yBottom - yTop) / 2;

  context.save();
  context.fillStyle = colors.muted;
  context.font = "800 11px system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText(label, x, y);
  context.restore();
}

function drawGrid(context: CanvasRenderingContext2D, plot: PlotArea): void {
  context.strokeStyle = colors.grid;
  context.lineWidth = 1;
  context.setLineDash([]);

  for (const y of [0.34, 0.66]) {
    const yCanvas = yToCanvas(plot, y);
    context.beginPath();
    context.moveTo(plot.left, yCanvas);
    context.lineTo(plot.right, yCanvas);
    context.stroke();
  }

  context.setLineDash([3, 6]);
  for (const x of [0.25, 0.5, 0.75]) {
    const xCanvas = xToCanvas(plot, x);
    context.beginPath();
    context.moveTo(xCanvas, plot.top);
    context.lineTo(xCanvas, plot.bottom);
    context.stroke();
  }

  context.setLineDash([]);
  context.strokeStyle = colors.plotBorder;
  context.lineWidth = 1.2;
  roundedRect(context, plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top, 8);
  context.stroke();
}

function drawSegments(context: CanvasRenderingContext2D, plot: PlotArea, segments: ComparisonSegment[]): void {
  context.save();
  clipPlot(context, plot);
  context.fillStyle = colors.highlight;
  for (const segment of segments) {
    const x = xToCanvas(plot, segment.start);
    const width = xToCanvas(plot, segment.end) - x;
    context.fillRect(x, plot.top, Math.max(width, 4), plot.bottom - plot.top);
  }
  context.restore();
}

function drawTemplates(context: CanvasRenderingContext2D, plot: PlotArea, activeToneId: ToneId | null | undefined): void {
  for (const [toneId, template] of Object.entries(toneTemplates)) {
    drawCurve(context, plot, template.points, {
      stroke: template.color,
      width: toneId === activeToneId ? 2.4 : 1.5,
      alpha: toneId === activeToneId ? 0.58 : 0.24,
      dash: toneId === activeToneId ? [] : [6, 8],
      markers: false
    });
  }
}

function drawCurve(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  points: TonePoint[],
  options: DrawCurveOptions
): void {
  const { stroke, width, alpha = 1, dash = [], halo = "", markers = false } = options;
  const displayPoints = getDrawablePoints(points);
  context.save();
  context.globalAlpha = alpha;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash(dash);

  if (halo) {
    context.strokeStyle = halo;
    context.lineWidth = width + 6;
    drawCurvePath(context, plot, displayPoints);
    context.stroke();
  }

  context.strokeStyle = stroke;
  context.lineWidth = width;
  drawCurvePath(context, plot, displayPoints);
  context.stroke();

  if (markers) {
    drawPointMarker(context, plot, points[0], stroke, width + 2);
    drawPointMarker(context, plot, points[points.length - 1], stroke, width + 2);
  }

  context.restore();
}

function getDrawablePoints(points: TonePoint[]): TonePoint[] {
  if (points.length < 3) {
    return points;
  }

  const start = points[0].t;
  const end = points[points.length - 1].t;
  const span = Math.max(0, end - start);
  if (span < 0.001) {
    return points;
  }

  const count = Math.min(180, Math.max(points.length, Math.ceil(36 + span * 112)));
  return Array.from({ length: count }, (_, index) => {
    const t = start + span * index / (count - 1);
    return { t, y: sampleCurve(points, t) };
  });
}

function drawCurvePath(context: CanvasRenderingContext2D, plot: PlotArea, points: TonePoint[]): void {
  const canvasPoints = points.map((point) => ({
    x: xToCanvas(plot, point.t),
    y: yToCanvas(plot, point.y)
  }));

  context.beginPath();
  if (!canvasPoints.length) {
    return;
  }

  context.moveTo(canvasPoints[0].x, canvasPoints[0].y);

  if (canvasPoints.length === 1) {
    return;
  }

  const smoothing = 0.18;
  for (let index = 0; index < canvasPoints.length - 1; index += 1) {
    const previous = canvasPoints[Math.max(0, index - 1)];
    const current = canvasPoints[index];
    const next = canvasPoints[index + 1];
    const afterNext = canvasPoints[Math.min(canvasPoints.length - 1, index + 2)];
    const cp1x = current.x + (next.x - previous.x) * smoothing;
    const cp1y = current.y + (next.y - previous.y) * smoothing;
    const cp2x = next.x - (afterNext.x - current.x) * smoothing;
    const cp2y = next.y - (afterNext.y - current.y) * smoothing;

    context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y);
  }
}

function drawPointMarker(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  point: TonePoint,
  color: string,
  radius: number
): void {
  const x = xToCanvas(plot, point.t);
  const y = yToCanvas(plot, point.y);

  context.save();
  context.fillStyle = colors.labelBackground;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawEndpointLabel(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  point: TonePoint,
  label: string,
  color: string,
  yOffset: number
): void {
  context.save();
  context.font = "800 12px system-ui, sans-serif";
  context.textBaseline = "middle";

  const paddingX = 8;
  const height = 22;
  const width = Math.ceil(context.measureText(label).width) + paddingX * 2;
  const x = clamp(xToCanvas(plot, point.t) + 10, plot.left + 6, plot.right - width - 6);
  const y = clamp(yToCanvas(plot, point.y) + yOffset, plot.top + height / 2 + 4, plot.bottom - height / 2 - 4);

  context.fillStyle = colors.labelBackground;
  context.strokeStyle = color;
  context.lineWidth = 1.3;
  roundedRect(context, x, y - height / 2, width, height, 6);
  context.fill();
  context.stroke();
  context.fillStyle = color;
  context.fillText(label, x + paddingX, y);
  context.restore();
}

function drawCues(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  cues: ComparisonCue[],
  learner: TonePoint[] | null,
  target: TonePoint[] | null
): void {
  context.save();
  context.strokeStyle = colors.cue;
  context.fillStyle = colors.cue;
  context.lineWidth = 2;
  context.font = "800 12px system-ui, sans-serif";

  cues.forEach((cue, index) => {
    const x = xToCanvas(plot, cue.t);
    const sourceY = learner?.length ? yToCanvas(plot, sampleCurve(learner, cue.t)) : plot.bottom - 44;
    const targetY = target?.length ? yToCanvas(plot, sampleCurve(target, cue.t)) : sourceY + (cue.direction === "up" ? -34 : 34);
    const endY = cue.direction === "up" ? Math.min(sourceY - 30, targetY) : Math.max(sourceY + 30, targetY);
    const clampedStart = clamp(sourceY, plot.top + 20, plot.bottom - 20);
    const clampedEnd = clamp(endY, plot.top + 16, plot.bottom - 16);

    context.beginPath();
    context.moveTo(x, clampedStart);
    context.lineTo(x, clampedEnd);
    context.stroke();

    const arrow = cue.direction === "up" ? -1 : 1;
    context.beginPath();
    context.moveTo(x, clampedEnd);
    context.lineTo(x - 5, clampedEnd - arrow * 7);
    context.lineTo(x + 5, clampedEnd - arrow * 7);
    context.closePath();
    context.fill();

    const labelX = clamp(x + 8, plot.left + 4, plot.right - 86);
    const labelY = clamp(clampedEnd + (index === 0 ? -8 : 16), plot.top + 14, plot.bottom - 8);
    drawCueLabel(context, labelX, labelY, cue.label);
  });

  context.restore();
}

function drawCueLabel(context: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  const width = context.measureText(text).width + 12;
  context.fillStyle = colors.labelBackground;
  context.strokeStyle = "#fecaca";
  context.lineWidth = 1;
  roundedRect(context, x - 6, y - 13, width, 18, 5);
  context.fill();
  context.stroke();
  context.fillStyle = colors.cue;
  context.fillText(text, x, y);
}

function drawPlayback(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  playback: ChartPlayback | null | undefined,
  target: TonePoint[] | null,
  learner: TonePoint[] | null,
  freeform: boolean
): void {
  if (!playback) {
    return;
  }

  const points = playback.track === "target" ? target : learner;
  if (!points?.length) {
    return;
  }

  const color = playback.track === "target" ? colors.target : colors.learner;
  const label = playback.label || (playback.track === "target" ? "target" : freeform ? "recording" : "you");
  drawPlaybackOverlay(context, plot, points, color, playback.progress, label);
}

function drawPlaybackOverlay(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  points: TonePoint[],
  color: string,
  progress: number,
  label: string
): void {
  const safeProgress = clamp(progress, 0, 1);
  const x = xToCanvas(plot, safeProgress);
  const y = yToCanvas(plot, sampleCurve(points, safeProgress));
  const trailPoints = buildProgressPoints(points, safeProgress);

  context.save();
  clipPlot(context, plot);

  const wash = context.createLinearGradient(plot.left, 0, Math.max(plot.left + 1, x), 0);
  wash.addColorStop(0, withAlpha(color, 0.1));
  wash.addColorStop(1, withAlpha(color, 0.025));
  context.fillStyle = wash;
  context.fillRect(plot.left, plot.top, Math.max(0, x - plot.left), plot.bottom - plot.top);

  context.strokeStyle = withAlpha(colors.playhead, 0.16);
  context.lineWidth = 1.5;
  context.setLineDash([5, 7]);
  context.beginPath();
  context.moveTo(x, plot.top + 4);
  context.lineTo(x, plot.bottom - 4);
  context.stroke();
  context.setLineDash([]);

  drawCurve(context, plot, trailPoints, {
    stroke: color,
    width: 6,
    halo: withAlpha(color, 0.18)
  });

  drawPlaybackPoint(context, x, y, color);
  context.restore();

  drawProgressChip(context, plot, x, y, label, safeProgress, color);
}

function buildProgressPoints(points: TonePoint[], progress: number): TonePoint[] {
  const end = Math.max(0.001, clamp(progress, 0, 1));
  const count = Math.max(4, Math.ceil(8 + end * 84));

  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : end * index / (count - 1);
    return { t, y: sampleCurve(points, t) };
  });
}

function drawPlaybackPoint(context: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  context.save();
  context.shadowColor = withAlpha(color, 0.48);
  context.shadowBlur = 18;
  context.fillStyle = withAlpha(color, 0.16);
  context.beginPath();
  context.arc(x, y, 15, 0, Math.PI * 2);
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = colors.labelBackground;
  context.strokeStyle = color;
  context.lineWidth = 2.4;
  context.beginPath();
  context.arc(x, y, 8.5, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 3.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawProgressChip(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  x: number,
  y: number,
  label: string,
  progress: number,
  color: string
): void {
  const text = `${label} ${Math.round(progress * 100)}%`;

  context.save();
  context.font = "850 12px system-ui, sans-serif";
  context.textBaseline = "middle";

  const paddingX = 9;
  const height = 24;
  const width = Math.ceil(context.measureText(text).width) + paddingX * 2;
  const chipX = clamp(x - width / 2, plot.left + 6, plot.right - width - 6);
  const chipY = clamp(y - 34, plot.top + height / 2 + 6, plot.bottom - height / 2 - 6);

  context.fillStyle = colors.labelBackground;
  context.strokeStyle = withAlpha(color, 0.48);
  context.lineWidth = 1.4;
  roundedRect(context, chipX, chipY - height / 2, width, height, 8);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.fillText(text, chipX + paddingX, chipY);
  context.restore();
}

function drawLegend(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  options: { hasTarget: boolean; hasLearner: boolean; showTemplates: boolean }
): void {
  const items: Array<{ label: string; color: string; dash?: number[] }> = [];

  if (options.hasTarget) {
    items.push({ label: "Target", color: colors.target });
  }
  if (options.hasLearner) {
    items.push({ label: "You", color: colors.learner });
  }
  if (options.showTemplates) {
    items.push({ label: "Tones", color: colors.muted, dash: [5, 5] });
  }
  if (!items.length) {
    return;
  }

  context.save();
  context.font = "800 12px system-ui, sans-serif";
  context.textBaseline = "middle";

  const metrics = items.map((item) => ({
    ...item,
    width: Math.ceil(context.measureText(item.label).width) + 34
  }));
  const totalWidth = metrics.reduce((sum, item) => sum + item.width, 0) + Math.max(0, metrics.length - 1) * 10;
  const xStart = Math.max(plot.left, plot.right - totalWidth);
  const y = 25;

  context.fillStyle = colors.legendBackground;
  roundedRect(context, xStart - 8, y - 13, totalWidth + 16, 26, 8);
  context.fill();

  let x = xStart;
  for (const item of metrics) {
    context.strokeStyle = item.color;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.setLineDash(item.dash || []);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 18, y);
    context.stroke();

    context.setLineDash([]);
    context.fillStyle = colors.text;
    context.fillText(item.label, x + 26, y);
    x += item.width + 10;
  }

  context.restore();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const roundRect = (context as any).roundRect;
  if (typeof roundRect === "function") {
    context.beginPath();
    roundRect.call(context, x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function clipPlot(context: CanvasRenderingContext2D, plot: PlotArea): void {
  roundedRect(context, plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top, 8);
  context.clip();
}

function drawAxisLabels(context: CanvasRenderingContext2D, plot: PlotArea, freeform: boolean): void {
  context.fillStyle = colors.text;
  context.font = "800 12px system-ui, sans-serif";
  context.fillText("start", plot.left, plot.bottom + 24);
  context.fillStyle = colors.muted;
  context.fillText("middle", xToCanvas(plot, 0.5) - 18, plot.bottom + 24);
  context.fillStyle = colors.text;
  context.fillText("end", plot.right - 22, plot.bottom + 24);

  if (freeform) {
    context.save();
    context.fillStyle = colors.muted;
    context.translate(16, plot.top + (plot.bottom - plot.top) / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("relative pitch", -32, 0);
    context.restore();
  }
}

function drawEmpty(context: CanvasRenderingContext2D, plot: PlotArea, emptyText: string): void {
  context.save();
  context.fillStyle = colors.muted;
  context.font = "800 16px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emptyText, plot.left + (plot.right - plot.left) / 2, plot.top + (plot.bottom - plot.top) / 2);
  context.restore();
}

function sampleCurve(points: TonePoint[] | null, t: number): number {
  if (!points?.length) {
    return 0.5;
  }

  if (points.length === 1) {
    return points[0].y;
  }

  if (t <= points[0].t) {
    return points[0].y;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (t <= current.t) {
      if (points.length < 3) {
        const weight = (t - previous.t) / Math.max(0.0001, current.t - previous.t);
        return previous.y * (1 - weight) + current.y * weight;
      }

      return cubicSample(points, index - 1, t);
    }
  }

  return points[points.length - 1].y;
}

function cubicSample(points: TonePoint[], startIndex: number, t: number): number {
  const p0 = points[Math.max(0, startIndex - 1)];
  const p1 = points[startIndex];
  const p2 = points[startIndex + 1];
  const p3 = points[Math.min(points.length - 1, startIndex + 2)];
  const span = Math.max(0.0001, p2.t - p1.t);
  const u = (t - p1.t) / span;
  const u2 = u * u;
  const u3 = u2 * u;
  const m1 = getSlope(p0, p2) * 0.72;
  const m2 = getSlope(p1, p3) * 0.72;
  const y = (
    (2 * u3 - 3 * u2 + 1) * p1.y +
    (u3 - 2 * u2 + u) * span * m1 +
    (-2 * u3 + 3 * u2) * p2.y +
    (u3 - u2) * span * m2
  );

  return clamp(y, 0, 1);
}

function getSlope(from: TonePoint, to: TonePoint): number {
  return (to.y - from.y) / Math.max(0.0001, to.t - from.t);
}

function xToCanvas(plot: PlotArea, t: number): number {
  return plot.left + clamp(t, 0, 1) * (plot.right - plot.left);
}

function yToCanvas(plot: PlotArea, y: number): number {
  return plot.bottom - clamp(y, 0, 1) * (plot.bottom - plot.top);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#")) {
    return color;
  }

  const hex = color.slice(1);
  const fullHex = hex.length === 3
    ? hex.split("").map((part) => part + part).join("")
    : hex;
  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}
