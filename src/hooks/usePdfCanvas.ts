import { useState, useCallback, useRef } from 'react';
import { SelectionBox, Position } from '../types/common';

export const usePdfCanvas = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Position>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [mousePosition, setMousePosition] = useState<Position>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startSelection = useCallback((position: Position) => {
    setIsSelecting(true);
    setSelectionStart(position);
    setSelectionBox(null);
  }, []);

  const updateSelection = useCallback((currentPosition: Position) => {
    if (!isSelecting) return;

    const box: SelectionBox = {
      x: Math.min(selectionStart.x, currentPosition.x),
      y: Math.min(selectionStart.y, currentPosition.y),
      width: Math.abs(currentPosition.x - selectionStart.x),
      height: Math.abs(currentPosition.y - selectionStart.y)
    };

    setSelectionBox(box);
  }, [isSelecting, selectionStart]);

  const endSelection = useCallback(() => {
    setIsSelecting(false);
    return selectionBox;
  }, [selectionBox]);

  const clearSelection = useCallback(() => {
    setSelectionBox(null);
    setIsSelecting(false);
  }, []);

  const updateMousePosition = useCallback((position: Position) => {
    setMousePosition(position);
  }, []);

  return {
    isSelecting,
    selectionBox,
    mousePosition,
    canvasRef,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    updateMousePosition
  };
};