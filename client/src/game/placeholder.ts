import type { AssetSpec as AssetDef } from './assetManifest';

/** The gallery and Phaser use exactly the same fallback sprite sheet. */
export function placeholderSheet(a: AssetDef): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = a.width * a.frames;
  canvas.height = a.height;
  const ctx = canvas.getContext('2d')!;
  for (let frame = 0; frame < a.frames; frame++) {
    ctx.save();
    ctx.translate(frame * a.width, 0);
    if (a.key === 'astronaut_stripe') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, frame === 8 ? 10 : 7, 8, 2);
    } else if (a.key === 'astronaut') {
      const bob = frame >= 2 && frame < 6 ? frame % 2 : 0;
      ctx.fillStyle = '#20243c';
      ctx.fillRect(3, 3 + bob, 10, 11);
      ctx.fillStyle = '#e2ecff';
      ctx.fillRect(4, 2 + bob, 8, 7);
      ctx.fillRect(4, 9, 8, 4);
      ctx.fillStyle = '#295868';
      ctx.fillRect(6, 4 + bob, 5, 3);
      ctx.fillStyle = '#b0b6c4';
      ctx.fillRect(4, 13, 3, 2 - bob);
      ctx.fillRect(9, 13, 3, 1 + bob);
      if (frame >= 6 && frame < 8) {
        ctx.fillStyle = '#ffce72';
        ctx.fillRect(12, 8, 2, 7);
      }
      if (frame === 8) {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#b0b6c4';
        ctx.fillRect(2, 10, 12, 5);
      }
    } else if (a.key === 'devil') {
      for (let band = 0; band < 5; band++) {
        const y = 27 - band * 5,
          width = 5 + band * 2;
        const x = 16 + Math.sin(frame + band) * 3;
        ctx.fillStyle = band % 2 ? '#b78365' : '#d2a37c';
        ctx.beginPath();
        ctx.ellipse(x, y, width, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (a.key === 'port') {
      ctx.fillStyle = '#202d42';
      ctx.fillRect(0, 0, 8, 8);
      ctx.strokeStyle = frame ? '#ffce72' : '#8cabb6';
      ctx.strokeRect(1, 1, 6, 6);
      ctx.fillStyle = frame ? '#ffce72' : '#50e6f0';
      ctx.fillRect(3, 3, 2, 2);
    } else if (a.key === 'site_signal') {
      ctx.fillStyle = '#4e233d';
      ctx.fillRect(3, 4, 10, 9);
      ctx.strokeStyle = '#ff5782';
      ctx.strokeRect(2, 3, 12, 10);
      ctx.fillStyle = frame ? '#211923' : '#ff9d9d';
      ctx.fillRect(6, 6, 4, 5);
    } else if (a.key === 'crater_decal') {
      ctx.fillStyle = '#331e29';
      ctx.beginPath();
      ctx.ellipse(16, 17, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9ac8ca';
      ctx.beginPath();
      ctx.ellipse(16, 16, 14, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.key === 'fx_debris') {
      ctx.fillStyle = '#bd8b71';
      ctx.fillRect(2, 2, 5, 4);
      ctx.fillStyle = '#51383b';
      ctx.fillRect(1, 5, 5, 2);
    } else if (a.key === 'lander') {
      ctx.fillStyle = '#252c45';
      ctx.fillRect(8, 10, 48, 30);
      ctx.fillStyle = '#c9d8e8';
      ctx.fillRect(12, 6, 40, 30);
      ctx.fillStyle = '#50e6f0';
      ctx.fillRect(26, 20, 12, 20);
      ctx.fillStyle = '#323d58';
      ctx.fillRect(4, 38, 12, 4);
      ctx.fillRect(48, 38, 12, 4);
    } else if (a.key.startsWith('site_')) {
      ctx.fillStyle = frame ? '#43282f' : a.key === 'site_impact' ? '#b8dfed' : '#ffce72';
      ctx.fillRect(3, 5, 10, 8);
      ctx.fillStyle = '#805044';
      ctx.fillRect(5, 3, 6, 2);
      if (frame) {
        ctx.fillStyle = '#1c1828';
        ctx.fillRect(5, 7, 6, 5);
      }
    } else if (a.key === 'beacon') {
      ctx.strokeStyle = '#50e6f0';
      ctx.strokeRect(3 - (frame % 2), 3 - (frame % 2), 10 + (frame % 2) * 2, 10 + (frame % 2) * 2);
      ctx.fillStyle = '#e2ecff';
      ctx.fillRect(7, 5, 2, 6);
    } else if (a.key === 'station' || a.key === 'station_kit') {
      ctx.fillStyle = '#c9d8e8';
      ctx.fillRect(3, 8, 10, 5);
      ctx.fillStyle = '#50e6f0';
      ctx.fillRect(7, 2, 2, 8);
    } else if (a.key.startsWith('rock_') || a.key.startsWith('boulder_')) {
      const w = a.width,
        h = a.height;
      ctx.fillStyle = '#472c30';
      ctx.fillRect(3, h - 5, w - 4, 3);
      ctx.fillStyle = '#996858';
      ctx.fillRect(3, 5, w - 6, h - 9);
      ctx.fillRect(5, 3, w - 10, 3);
      ctx.fillStyle = '#c58c69';
      ctx.fillRect(5, 4, w - 10, 2);
      ctx.fillRect(4, 6, 2, h - 12);
    } else if (a.key === 'debris_chute') {
      ctx.fillStyle = '#b5c5ca';
      ctx.fillRect(3, 4, 22, 8);
      ctx.fillRect(6, 2, 16, 3);
      ctx.fillStyle = '#53677a';
      ctx.fillRect(10, 4, 2, 8);
      ctx.fillRect(18, 4, 2, 8);
      ctx.fillStyle = '#9aaab6';
      ctx.fillRect(9, 15, 1, 9);
      ctx.fillRect(19, 15, 1, 9);
      ctx.fillRect(9, 24, 13, 5);
    } else {
      ctx.fillStyle = a.key.includes('spark') ? '#ffce72' : '#ac7960';
      ctx.fillRect(2, 2, Math.max(2, a.width - 4), Math.max(2, a.height - 4));
    }
    ctx.restore();
  }
  return canvas;
}
