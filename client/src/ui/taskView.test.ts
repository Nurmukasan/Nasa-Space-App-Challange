import { expect, it } from 'vitest';
import type { PersonalTask, TaskBoard } from '@rs/shared';
import { ownTasks, taskDestination, taskName } from './taskView';

const collection: PersonalTask = {
  id: 'first',
  originalOwnerId: 'eva',
  ownerId: 'eva',
  kind: 'collect',
  state: 'active',
  target: { id: 'S1', x: 400, y: 500, tier: 'surface' },
};
const board: TaskBoard = {
  crew: [{ id: 'eva', name: 'Scout', role: 'eva', crewClass: 'scout' }],
  tasks: [
    collection,
    { ...collection, id: 'second', after: 'first', state: 'queued', kind: 'deliver' },
  ],
};

it('guides sample collection to its site and delivery to the airlock', () => {
  const lander = { x: 768, y: 768 };
  expect(taskDestination(collection, lander)).toEqual(collection.target);
  expect(taskDestination(board.tasks[1]!, lander)).toEqual(collection.target);
  expect(taskDestination(board.tasks[1]!, lander, [{ siteId: 'S1', tier: 'surface' }])).toEqual(
    lander,
  );
  expect(taskDestination(board.tasks[1]!, lander, [{ siteId: 'S2', tier: 'surface' }])).toEqual(
    collection.target,
  );
});

it('uses current ownership and translates task instructions', () => {
  expect(ownTasks(board, 'mc')).toEqual([]);
  expect(ownTasks(board, 'eva')).toHaveLength(2);
  expect(taskName(collection, board)).toBe('Collect a surface sample at S1');
  expect(
    taskName(
      { ...collection, kind: 'guide', target: { id: 'lander', x: 768, y: 768, playerId: 'eva' } },
      board,
    ),
  ).toBe('Guide Scout to the lander');
});
