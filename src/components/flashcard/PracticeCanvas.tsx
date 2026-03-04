'use client';

import React, { useRef, useLayoutEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2, Pencil } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface PracticeCanvasProps {
  character: string;
  width?: number;
  height?: number;
  showGrid?: boolean;
  showTemplate?: boolean;
}

/**
 * Chaikin's curve smoothing algorithm
 * Subdivides the curve by cutting corners
 */
function chaikinSmooth(points: Point[], passes: number = 3): Point[] {
  if (points.length < 2) return points;

  let result = [...points];

  for (let pass = 0; pass < passes; pass++) {
    const newPoints: Point[] = [result[0]];

    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];
      newPoints.push({
        x: 0.75 * a.x + 0.25 * b.x,
        y: 0.75 * a.y + 0.25 * b.y,
      });
      newPoints.push({
        x: 0.25 * a.x + 0.75 * b.x,
        y: 0.25 * a.y + 0.75 * b.y,
      });
    }

    newPoints.push(result[result.length - 1]);
    result = newPoints;
  }

  return result;
}

/**
 * Calculate Catmull-Rom spline segment as a cubic Bezier
 */
function catmullRomSegment(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  ctx: CanvasRenderingContext2D
): void {
  const cp1x = p1.x + (p2.x - p0.x) / 3;
  const cp1y = p1.y + (p2.y - p0.y) / 3;
  const cp2x = p2.x - (p3.x - p1.x) / 3;
  const cp2y = p2.y - (p3.y - p1.y) / 3;
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
}

/**
 * Draw a smooth curve using Catmull-Rom splines
 */
function drawCatmullRom(points: Point[], ctx: CanvasRenderingContext2D): void {
  if (points.length < 2) return;

  // Create ghost points for endpoints
  const g0: Point = {
    x: 2 * points[0].x - points[1].x,
    y: 2 * points[0].y - points[1].y,
  };
  const gN: Point = {
    x: 2 * points[points.length - 1].x - points[points.length - 2].x,
    y: 2 * points[points.length - 1].y - points[points.length - 2].y,
  };

  const allPoints = [g0, ...points, gN];

  ctx.beginPath();
  ctx.moveTo(allPoints[1].x, allPoints[1].y);

  if (allPoints.length <= 3) {
    ctx.lineTo(allPoints[allPoints.length - 2].x, allPoints[allPoints.length - 2].y);
  } else {
    for (let i = 1; i < allPoints.length - 2; i++) {
      catmullRomSegment(allPoints[i - 1], allPoints[i], allPoints[i + 1], allPoints[i + 2], ctx);
    }
  }

  ctx.stroke();
}

/**
 * Check if a stroke is nearly straight
 * Returns true if max deviation from chord is within threshold
 */
function isNearlyStraight(points: Point[], threshold: number = 0.1): boolean {
  if (points.length < 3) return true;

  const p0 = points[0];
  const pN = points[points.length - 1];

  // Calculate chord length
  const chordDx = pN.x - p0.x;
  const chordDy = pN.y - p0.y;
  const chordLen = Math.sqrt(chordDx * chordDx + chordDy * chordDy);

  if (chordLen < 1) return true;

  // Calculate max deviation from the chord
  let maxDev = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const ex = points[i].x - p0.x;
    const ey = points[i].y - p0.y;
    // Distance from point to line (chord)
    const dev = Math.abs(ex * chordDy - ey * chordDx) / chordLen;
    maxDev = Math.max(maxDev, dev);
  }

  return maxDev / chordLen < threshold;
}

/**
 * Fit a quadratic Bezier curve using least-squares
 */
function fitQuadraticBezier(points: Point[]): { p0: Point; p1: Point; p2: Point } {
  const p0 = points[0];
  const p2 = points[points.length - 1];

  if (points.length < 3) {
    return {
      p0,
      p1: { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 },
      p2,
    };
  }

  // Calculate arc-length parameterization
  const arcLen: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    arcLen.push(arcLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLen = arcLen[arcLen.length - 1];

  if (totalLen < 2) {
    return {
      p0,
      p1: { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 },
      p2,
    };
  }

  // Least-squares fit for control point
  let sumW2x = 0;
  let sumW2y = 0;
  let sumW2 = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const t = arcLen[i] / totalLen;
    const w = 2 * t * (1 - t);

    if (w < 1e-4) continue;

    const rx = points[i].x - (1 - t) * (1 - t) * p0.x - t * t * p2.x;
    const ry = points[i].y - (1 - t) * (1 - t) * p0.y - t * t * p2.y;

    sumW2x += w * rx;
    sumW2y += w * ry;
    sumW2 += w * w;
  }

  let p1: Point;
  if (sumW2 < 1e-6) {
    p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  } else {
    p1 = { x: sumW2x / sumW2, y: sumW2y / sumW2 };
  }

  return { p0, p1, p2 };
}

export default function PracticeCanvas({
  character,
  width = 280,
  height = 280,
  showGrid = true,
  showTemplate = true,
}: PracticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);
  const rawPointsRef = useRef<Point[]>([]);
  const undoStackRef = useRef<ImageData[]>([]);
  const lastCharRef = useRef<string | null>(null);

  // Get coordinates from mouse or touch event
  const getCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const src = 'touches' in e && e.touches && e.touches.length > 0 ? e.touches[0] : ('clientX' in e ? e : null);
      if (!src) return { x: 0, y: 0 };

      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  // Apply stroke style
  const applyStyle = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f1f5f9';
    ctx.shadowColor = 'rgba(96, 165, 250, 0.4)';
    ctx.shadowBlur = 6;
  }, []);

  // Draw the faint template character
  const drawTemplate = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!showTemplate || !character) return;

      ctx.save();
      ctx.font = `${width * 0.7}px "KaiTi", "楷体", "STKaiti", "华文楷体", "Kai", "Noto Serif SC", serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(character, width / 2, height / 2);
      ctx.restore();
    },
    [character, width, height, showTemplate]
  );

  // Initialize canvas when character changes
  const initCanvas = useCallback((resetStrokeCount: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw template
    ctx.clearRect(0, 0, width, height);
    drawTemplate(ctx);

    // Save initial state
    undoStackRef.current = [ctx.getImageData(0, 0, width, height)];
    rawPointsRef.current = [];
    lastCharRef.current = character;
    
    if (resetStrokeCount) {
      setStrokeCount(0);
    }
  }, [character, width, height, drawTemplate]);

  // Initialize canvas on mount and when character changes
  useLayoutEffect(() => {
    if (lastCharRef.current !== character) {
      // Use requestAnimationFrame to defer setState outside of the effect
      const rafId = requestAnimationFrame(() => {
        initCanvas(true);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [character, initCanvas]);

  // Draw live preview during stroke
  const drawLivePreview = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return;

    const smoothed = chaikinSmooth(points, 3);
    applyStyle(ctx);
    drawCatmullRom(smoothed, ctx);
  }, [applyStyle]);

  // Beautify and draw the final stroke
  const beautifyAndDraw = useCallback(
    (ctx: CanvasRenderingContext2D, points: Point[]) => {
      if (points.length < 2) return;

      const p0 = points[0];
      const pN = points[points.length - 1];

      // Calculate total arc length
      let totalLen = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        totalLen += Math.sqrt(dx * dx + dy * dy);
      }

      // Draw a dot for very short strokes
      if (totalLen < 2) {
        ctx.beginPath();
        ctx.arc(p0.x, p0.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f1f5f9';
        ctx.fill();
        return;
      }

      applyStyle(ctx);

      // Check if nearly straight
      if (isNearlyStraight(points, 0.1)) {
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(pN.x, pN.y);
        ctx.stroke();
      } else {
        // Fit and draw quadratic Bezier
        const { p0: start, p1, p2: end } = fitQuadraticBezier(points);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(p1.x, p1.y, end.x, end.y);
        ctx.stroke();
      }
    },
    [applyStyle]
  );

  // Save snapshot for undo
  const saveSnapshot = useCallback((): ImageData | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx.getImageData(0, 0, width, height);
  }, [width, height]);

  // Restore snapshot
  const restoreSnapshot = useCallback((snapshot: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(snapshot, 0, 0);
  }, []);

  // Start drawing
  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      setIsDrawing(true);
      rawPointsRef.current = [getCoords(e)];
    },
    [getCoords]
  );

  // Continue drawing
  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const lastPoint = rawPointsRef.current[rawPointsRef.current.length - 1];
      const newPoint = getCoords(e);

      // Distance gate - ignore tiny movements
      const dx = newPoint.x - lastPoint.x;
      const dy = newPoint.y - lastPoint.y;
      if (dx * dx + dy * dy < 4) return;

      rawPointsRef.current.push(newPoint);

      // Live preview
      if (undoStackRef.current.length > 0) {
        restoreSnapshot(undoStackRef.current[undoStackRef.current.length - 1]);
        applyStyle(ctx);
        drawLivePreview(ctx, rawPointsRef.current);
      }
    },
    [isDrawing, getCoords, restoreSnapshot, applyStyle, drawLivePreview]
  );

  // End drawing
  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Replace preview with beautified stroke
    if (undoStackRef.current.length > 0) {
      restoreSnapshot(undoStackRef.current[undoStackRef.current.length - 1]);
      beautifyAndDraw(ctx, rawPointsRef.current);
    }

    // Save for undo
    const snapshot = saveSnapshot();
    if (snapshot) {
      undoStackRef.current.push(snapshot);
      setStrokeCount((prev) => prev + 1);
    }

    rawPointsRef.current = [];
  }, [isDrawing, restoreSnapshot, beautifyAndDraw, saveSnapshot]);

  // Undo last stroke
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length <= 1) return;

    undoStackRef.current.pop();
    restoreSnapshot(undoStackRef.current[undoStackRef.current.length - 1]);
    setStrokeCount((prev) => Math.max(0, prev - 1));
  }, [restoreSnapshot]);

  // Clear canvas
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    drawTemplate(ctx);

    undoStackRef.current = [ctx.getImageData(0, 0, width, height)];
    rawPointsRef.current = [];
    lastCharRef.current = character;
    setStrokeCount(0);
  }, [width, height, drawTemplate, character]);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-white/5 border-white/10 hover:bg-blue-500/20 hover:border-blue-500/40"
      >
        <Pencil className="w-4 h-4 mr-2" />
        {isExpanded ? 'Close Drawing Pad' : 'Practice Drawing'}
      </Button>

      {isExpanded && (
        <div className="flex flex-col items-center gap-3 transition-all duration-300">
          <div className="relative" style={{ width, height }}>
            {/* Grid overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none rounded-lg border border-dashed border-white/15"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
                  `,
                  backgroundSize: '50% 50%',
                }}
              >
                {/* Diagonal lines for 米 character grid */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(135deg, transparent 49%, rgba(255, 255, 255, 0.04) 50%, transparent 51%),
                      linear-gradient(45deg, transparent 49%, rgba(255, 255, 255, 0.04) 50%, transparent 51%)
                    `,
                  }}
                />
              </div>
            )}

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="rounded-lg cursor-crosshair touch-none"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                boxShadow: 'inset 0 3px 15px rgba(0,0,0,0.6)',
              }}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              onTouchCancel={handleEnd}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={strokeCount === 0}
              className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
