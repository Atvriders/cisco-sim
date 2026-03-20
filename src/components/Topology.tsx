import { useEffect, useRef, useCallback } from 'react';
import type { DeviceState, CdpNeighbor } from '../sim/types';

interface Props {
  deviceState: DeviceState;
}

interface PacketDot {
  linkIndex: number;
  progress: number; // 0 = SW1 side, 1 = neighbor side
  direction: 1 | -1; // 1 = toward neighbor, -1 = toward SW1
  speed: number; // progress units per ms
}

const SW1_W = 200;
const SW1_H = 60;
const NODE_W = 160;
const NODE_H = 80;

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function getIfColor(lineState: string): string {
  if (lineState === 'up') return '#33ff33';
  if (lineState === 'err-disabled') return '#ff6600';
  if (lineState === 'down') return '#ff4444';
  return '#333333';
}

export default function Topology({ deviceState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animStateRef = useRef<{
    dots: PacketDot[];
    lastSpawn: number[];
    lastFrame: number;
    rafId: number;
  }>({
    dots: [],
    lastSpawn: [],
    lastFrame: 0,
    rafId: 0,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const neighbors: CdpNeighbor[] = deviceState.cdpEnabled ? deviceState.cdpNeighbors : [];
    const radius = Math.min(W, H) * 0.35;

    // Compute neighbor positions
    const neighborPositions: { x: number; y: number }[] = neighbors.map((_, i) => {
      const angle = (2 * Math.PI * i) / neighbors.length - Math.PI / 2;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    // Clear
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#020a02';
    ctx.fillRect(0, 0, W, H);

    // --- Draw links ---
    neighbors.forEach((neighbor, i) => {
      const nx = neighborPositions[i].x;
      const ny = neighborPositions[i].y;

      const iface = deviceState.interfaces[neighbor.localInterface];
      const isUp = iface ? iface.lineState === 'up' : false;
      const lineColor = isUp ? '#1a7a1a' : '#4a1010';
      const glowColor = isUp ? '#33ff33' : '#ff4444';

      // Glow
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isUp ? 6 : 2;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = isUp ? 2 : 1;
      ctx.setLineDash(isUp ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.restore();

      // Link label — midpoint
      const midX = (cx + nx) / 2;
      const midY = (cy + ny) / 2;
      const labelText = `${neighbor.localInterface} ↔ ${neighbor.remoteInterface}`;

      ctx.save();
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textW = ctx.measureText(labelText).width;
      ctx.fillStyle = 'rgba(2,10,2,0.85)';
      ctx.fillRect(midX - textW / 2 - 3, midY - 7, textW + 6, 14);
      ctx.fillStyle = isUp ? '#2a6a2a' : '#6a2a2a';
      ctx.fillText(labelText, midX, midY);
      ctx.restore();
    });

    // --- Draw packet dots on links ---
    const now = performance.now();
    const anim = animStateRef.current;
    const dt = now - anim.lastFrame;
    anim.lastFrame = now;

    // Spawn new dots
    neighbors.forEach((neighbor, i) => {
      const iface = deviceState.interfaces[neighbor.localInterface];
      if (!iface || iface.lineState !== 'up') return;

      if (anim.lastSpawn[i] === undefined) anim.lastSpawn[i] = 0;
      const spawnInterval = 2000 + (i * 700) % 1000; // 2-3 seconds, offset per link
      if (now - anim.lastSpawn[i] > spawnInterval) {
        anim.dots.push({
          linkIndex: i,
          progress: 0,
          direction: 1,
          speed: 0.0004 + Math.random() * 0.0002,
        });
        anim.lastSpawn[i] = now;
      }
    });

    // Update dots
    anim.dots = anim.dots.filter(dot => {
      dot.progress += dot.direction * dot.speed * dt;
      if (dot.direction === 1 && dot.progress >= 1) {
        dot.direction = -1;
        dot.progress = 1;
      }
      if (dot.direction === -1 && dot.progress <= 0) {
        return false; // remove
      }
      return true;
    });

    // Draw dots
    anim.dots.forEach(dot => {
      const i = dot.linkIndex;
      if (i >= neighborPositions.length) return;
      const nx = neighborPositions[i].x;
      const ny = neighborPositions[i].y;
      const px = cx + (nx - cx) * dot.progress;
      const py = cy + (ny - cy) * dot.progress;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#33ff33';
      ctx.shadowColor = '#33ff33';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    });

    // --- Draw SW1 node ---
    const sw1X = cx - SW1_W / 2;
    const sw1Y = cy - SW1_H / 2;

    ctx.save();
    // Outer glow border
    ctx.shadowColor = '#33ff33';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#33ff33';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#0a1a0a';
    ctx.beginPath();
    ctx.rect(sw1X, sw1Y, SW1_W, SW1_H);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Inner top strip (darker)
    ctx.save();
    ctx.fillStyle = '#0d220d';
    ctx.fillRect(sw1X + 1, sw1Y + 1, SW1_W - 2, 18);
    ctx.restore();

    // Hostname
    ctx.save();
    ctx.font = 'bold 12px "Share Tech Mono", monospace';
    ctx.fillStyle = '#33ff33';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(deviceState.hostname, cx, sw1Y + 10);
    ctx.restore();

    // Platform label
    ctx.save();
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = '#2a6a2a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WS-C2960X-48TS-L', cx, sw1Y + 24);
    ctx.restore();

    // Port indicator dots
    const physInterfaces = Object.values(deviceState.interfaces).filter(
      iface => iface.id.startsWith('Fa') || iface.id.startsWith('Gi0/')
    );
    const maxDots = 28;
    const displayIfaces = physInterfaces.slice(0, maxDots);
    const dotSpacing = (SW1_W - 16) / Math.max(displayIfaces.length - 1, 1);
    const dotY = sw1Y + SW1_H - 12;

    displayIfaces.forEach((iface, di) => {
      const dotX = sw1X + 8 + di * dotSpacing;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      const col = getIfColor(iface.lineState);
      ctx.fillStyle = col;
      if (iface.lineState === 'up') {
        ctx.shadowColor = col;
        ctx.shadowBlur = 4;
      }
      ctx.fill();
      ctx.restore();
    });

    // --- Draw neighbor nodes ---
    neighbors.forEach((neighbor, i) => {
      const nx = neighborPositions[i].x;
      const ny = neighborPositions[i].y;
      const boxX = nx - NODE_W / 2;
      const boxY = ny - NODE_H / 2;

      const iface = deviceState.interfaces[neighbor.localInterface];
      const isUp = iface ? iface.lineState === 'up' : false;
      const borderColor = isUp ? '#1a7a1a' : '#4a1010';
      const glowColor = isUp ? '#33ff33' : '#662222';

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isUp ? 8 : 3;
      ctx.fillStyle = '#060e06';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(boxX, boxY, NODE_W, NODE_H);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Device ID
      ctx.save();
      ctx.font = 'bold 11px "Share Tech Mono", monospace';
      ctx.fillStyle = isUp ? '#33ff33' : '#884444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(truncate(neighbor.deviceId, 18), nx, boxY + 6);
      ctx.restore();

      // Platform
      ctx.save();
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.fillStyle = '#2a5a2a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(truncate(neighbor.platform, 20), nx, boxY + 22);
      ctx.restore();

      // IP
      if (neighbor.ipAddress) {
        ctx.save();
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.fillStyle = '#1a8a8a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(neighbor.ipAddress, nx, boxY + 36);
        ctx.restore();
      }

      // Capability badge
      ctx.save();
      ctx.font = '8px "Share Tech Mono", monospace';
      ctx.fillStyle = '#1a5a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`[${neighbor.capability}]`, nx, boxY + 50);
      ctx.restore();

      // Status dot
      ctx.save();
      ctx.beginPath();
      ctx.arc(boxX + NODE_W - 8, boxY + 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = isUp ? '#33ff33' : '#ff4444';
      if (isUp) { ctx.shadowColor = '#33ff33'; ctx.shadowBlur = 6; }
      ctx.fill();
      ctx.restore();
    });

    // --- Fallback: no neighbors message ---
    if (neighbors.length === 0) {
      ctx.save();
      ctx.font = '12px "Share Tech Mono", monospace';
      ctx.fillStyle = '#1a4a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No CDP neighbors detected', cx, cy + 80);
      ctx.restore();
    }
  }, [deviceState]);

  // Animation loop
  useEffect(() => {
    const anim = animStateRef.current;
    anim.lastFrame = performance.now();

    const loop = () => {
      draw();
      anim.rafId = requestAnimationFrame(loop);
    };
    anim.rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(anim.rafId);
    };
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const onResize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
    };

    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="topology-container" ref={containerRef}>
      <canvas className="topology-canvas" ref={canvasRef} />
      <div className="topology-legend">
        <span style={{ color: '#33ff33' }}>● UP</span>
        <span style={{ color: '#ff4444' }}>● DOWN</span>
        <span style={{ color: '#ff6600' }}>● ERR-DISABLED</span>
        <span style={{ color: '#555' }}>● NOT CONNECTED</span>
        <span style={{ color: '#33ff33', marginTop: 4 }}>● Animated traffic dots</span>
      </div>
    </div>
  );
}
