import React, { useEffect, useRef } from 'react';
import { GraphicsPreset } from '../types/game';

interface NostalgiaLobbyBackdropProps {
  preset: GraphicsPreset;
}

interface EmberMote {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftSpeed: number;
  driftPhase: number;
  alpha: number;
  hue: number; // 24 (orange-red) to 46 (warm gold)
}

interface CloudBand {
  x: number;
  yRatio: number;
  width: number;
  height: number;
  speedX: number;
  alpha: number;
}

interface SupplyDropFlare {
  xRatio: number;
  y: number;
  speedY: number;
  driftX: number;
  alpha: number;
  trailLength: number;
}

export const NostalgiaLobbyBackdrop: React.FC<NostalgiaLobbyBackdropProps> = ({ preset }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Scale internal canvas resolution and particle budget to keep mobile GPU/CPU usage very low
    const dpr = preset === 'HIGH' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    const emberCount = preset === 'HIGH' ? 48 : preset === 'MEDIUM' ? 30 : 16;
    const cloudCount = preset === 'LOW' ? 4 : 7;

    const updateSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Seed procedural embers
    const embers: EmberMote[] = Array.from({ length: emberCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.1 + Math.random() * 2.4,
      speedY: 14 + Math.random() * 28,
      driftSpeed: 0.7 + Math.random() * 1.6,
      driftPhase: Math.random() * Math.PI * 2,
      alpha: 0.25 + Math.random() * 0.55,
      hue: 22 + Math.random() * 26,
    }));

    // Seed procedural golden-hour cloud silhouettes in the upper sky
    const clouds: CloudBand[] = Array.from({ length: cloudCount }, (_, idx) => ({
      x: (idx / cloudCount) * width + (Math.random() - 0.5) * 120,
      yRatio: 0.08 + (idx % 3) * 0.075 + Math.random() * 0.03,
      width: 170 + Math.random() * 220,
      height: 20 + Math.random() * 26,
      speedX: 4.5 + (idx % 3) * 2.5,
      alpha: 0.06 + Math.random() * 0.06,
    }));

    // Distant nostalgic supply-drop flare descending slowly near the horizon edges
    const flares: SupplyDropFlare[] = [
      {
        xRatio: 0.17,
        y: height * 0.22,
        speedY: 5.5,
        driftX: 1.8,
        alpha: 0.55,
        trailLength: 42,
      },
      {
        xRatio: 0.83,
        y: height * 0.48,
        speedY: 4.2,
        driftX: -1.4,
        alpha: 0.42,
        trailLength: 36,
      },
    ];

    let lastTime = performance.now();

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const t = now * 0.001;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const horizonY = height * 0.62;

      // 1. Warm Golden-Hour Sunset Perimeter Glow (leaves center character turntable clear)
      const skyGlow = ctx.createRadialGradient(
        centerX,
        horizonY,
        Math.min(width, height) * 0.14,
        centerX,
        horizonY,
        Math.max(width, height) * 0.78
      );
      skyGlow.addColorStop(0, 'rgba(255, 190, 92, 0.0)');
      skyGlow.addColorStop(0.45, 'rgba(255, 148, 56, 0.09)');
      skyGlow.addColorStop(0.78, 'rgba(194, 65, 12, 0.18)');
      skyGlow.addColorStop(1, 'rgba(15, 23, 42, 0.44)');
      ctx.fillStyle = skyGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Slow-Rotating Golden Sunbeams (Crepuscular Rays) from the Sunset Horizon
      if (preset !== 'LOW') {
        const rayCount = preset === 'HIGH' ? 8 : 5;
        ctx.save();
        ctx.translate(centerX, horizonY);
        for (let i = 0; i < rayCount; i++) {
          const baseAngle = -Math.PI + ((i + 0.5) / rayCount) * Math.PI;
          const sway = Math.sin(t * 0.22 + i * 1.3) * 0.06;
          const angle = baseAngle + sway;
          const spread = 0.045 + Math.sin(t * 0.35 + i) * 0.012;
          const rayLen = Math.max(width, height) * 0.85;
          const rayAlpha = 0.032 + 0.018 * Math.sin(t * 0.5 + i * 0.9);

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle - spread) * rayLen, Math.sin(angle - spread) * rayLen);
          ctx.lineTo(Math.cos(angle + spread) * rayLen, Math.sin(angle + spread) * rayLen);
          ctx.closePath();

          const grad = ctx.createLinearGradient(
            0,
            0,
            Math.cos(angle) * rayLen * 0.75,
            Math.sin(angle) * rayLen * 0.75
          );
          grad.addColorStop(0, `rgba(251, 191, 36, ${rayAlpha * 0.35})`);
          grad.addColorStop(0.35, `rgba(245, 158, 11, ${rayAlpha})`);
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = grad;
          ctx.fill();
        }
        ctx.restore();
      }

      // 3. Drifting Golden-Amber Sunset Clouds across the upper sky
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        c.x += c.speedX * dt;
        if (c.x - c.width > width + 60) {
          c.x = -c.width - 40;
        }
        const cy = height * c.yRatio + Math.sin(t * 0.3 + i) * 3;
        const cloudGrad = ctx.createRadialGradient(c.x, cy, c.height * 0.2, c.x, cy, c.width * 0.55);
        cloudGrad.addColorStop(0, `rgba(253, 186, 116, ${c.alpha})`);
        cloudGrad.addColorStop(0.55, `rgba(234, 88, 12, ${c.alpha * 0.55})`);
        cloudGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');

        ctx.fillStyle = cloudGrad;
        ctx.beginPath();
        ctx.ellipse(c.x, cy, c.width * 0.5, c.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Classic 2018-Era Tactical Radar Rings & Turntable Floor Halo
      const turntableY = height * 0.77;
      const ringRadii = [
        Math.min(width, height) * 0.21,
        Math.min(width, height) * 0.31,
        Math.min(width, height) * 0.42,
      ];
      ctx.save();
      for (let rIdx = 0; rIdx < ringRadii.length; rIdx++) {
        const rx = ringRadii[rIdx];
        const ry = rx * 0.24;
        const pulse = 0.07 + 0.035 * Math.sin(t * 1.2 - rIdx * 0.8);
        ctx.strokeStyle = `rgba(251, 191, 36, ${pulse})`;
        ctx.lineWidth = rIdx === 0 ? 1.4 : 1;
        ctx.setLineDash(rIdx % 2 === 0 ? [10, 8] : [4, 10]);
        ctx.lineDashOffset = (rIdx % 2 === 0 ? 1 : -1) * t * 14;
        ctx.beginPath();
        ctx.ellipse(centerX, turntableY, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 5. Distant Supply-Drop Flare Streaks on Left/Right Flanks
      if (preset !== 'LOW') {
        for (let i = 0; i < flares.length; i++) {
          const f = flares[i];
          f.y += f.speedY * dt;
          if (f.y > horizonY + 25) {
            f.y = height * 0.12;
          }
          const fx = width * f.xRatio + Math.sin(t * 0.45 + i * 2.1) * 14;
          const fy = f.y;

          // Red-gold smoke & flare trail
          const trailGrad = ctx.createLinearGradient(fx, fy, fx - f.driftX * 8, fy - f.trailLength);
          trailGrad.addColorStop(0, `rgba(248, 113, 113, ${f.alpha})`);
          trailGrad.addColorStop(0.4, `rgba(251, 146, 60, ${f.alpha * 0.45})`);
          trailGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx - f.driftX * 8, fy - f.trailLength);
          ctx.stroke();

          // Tiny parachute canopy silhouette above the flare
          ctx.strokeStyle = `rgba(253, 224, 71, ${f.alpha * 0.55})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(fx, fy - 7, 5, Math.PI, 0);
          ctx.stroke();

          // Glowing flare core
          const flareGlow = ctx.createRadialGradient(fx, fy, 0.5, fx, fy, 7);
          flareGlow.addColorStop(0, `rgba(254, 240, 138, ${f.alpha})`);
          flareGlow.addColorStop(0.5, `rgba(239, 68, 68, ${f.alpha * 0.65})`);
          flareGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = flareGlow;
          ctx.beginPath();
          ctx.arc(fx, fy, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 6. Rising Warm Nostalgia Embers & Golden Dust Motes
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.y -= e.speedY * dt;
        e.x += Math.sin(t * e.driftSpeed + e.driftPhase) * 15 * dt;

        if (e.y < -16) {
          e.y = height + 12;
          e.x = Math.random() * width;
        }
        if (e.x < -16) e.x = width + 12;
        if (e.x > width + 16) e.x = -12;

        // Attenuate embers right over the character's face/chest so the 3D hero stays crisp
        const dx = (e.x - centerX) / (width * 0.22);
        const dy = (e.y - height * 0.48) / (height * 0.28);
        const distSq = dx * dx + dy * dy;
        const centerMask = Math.min(1, Math.max(0.22, distSq));

        const flicker = 0.68 + 0.32 * Math.sin(t * 3.4 + e.driftPhase);
        const finalAlpha = e.alpha * flicker * centerMask;

        const emberGlow = ctx.createRadialGradient(e.x, e.y, 0.2, e.x, e.y, e.radius * 3.2);
        emberGlow.addColorStop(0, `hsla(${e.hue + 12}, 100%, 78%, ${finalAlpha})`);
        emberGlow.addColorStop(0.45, `hsla(${e.hue}, 96%, 56%, ${finalAlpha * 0.55})`);
        emberGlow.addColorStop(1, `hsla(${e.hue}, 96%, 50%, 0)`);

        ctx.fillStyle = emberGlow;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateSize);
    };
  }, [preset]);

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Procedural 2D Canvas for golden-hour sunbeams, clouds, supply flares, and rising embers */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Subtle CSS Golden-Hour Horizon Shimmer & Retro Broadcast Scanline Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35 transition-opacity duration-1000"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(251, 191, 36, 0.03) 0px, rgba(251, 191, 36, 0.03) 1px, transparent 1px, transparent 4px)',
        }}
      />

      {/* Warm Nostalgia Edge Vignette framing the 3D character showcase */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{
          background:
            'radial-gradient(circle at 50% 54%, transparent 32%, rgba(251, 146, 60, 0.07) 68%, rgba(15, 23, 42, 0.52) 100%)',
        }}
      />
    </div>
  );
};
