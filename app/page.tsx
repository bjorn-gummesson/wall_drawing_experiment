'use client'
import { useEffect, useRef, useState } from "react";

interface Line {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
}

interface Point {
  x: number;
  y: number;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [previewLine, setPreviewLine] = useState<Line | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [gridSize, setGridSize] = useState(20);
  const [wallThickness, setWallThickness] = useState(4);
  const [gridColor, setGridColor] = useState('#e5e7eb');
  const [lines, setLines] = useState<Line[]>([]);
  const [history, setHistory] = useState<Line[][]>([[]]);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    redrawCanvas();
  }, [gridSize, gridColor, lines, previewLine, hoverPoint]);

  const undo = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      setLines(history[newStep]);
    }
  };

  const addToHistory = (newLines: Line[]) => {
    const newHistory = history.slice(0, currentStep + 1);
    newHistory.push([...newLines]);
    setHistory(newHistory);
    setCurrentStep(newHistory.length - 1);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }

    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }

    ctx.stroke();
  };

  const drawHoverGuides = (ctx: CanvasRenderingContext2D) => {
    if (!hoverPoint || isDrawing) return;

    ctx.beginPath();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Only show guides when aligned with existing lines
    lines.forEach(line => {
      const threshold = gridSize / 2;

      // Horizontal alignments
      if (Math.abs(hoverPoint.y - line.startY) < threshold ||
          Math.abs(hoverPoint.y - line.endY) < threshold) {
        const alignY = Math.abs(hoverPoint.y - line.startY) < threshold ? line.startY : line.endY;
        ctx.moveTo(0, alignY);
        ctx.lineTo(canvasRef.current?.width || 800, alignY);
      }

      // Vertical alignments
      if (Math.abs(hoverPoint.x - line.startX) < threshold ||
          Math.abs(hoverPoint.x - line.endX) < threshold) {
        const alignX = Math.abs(hoverPoint.x - line.startX) < threshold ? line.startX : line.endX;
        ctx.moveTo(alignX, 0);
        ctx.lineTo(alignX, canvasRef.current?.height || 600);
      }

      // Draw circles near endpoints for snapping indication
      const endpointThreshold = gridSize;
      if (Math.sqrt(Math.pow(hoverPoint.x - line.startX, 2) + Math.pow(hoverPoint.y - line.startY, 2)) < endpointThreshold ||
          Math.sqrt(Math.pow(hoverPoint.x - line.endX, 2) + Math.pow(hoverPoint.y - line.endY, 2)) < endpointThreshold) {
        ctx.beginPath();
        ctx.arc(line.startX, line.startY, 6, 0, Math.PI * 2);
        ctx.arc(line.endX, line.endY, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawLines = (ctx: CanvasRenderingContext2D) => {
    // Draw completed lines
    lines.forEach(line => {
      ctx.beginPath();
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = line.thickness;
      ctx.lineCap = 'square';
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.stroke();
    });

    // Draw preview line and guides
    if (previewLine) {
      // Draw preview line
      ctx.beginPath();
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = previewLine.thickness;
      ctx.lineCap = 'square';
      ctx.moveTo(previewLine.startX, previewLine.startY);
      ctx.lineTo(previewLine.endX, previewLine.endY);
      ctx.stroke();

      if (isDrawing) {
        // Draw alignment guides
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        const guides = findAlignmentGuides(previewLine);
        guides.forEach(guide => {
          ctx.moveTo(guide.startX, guide.startY);
          ctx.lineTo(guide.endX, guide.endY);
        });
        ctx.stroke();

        // Draw length indicators
        const currentLength = getLineLength(previewLine);
        lines.forEach(line => {
          const lineLength = getLineLength(line);
          if (Math.abs(currentLength - lineLength) < gridSize / 2) {
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.arc(previewLine.endX, previewLine.endY, 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        });

        // Draw rectangle indicator
        if (isNearRectangle(previewLine)) {
          ctx.beginPath();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2;
          ctx.setLineDash([2, 2]);
          ctx.rect(
            Math.min(previewLine.startX, previewLine.endX),
            Math.min(previewLine.startY, previewLine.endY),
            Math.abs(previewLine.endX - previewLine.startX),
            Math.abs(previewLine.endY - previewLine.startY)
          );
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }
    }
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawGrid(ctx);
    drawHoverGuides(ctx);
    drawLines(ctx);
  };

  const getLineLength = (line: Line): number => {
    return Math.sqrt(
      Math.pow(line.endX - line.startX, 2) + 
      Math.pow(line.endY - line.startY, 2)
    );
  };

  const isNearRectangle = (line: Line): boolean => {
    const dx = Math.abs(line.endX - line.startX);
    const dy = Math.abs(line.endY - line.startY);
    return Math.abs(dx - dy) < gridSize / 2;
  };

  const findAlignmentGuides = (currentLine: Line): Line[] => {
    const guides: Line[] = [];
    const threshold = gridSize / 2;

    lines.forEach(line => {
      // Horizontal alignment
      if (Math.abs(currentLine.endY - line.startY) < threshold ||
          Math.abs(currentLine.endY - line.endY) < threshold) {
        guides.push({
          startX: 0,
          startY: Math.abs(currentLine.endY - line.startY) < threshold ? line.startY : line.endY,
          endX: canvasRef.current?.width || 800,
          endY: Math.abs(currentLine.endY - line.startY) < threshold ? line.startY : line.endY,
          thickness: 1
        });
      }

      // Vertical alignment
      if (Math.abs(currentLine.endX - line.startX) < threshold ||
          Math.abs(currentLine.endX - line.endX) < threshold) {
        guides.push({
          startX: Math.abs(currentLine.endX - line.startX) < threshold ? line.startX : line.endX,
          startY: 0,
          endX: Math.abs(currentLine.endX - line.startX) < threshold ? line.startX : line.endX,
          endY: canvasRef.current?.height || 600,
          thickness: 1
        });
      }
    });

    return guides;
  };

  const snapToGrid = (value: number): number => {
    return Math.round(value / gridSize) * gridSize;
  };

  const findNearestEndpoint = (point: Point, threshold: number = gridSize): Point | null => {
    let nearest: Point | null = null;
    let minDistance = threshold;

    lines.forEach(line => {
      const startDist = Math.sqrt(
        Math.pow(point.x - line.startX, 2) + Math.pow(point.y - line.startY, 2)
      );
      if (startDist < minDistance) {
        minDistance = startDist;
        nearest = { x: line.startX, y: line.startY };
      }

      const endDist = Math.sqrt(
        Math.pow(point.x - line.endX, 2) + Math.pow(point.y - line.endY, 2)
      );
      if (endDist < minDistance) {
        minDistance = endDist;
        nearest = { x: line.endX, y: line.endY };
      }
    });

    return nearest;
  };

  const snapToAlignments = (x: number, y: number): Point => {
    const threshold = gridSize / 2;
    let snappedX = snapToGrid(x);
    let snappedY = snapToGrid(y);

    // First check for endpoint snapping
    const nearestPoint = findNearestEndpoint({ x, y }, threshold);
    if (nearestPoint) {
      return nearestPoint;
    }

    // Then check for alignments
    lines.forEach(line => {
      // Horizontal alignment
      if (Math.abs(y - line.startY) < threshold) snappedY = line.startY;
      if (Math.abs(y - line.endY) < threshold) snappedY = line.endY;

      // Vertical alignment
      if (Math.abs(x - line.startX) < threshold) snappedX = line.startX;
      if (Math.abs(x - line.endX) < threshold) snappedX = line.endX;
    });

    return { x: snappedX, y: snappedY };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const snapped = snapToAlignments(mouseX, mouseY);

    setIsDrawing(true);
    setStartX(snapped.x);
    setStartY(snapped.y);
    setPreviewLine({
      startX: snapped.x,
      startY: snapped.y,
      endX: snapped.x,
      endY: snapped.y,
      thickness: wallThickness
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const snapped = snapToAlignments(mouseX, mouseY);
    setHoverPoint(snapped);

    if (isDrawing) {
      setPreviewLine({
        startX,
        startY,
        endX: snapped.x,
        endY: snapped.y,
        thickness: wallThickness
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverPoint(null);
    if (isDrawing) {
      stopDrawing();
    }
  };

  const stopDrawing = () => {
    if (isDrawing && previewLine) {
      if (previewLine.startX !== previewLine.endX || previewLine.startY !== previewLine.endY) {
        const newLines = [...lines, previewLine];
        setLines(newLines);
        addToHistory(newLines);
      }
    }
    setIsDrawing(false);
    setPreviewLine(null);
  };

  const clearCanvas = () => {
    setLines([]);
    setPreviewLine(null);
    setHistory([[]]);
    setCurrentStep(0);
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Blueprint Drawing Tool</h1>
      <div className="flex gap-4 mb-4">
        <div>
          <label className="mr-2">Grid Size:</label>
          <select 
            value={gridSize} 
            onChange={(e) => setGridSize(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="10">10px</option>
            <option value="20">20px</option>
            <option value="30">30px</option>
            <option value="40">40px</option>
          </select>
        </div>
        <div>
          <label className="mr-2">Wall Thickness:</label>
          <select 
            value={wallThickness} 
            onChange={(e) => setWallThickness(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="2">Thin</option>
            <option value="4">Medium</option>
            <option value="6">Thick</option>
          </select>
        </div>
        <div>
          <label className="mr-2">Grid Color:</label>
          <select 
            value={gridColor} 
            onChange={(e) => setGridColor(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="#e5e7eb">Light</option>
            <option value="#9ca3af">Medium</option>
            <option value="#4b5563">Dark</option>
          </select>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border border-gray-300"
            style={{ cursor: 'crosshair' }}
            onMouseDown={startDrawing}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseOut={handleMouseLeave}
          />
        </div>
        <div className="flex justify-between mt-4">
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Clear Canvas
          </button>
          <button
            onClick={undo}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Undo (Ctrl+Z)
          </button>
        </div>
      </div>
      <p className="mt-4 text-gray-600">
        Click and drag to draw walls. Red guides show alignments and equal lengths.
        Green guides indicate perfect squares/rectangles. Press Ctrl+Z to undo.
      </p>
    </div>
  );
}
