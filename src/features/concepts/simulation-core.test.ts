import { describe, expect, it } from 'vitest';
import { carsReducer, initialCars, initialTransaction, playbackReducer, threadProgress, transactionReducer, variableName } from './simulation-core';
describe('deterministic concept models', () => {
  it('bounds playback, stops at completion, and replays from the start', () => {
    const state = { tick: 5, total: 6, speed: 1, playing: true };
    expect(playbackReducer(state, { type: 'step' })).toMatchObject({ tick: 6, playing: false });
    expect(playbackReducer({ ...state, tick: 6 }, { type: 'play' }).tick).toBe(0);
    expect(playbackReducer({ ...state, tick: 0 }, { type: 'step', delta: -1 }).tick).toBe(0);
  });
  it('distinguishes single-CPU concurrency from parallel work', () => {
    expect(threadProgress(4, 'sequential')).toEqual([4, 0]);
    expect(threadProgress(4, 'concurrent')).toEqual([2, 2]);
    expect(threadProgress(4, 'parallel')).toEqual([4, 4]);
    expect(threadProgress(20, 'concurrent')).toEqual([6, 6]);
  });
  it('keeps object state independent and bounds speed', () => {
    let cars = carsReducer(initialCars, { type: 'create' });
    cars = carsReducer(cars, { type: 'accelerate', id: 2 });
    expect(cars.map(car => car.speed)).toEqual([0, 20]);
    expect(carsReducer(cars, { type: 'brake', id: 1 })[0].speed).toBe(0);
    for (let index = 0; index < 12; index++) cars = carsReducer(cars, { type: 'accelerate', id: 2 });
    expect(cars[1].speed).toBe(120);
  });
  it('rolls back all staged transaction changes', () => {
    const pending = transactionReducer(initialTransaction, 'begin');
    expect(pending.balances).toEqual([70, 70]);
    expect(transactionReducer(pending, 'rollback').balances).toEqual([100, 40]);
    expect(transactionReducer(pending, 'commit').status).toBe('committed');
    expect(transactionReducer(initialTransaction, 'commit')).toEqual(initialTransaction);
  });
  it('produces only supported variable identifiers', () => {
    expect(variableName('my-score!')).toBe('myscore');
    expect(variableName('42invalid')).toBe('score');
  });
});
