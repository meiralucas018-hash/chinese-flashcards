"use client";

import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  onInteraction?: () => void;
  extraControls?: React.ReactNode;
}

const MIN_POINT_DISTANCE_SQUARED = 1.2;
const MAX_SEGMENT_LENGTH = 3.5;
const POINTER_SMOOTHING_FACTOR = 0.42;

function getStrokeWidth(size: number): number {
  return Math.max(12, Math.round(size * 0.07));
}

function interpolateSegmentPoints(
  from: Point,
  to: Point,
  maxSegmentLength = MAX_SEGMENT_LENGTH,
): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= maxSegmentLength) {
    return [to];
  }

  const steps = Math.ceil(distance / maxSegmentLength);
  const points: Point[] = [];

  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    points.push({
      x: from.x + dx * t,
      y: from.y + dy * t,
    });
  }

  return points;
}

function chaikinSmooth(points: Point[], passes = 2): Point[] {
  if (points.length < 3) {
    return points;
  }

  let result = points;

  for (let pass = 0; pass < passes; pass++) {
    const next: Point[] = [result[0]];

    for (let index = 0; index < result.length - 1; index++) {
      const current = result[index];
      const following = result[index + 1];

      next.push({
        x: current.x * 0.75 + following.x * 0.25,
        y: current.y * 0.75 + following.y * 0.25,
      });
      next.push({
        x: current.x * 0.25 + following.x * 0.75,
        y: current.y * 0.25 + following.y * 0.75,
      });
    }

    next.push(result[result.length - 1]);
    result = next;
  }

  return result;
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  size: number,
  options?: {
    strokeStyle?: string;
    shadowColor?: string;
    shadowBlur?: number;
    opacity?: number;
  },
): void {
  if (points.length === 0) {
    return;
  }

  const smoothedPoints = chaikinSmooth(points);
  const strokeWidth = getStrokeWidth(size);
  const strokeColor = options?.strokeStyle ?? "#f8fafc";
  const opacity = options?.opacity ?? 1;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.globalAlpha = opacity;
  ctx.shadowColor = options?.shadowColor ?? "rgba(125, 211, 252, 0.22)";
  ctx.shadowBlur = options?.shadowBlur ?? Math.round(strokeWidth * 0.8);

  if (smoothedPoints.length === 1) {
    ctx.beginPath();
    ctx.arc(
      smoothedPoints[0].x,
      smoothedPoints[0].y,
      strokeWidth * 0.42,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = strokeColor;
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(smoothedPoints[0].x, smoothedPoints[0].y);

  for (let index = 1; index < smoothedPoints.length - 1; index++) {
    const current = smoothedPoints[index];
    const next = smoothedPoints[index + 1];
    const midpoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
    };
    ctx.quadraticCurveTo(current.x, current.y, midpoint.x, midpoint.y);
  }

  const penultimatePoint = smoothedPoints[smoothedPoints.length - 2];
  const lastPoint = smoothedPoints[smoothedPoints.length - 1];
  ctx.quadraticCurveTo(
    penultimatePoint.x,
    penultimatePoint.y,
    lastPoint.x,
    lastPoint.y,
  );
  ctx.stroke();
  ctx.restore();
}

export default function PracticeCanvas({
  character,
  width = 280,
  height = 280,
  showGrid = true,
  showTemplate: _showTemplate = false,
  onInteraction,
  extraControls,
}: PracticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [shellWidth, setShellWidth] = useState(width);
  const rawPointsRef = useRef<Point[]>([]);
  const undoStackRef = useRef<ImageData[]>([]);
  const activePointerIdRef = useRef<number | null>(null);
  const smoothedPointRef = useRef<Point | null>(null);
  const hasExtraControls = Boolean(extraControls);
  const resolvedWidth = Math.min(width, shellWidth || width);
  const resolvedHeight = Math.round((resolvedWidth / width) * height);

  const setupCanvasResolution = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const dpr =
      typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const backingWidth = Math.max(1, Math.round(resolvedWidth * dpr));
    const backingHeight = Math.max(1, Math.round(resolvedHeight * dpr));

    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }

    canvas.style.width = `${resolvedWidth}px`;
    canvas.style.height = `${resolvedHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    return ctx;
  }, [resolvedHeight, resolvedWidth]);

  const getCoords = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return { x: 0, y: 0 };
      }

      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * resolvedWidth,
        y: ((event.clientY - rect.top) / rect.height) * resolvedHeight,
      };
    },
    [resolvedHeight, resolvedWidth],
  );

  const snapshotCanvas = useCallback((): ImageData | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const restoreSnapshot = useCallback((snapshot: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.putImageData(snapshot, 0, 0);
  }, []);

  const redrawFromLatestSnapshot = useCallback(
    (previewPoints: Point[] = []) => {
      const ctx = setupCanvasResolution();
      if (!ctx) return;

      const latestSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
      if (latestSnapshot) {
        restoreSnapshot(latestSnapshot);
      } else {
        ctx.clearRect(0, 0, resolvedWidth, resolvedHeight);
      }

      if (previewPoints.length > 0) {
        drawStroke(
          ctx,
          previewPoints,
          Math.min(resolvedWidth, resolvedHeight),
          {
            strokeStyle: "#f8fafc",
            shadowColor: "rgba(96, 165, 250, 0.24)",
            shadowBlur: Math.round(
              getStrokeWidth(Math.min(resolvedWidth, resolvedHeight)) * 0.75,
            ),
            opacity: 1,
          },
        );
      }
    },
    [
      resolvedHeight,
      resolvedWidth,
      restoreSnapshot,
      setupCanvasResolution,
    ],
  );

  const resetCanvas = useCallback(
    (resetStrokeCount: boolean) => {
      const ctx = setupCanvasResolution();
      if (!ctx) return;

      ctx.clearRect(0, 0, resolvedWidth, resolvedHeight);
      const snapshot = snapshotCanvas();
      undoStackRef.current = snapshot ? [snapshot] : [];
      rawPointsRef.current = [];
      smoothedPointRef.current = null;

      if (resetStrokeCount) {
        setStrokeCount(0);
      }
    },
    [resolvedHeight, resolvedWidth, setupCanvasResolution, snapshotCanvas],
  );

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      resetCanvas(true);
    });

    return () => cancelAnimationFrame(rafId);
  }, [character, resetCanvas]);

  useLayoutEffect(() => {
    const shell = canvasShellRef.current;
    if (!shell) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(1, Math.floor(shell.clientWidth));
      setShellWidth((previous) => (previous === nextWidth ? previous : nextWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(shell);
    return () => observer.disconnect();
  }, [width]);

  const handleStart = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();

      const startPoint = getCoords(event);
      setIsDrawing(true);
      rawPointsRef.current = [startPoint];
      smoothedPointRef.current = startPoint;
      redrawFromLatestSnapshot([startPoint]);
      onInteraction?.();
    },
    [getCoords, onInteraction, redrawFromLatestSnapshot],
  );

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      event.preventDefault();

      const lastPoint = rawPointsRef.current[rawPointsRef.current.length - 1];
      const inputPoint = getCoords(event);
      const previousSmoothedPoint = smoothedPointRef.current ?? lastPoint;
      const smoothedPoint = {
        x:
          previousSmoothedPoint.x +
          (inputPoint.x - previousSmoothedPoint.x) * POINTER_SMOOTHING_FACTOR,
        y:
          previousSmoothedPoint.y +
          (inputPoint.y - previousSmoothedPoint.y) * POINTER_SMOOTHING_FACTOR,
      };

      const dx = smoothedPoint.x - lastPoint.x;
      const dy = smoothedPoint.y - lastPoint.y;
      if (dx * dx + dy * dy < MIN_POINT_DISTANCE_SQUARED) {
        return;
      }

      smoothedPointRef.current = smoothedPoint;
      rawPointsRef.current.push(
        ...interpolateSegmentPoints(lastPoint, smoothedPoint),
      );
      redrawFromLatestSnapshot(rawPointsRef.current);
    },
    [getCoords, isDrawing, redrawFromLatestSnapshot],
  );

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (rawPointsRef.current.length > 0) {
      redrawFromLatestSnapshot(rawPointsRef.current);
      const snapshot = snapshotCanvas();
      if (snapshot) {
        undoStackRef.current.push(snapshot);
        setStrokeCount((previous) => previous + 1);
      }
    } else {
      redrawFromLatestSnapshot();
    }

    rawPointsRef.current = [];
    smoothedPointRef.current = null;
  }, [isDrawing, redrawFromLatestSnapshot, snapshotCanvas]);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length <= 1) return;

    undoStackRef.current.pop();
    restoreSnapshot(undoStackRef.current[undoStackRef.current.length - 1]);
    rawPointsRef.current = [];
    smoothedPointRef.current = null;
    setIsDrawing(false);
    setStrokeCount((previous) => Math.max(0, previous - 1));
  }, [restoreSnapshot]);

  const handleClear = useCallback(() => {
    resetCanvas(true);
    setIsDrawing(false);
  }, [resetCanvas]);

  const finishPointerInteraction = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      activePointerIdRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      handleEnd();
    },
    [handleEnd],
  );

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-2.5 transition-all duration-300 sm:gap-3">
        <div
          ref={canvasShellRef}
          className="flex w-full justify-center"
        >
          <div className="app-surface relative inline-block overflow-hidden rounded-[24px] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)] sm:p-3">
            {showGrid && (
              <div className="pointer-events-none absolute inset-2 rounded-[18px] border border-dashed border-white/15 bg-[image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:50%_50%] sm:inset-3">
                <div className="absolute inset-0 bg-[image:linear-gradient(135deg,transparent_49%,rgba(255,255,255,0.04)_50%,transparent_51%),linear-gradient(45deg,transparent_49%,rgba(255,255,255,0.04)_50%,transparent_51%)]" />
              </div>
            )}

            <canvas
              ref={canvasRef}
              className="cursor-crosshair touch-none rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,10,12,0.92),rgba(4,5,7,0.96))] shadow-[inset_0_3px_18px_rgba(0,0,0,0.55)]"
              onPointerDown={(event) => {
                if (activePointerIdRef.current !== null) return;
                activePointerIdRef.current = event.pointerId;
                event.currentTarget.setPointerCapture(event.pointerId);
                handleStart(event);
              }}
              onPointerMove={(event) => {
                if (activePointerIdRef.current !== event.pointerId) return;
                handleMove(event);
              }}
              onPointerUp={finishPointerInteraction}
              onPointerCancel={finishPointerInteraction}
              onLostPointerCapture={(event) => {
                if (activePointerIdRef.current === event.pointerId) {
                  activePointerIdRef.current = null;
                  handleEnd();
                }
              }}
            />
          </div>
        </div>

        <div
          className={`grid w-full gap-2 ${
            hasExtraControls ? "grid-cols-4" : "mx-auto max-w-[180px] grid-cols-2"
          }`}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={strokeCount === 0}
            className="app-action-neon h-10 px-0"
            aria-label="Undo"
            title="Undo"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="app-action-danger h-10 px-0"
            aria-label="Clear"
            title="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {extraControls}
        </div>
      </div>
    </div>
  );
}
