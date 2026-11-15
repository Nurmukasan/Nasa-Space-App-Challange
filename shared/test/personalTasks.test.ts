import { expect, it } from 'vitest';
import { taskMission } from './personalTasks.helpers';

it('gives every launch participant two unique tasks, including MC', () => {
  for (const scenario of ['training', 'signal'] as const)
    for (const n of [1, 2, 3, 4]) {
      const { sim, ids } = taskMission(n, scenario);
      const board = sim.pub.taskBoard;
      expect(board, `${scenario}, ${n} players`).toBeDefined();
      expect(board!.crew.map((p) => p.id)).toEqual(ids);
      expect(board!.tasks).toHaveLength(n * 2);
      expect(new Set(board!.tasks.map((t) => t.id)).size).toBe(n * 2);
      for (const id of ids) {
        const mine = board!.tasks.filter((t) => t.ownerId === id);
        expect(mine).toHaveLength(2);
        expect(mine.map((t) => t.state)).toEqual(['active', 'queued']);
      }
      expect(sim.pub.astronauts).toHaveLength(n === 1 ? 1 : n - 1);
    }
});

it('keeps free and opt-out missions unchanged', () => {
  expect(taskMission(3, 'free').sim.pub.taskBoard).toBeUndefined();
  expect(
    taskMission(3, 'signal', 'science', 5, undefined, false).sim.pub.taskBoard,
  ).toBeUndefined();
});

it('allocates deterministically and varies the assignments across mission seeds', () => {
  const run = (seed: number) => taskMission(4, 'signal', 'science', seed).sim.pub.taskBoard;
  expect(run(42)).toEqual(run(42));
  const variants = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(run(i))));
  expect(variants.size).toBeGreaterThan(3);
});

it('does not promise duplicate finite sample opportunities or require missing equipment', () => {
  for (const preset of ['science', 'balanced', 'budget'] as const) {
    const { sim } = taskMission(4, 'training', preset, 1, ['geologist']);
    const collect = sim.pub.taskBoard!.tasks.filter((t) => t.kind === 'collect');
    const keys = collect.map((t) => `${t.target!.id}:${t.target!.tier}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(collect.map((t) => t.target!.id)).size).toBe(collect.length);
    if (preset !== 'science') expect(collect.every((t) => t.target!.tier === 'surface')).toBe(true);
  }
});
