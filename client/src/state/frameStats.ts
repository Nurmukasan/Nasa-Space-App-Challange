/** Measured renderer JavaScript, excluding GPU time and unrelated browser tasks. */
export const frameStats = {
  frames: 0,
  scriptTotalMs: 0,
  scriptMs: null as number | null,
  objects: 0,
  particles: 0,
  terrainMs: 0,
};
export function recordFrame(ms: number, objects: number, particles = 0): void {
  frameStats.frames++;
  frameStats.scriptTotalMs += ms;
  frameStats.scriptMs = ms;
  frameStats.objects = objects;
  frameStats.particles = particles;
}
