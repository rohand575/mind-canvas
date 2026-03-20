import { nanoid } from 'nanoid';
import type { CanvasElement, ElementType, Point, StrokeStyle, FillStyle } from '../types';
import {
  DEFAULT_STROKE_COLOR,
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_ROUGHNESS,
  DEFAULT_OPACITY,
  DEFAULT_FONT_SIZE,
  DEFAULT_STROKE_STYLE,
  DEFAULT_FILL_STYLE,
  DEFAULT_EDGE_ROUNDNESS,
} from '../constants';

interface CreateElementOptions {
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[];
  text?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  fontSize?: number;
  strokeStyle?: StrokeStyle;
  fillStyle?: FillStyle;
  edgeRoundness?: number;
  zIndex?: number;
}

export function createElement(options: CreateElementOptions): CanvasElement {
  const now = Date.now();
  return {
    id: nanoid(),
    type: options.type,
    x: options.x,
    y: options.y,
    width: options.width ?? 0,
    height: options.height ?? 0,
    points: options.points,
    text: options.text,
    fontSize: options.type === 'text' ? (options.fontSize ?? DEFAULT_FONT_SIZE) : undefined,
    strokeColor: options.strokeColor ?? DEFAULT_STROKE_COLOR,
    fillColor: options.fillColor ?? DEFAULT_FILL_COLOR,
    strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    roughness: options.roughness ?? DEFAULT_ROUGHNESS,
    opacity: options.opacity ?? DEFAULT_OPACITY,
    strokeStyle: options.strokeStyle ?? DEFAULT_STROKE_STYLE,
    fillStyle: options.fillStyle ?? DEFAULT_FILL_STYLE,
    edgeRoundness: options.edgeRoundness ?? DEFAULT_EDGE_ROUNDNESS,
    rotation: 0,
    zIndex: options.zIndex ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}
