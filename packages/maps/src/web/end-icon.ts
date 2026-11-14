import type { MapRef } from 'react-map-gl/maplibre';
import { END_ICON_ID } from '../layers.js';

const ICON_SIZE = 12;
const PIXEL_RATIO = 2;
const ICON_COLOR = '#ffffff';

function drawEndIcon(): ImageData | undefined {
  const px = ICON_SIZE * PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const u = px / 12;
  ctx.fillStyle = ICON_COLOR;
  ctx.strokeStyle = ICON_COLOR;
  ctx.lineWidth = 1.4 * u;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(6 * u, 1.5 * u);
  ctx.lineTo(10.5 * u, 4.25 * u);
  ctx.lineTo(6 * u, 7 * u);
  ctx.lineTo(1.5 * u, 4.25 * u);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(1.5 * u, 7.25 * u);
  ctx.lineTo(6 * u, 10 * u);
  ctx.lineTo(10.5 * u, 7.25 * u);
  ctx.stroke();

  return ctx.getImageData(0, 0, px, px);
}

export function addEndIcon(map: ReturnType<MapRef['getMap']>): void {
  if (map.hasImage(END_ICON_ID)) return;
  const image = drawEndIcon();
  if (image) map.addImage(END_ICON_ID, image, { pixelRatio: PIXEL_RATIO });
}
