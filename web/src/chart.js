// =====================================================================
// Strengthify Web — Chart helper (vanilla canvas, no dependencies)
// =====================================================================

/**
 * Draw a simple line/dot chart on a canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{x:string, y:number}>} points  - x = date label, y = value
 * @param {object} opts
 */
function drawLineChart(canvas, points, opts = {}) {
  const dpr  = window.devicePixelRatio || 1;
  const rect  = canvas.getBoundingClientRect();
  const W     = rect.width  || canvas.offsetWidth  || 300;
  const H     = opts.height || 180;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PAD = { top: 12, right: 16, bottom: 32, left: 48 };
  const cW   = W - PAD.left - PAD.right;
  const cH   = H - PAD.top  - PAD.bottom;

  // Colors from CSS vars (resolved)
  const accent = opts.color   || '#7c6af7';
  const grid   = opts.grid    || 'rgba(255,255,255,0.06)';
  const text   = opts.text    || '#8888aa';

  // Clear
  ctx.clearRect(0, 0, W, H);

  if (!points || points.length === 0) {
    ctx.fillStyle = text;
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', W / 2, H / 2);
    return;
  }

  const values = points.map(p => p.y);
  const minY   = Math.min(...values);
  const maxY   = Math.max(...values);
  const rangeY = maxY - minY || 1;

  function toX(i) { return PAD.left + (i / (points.length - 1 || 1)) * cW; }
  function toY(v) { return PAD.top  + (1 - (v - minY) / rangeY) * cH;     }

  // Grid lines
  const gridLines = 4;
  ctx.strokeStyle = grid;
  ctx.lineWidth   = 1;
  for (let i = 0; i <= gridLines; i++) {
    const y = PAD.top + (i / gridLines) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();

    const val = maxY - (i / gridLines) * rangeY;
    ctx.fillStyle = text;
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(1), PAD.left - 6, y + 4);
  }

  // Gradient fill under line
  if (points.length > 1) {
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    grad.addColorStop(0, accent + '55');
    grad.addColorStop(1, accent + '00');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].y));
    for (let i = 1; i < points.length; i++) ctx.lineTo(toX(i), toY(points[i].y));
    ctx.lineTo(toX(points.length - 1), PAD.top + cH);
    ctx.lineTo(toX(0), PAD.top + cH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = accent;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(toX(i), toY(p.y));
    else ctx.lineTo(toX(i), toY(p.y));
  });
  ctx.stroke();

  // Dots
  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(toX(i), toY(p.y), 4, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = '#0f0f12';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // X-axis labels (show first, last, and middle-ish)
  const labelIndices = new Set([0, points.length - 1]);
  if (points.length > 3) labelIndices.add(Math.floor(points.length / 2));
  ctx.fillStyle = text;
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  labelIndices.forEach(i => {
    const label = points[i].x.slice(5); // MM-DD
    ctx.fillText(label, toX(i), H - 6);
  });
}
