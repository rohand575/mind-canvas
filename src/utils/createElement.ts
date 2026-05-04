import { nanoid } from 'nanoid';
import type { CanvasElement, ElementType, Point, StrokeStyle, FillStyle, ConnectionBinding, ConnectorStyle } from '../types';
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
  isCode?: boolean;
  codeLanguage?: string;
  imageData?: string;
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
  // New feature fields
  locked?: boolean;
  groupId?: string;
  hyperlink?: string;
  startBinding?: ConnectionBinding;
  endBinding?: ConnectionBinding;
  connectorStyle?: ConnectorStyle;
  connectorLabel?: string;
  frameName?: string;
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
    isCode: options.isCode,
    codeLanguage: options.codeLanguage,
    imageData: options.imageData,
    strokeColor: options.strokeColor ?? DEFAULT_STROKE_COLOR,
    fillColor: options.fillColor ?? (options.type === 'frame' ? 'transparent' : DEFAULT_FILL_COLOR),
    strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    roughness: options.roughness ?? (options.type === 'frame' ? 0 : DEFAULT_ROUGHNESS),
    opacity: options.opacity ?? DEFAULT_OPACITY,
    strokeStyle: options.strokeStyle ?? DEFAULT_STROKE_STYLE,
    fillStyle: options.fillStyle ?? DEFAULT_FILL_STYLE,
    edgeRoundness: options.edgeRoundness ?? DEFAULT_EDGE_ROUNDNESS,
    rotation: 0,
    zIndex: options.zIndex ?? 0,
    createdAt: now,
    updatedAt: now,
    // New feature fields
    locked: options.locked,
    groupId: options.groupId,
    hyperlink: options.hyperlink,
    startBinding: options.startBinding,
    endBinding: options.endBinding,
    connectorStyle: options.connectorStyle,
    connectorLabel: options.connectorLabel,
    frameName: options.type === 'frame' ? (options.frameName ?? 'Frame') : options.frameName,
  };
}
