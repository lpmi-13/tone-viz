import { registerBands, toneTemplates } from "./data.js";
import type {
  ComparisonCue,
  ComparisonSegment,
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
}

const colors: Record<string, string> = {
  target: "#102a43",
  learner: "#b423b6",
  grid: "#cbd5e1",
  text: "#334155",
  muted: "#64748b",
  highlight: "rgba(220, 38, 38, 0.12)",
  cue: "#b91c1c",
  low: "#e5f0ff",
  mid: "#edf8ed",
  high: "#fff2cf"
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
    emptyText = "No contour yet"
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

  const plot = {
    left: 48,
    right: width - 18,
    top: 22,
    bottom: height - 38
  };

  drawBands(context, plot);
  drawGrid(context, plot);
  drawSegments(context, plot, segments);

  if (showTemplates) {
    drawTemplates(context, plot, toneId);
  }

  if (target?.length) {
    drawCurve(context, plot, target, {
      stroke: colors.target,
      width: 4
    });
    drawEndpointLabel(context, plot, target[target.length - 1], "target", colors.target, -12);
  }

  if (learner?.length) {
    drawCurve(context, plot, learner, {
      stroke: colors.learner,
      width: 4
    });
    drawEndpointLabel(context, plot, learner[learner.length - 1], "you", colors.learner, 14);
  }

  if (!target?.length && !learner?.length) {
    drawEmpty(context, plot, emptyText);
  }

  if (cues.length) {
    drawCues(context, plot, cues, learner, target);
  }

  drawAxisLabels(context, plot, freeform);
}

function drawBands(context: CanvasRenderingContext2D, plot: PlotArea): void {
  for (const band of registerBands) {
    context.fillStyle = colors[band.id];
    const yTop = yToCanvas(plot, band.to);
    const yBottom = yToCanvas(plot, band.from);
    context.fillRect(plot.left, yTop, plot.right - plot.left, yBottom - yTop);

    context.fillStyle = colors.muted;
    context.font = "700 12px system-ui, sans-serif";
    context.fillText(band.label, 8, yTop + 18);
  }
}

function drawGrid(context: CanvasRenderingContext2D, plot: PlotArea): void {
  context.strokeStyle = colors.grid;
  context.lineWidth = 1;
  context.setLineDash([3, 5]);

  for (const y of [0.34, 0.66]) {
    const yCanvas = yToCanvas(plot, y);
    context.beginPath();
    context.moveTo(plot.left, yCanvas);
    context.lineTo(plot.right, yCanvas);
    context.stroke();
  }

  for (const x of [0.25, 0.5, 0.75]) {
    const xCanvas = xToCanvas(plot, x);
    context.beginPath();
    context.moveTo(xCanvas, plot.top);
    context.lineTo(xCanvas, plot.bottom);
    context.stroke();
  }

  context.setLineDash([]);
  context.strokeStyle = "#94a3b8";
  context.strokeRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
}

function drawSegments(context: CanvasRenderingContext2D, plot: PlotArea, segments: ComparisonSegment[]): void {
  context.fillStyle = colors.highlight;
  for (const segment of segments) {
    const x = xToCanvas(plot, segment.start);
    const width = xToCanvas(plot, segment.end) - x;
    context.fillRect(x, plot.top, Math.max(width, 4), plot.bottom - plot.top);
  }
}

function drawTemplates(context: CanvasRenderingContext2D, plot: PlotArea, activeToneId: ToneId | null | undefined): void {
  for (const [toneId, template] of Object.entries(toneTemplates)) {
    drawCurve(context, plot, template.points, {
      stroke: template.color,
      width: toneId === activeToneId ? 2.4 : 1.5,
      alpha: toneId === activeToneId ? 0.5 : 0.25,
      dash: toneId === activeToneId ? [] : [6, 8]
    });
  }
}

function drawCurve(
  context: CanvasRenderingContext2D,
  plot: PlotArea,
  points: TonePoint[],
  options: DrawCurveOptions
): void {
  const { stroke, width, alpha = 1, dash = [] } = options;
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = stroke;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash(dash);
  context.beginPath();

  points.forEach((point, index) => {
    const x = xToCanvas(plot, point.t);
    const y = yToCanvas(plot, point.y);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

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
  const x = Math.min(plot.right - 48, xToCanvas(plot, point.t) + 8);
  const y = clamp(yToCanvas(plot, point.y) + yOffset, plot.top + 14, plot.bottom - 8);

  context.fillStyle = color;
  context.font = "800 12px system-ui, sans-serif";
  context.fillText(label, x, y);
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
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.strokeStyle = "#fecaca";
  context.lineWidth = 1;
  roundedRect(context, x - 6, y - 13, width, 18, 5);
  context.fill();
  context.stroke();
  context.fillStyle = colors.cue;
  context.fillText(text, x, y);
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

function drawAxisLabels(context: CanvasRenderingContext2D, plot: PlotArea, freeform: boolean): void {
  context.fillStyle = colors.text;
  context.font = "800 12px system-ui, sans-serif";
  context.fillText("start", plot.left, plot.bottom + 24);
  context.fillText("end", plot.right - 22, plot.bottom + 24);

  context.save();
  context.translate(16, plot.top + (plot.bottom - plot.top) / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(freeform ? "relative pitch" : "normalized register", -48, 0);
  context.restore();
}

function drawEmpty(context: CanvasRenderingContext2D, plot: PlotArea, emptyText: string): void {
  context.fillStyle = colors.muted;
  context.font = "800 16px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(emptyText, plot.left + (plot.right - plot.left) / 2, plot.top + (plot.bottom - plot.top) / 2);
  context.textAlign = "start";
}

function sampleCurve(points: TonePoint[] | null, t: number): number {
  if (!points?.length) {
    return 0.5;
  }

  if (t <= points[0].t) {
    return points[0].y;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (t <= current.t) {
      const weight = (t - previous.t) / Math.max(0.0001, current.t - previous.t);
      return previous.y * (1 - weight) + current.y * weight;
    }
  }

  return points[points.length - 1].y;
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
