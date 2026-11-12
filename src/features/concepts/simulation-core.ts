export type Schedule = 'sequential' | 'concurrent' | 'parallel';
export type PlaybackState = { tick: number; total: number; playing: boolean; speed: number };
export type PlaybackAction = { type: 'step'; delta?: number } | { type: 'play' } | { type: 'pause' } | { type: 'reset'; total?: number } | { type: 'speed'; speed: number };
export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'step': { const tick = Math.max(0, Math.min(state.total, state.tick + (action.delta ?? 1))); return { ...state, tick, playing: tick < state.total && state.playing }; }
    case 'play': return { ...state, tick: state.tick >= state.total ? 0 : state.tick, playing: true };
    case 'pause': return { ...state, playing: false };
    case 'reset': return { ...state, tick: 0, total: action.total ?? state.total, playing: false };
    case 'speed': return { ...state, speed: [0.5, 1, 2].includes(action.speed) ? action.speed : 1 };
  }
}
export function threadProgress(tick: number, schedule: Schedule): [number, number] {
  const position = Math.max(0, Math.min(schedule === 'parallel' ? 6 : 12, tick));
  if (schedule === 'sequential') return [Math.min(6, position), Math.max(0, position - 6)];
  if (schedule === 'parallel') return [position, position];
  return [Math.ceil(position / 2), Math.floor(position / 2)];
}
export interface Car { id: number; name: string; speed: number; color: string }
export type CarAction = { type: 'create' } | { type: 'accelerate' | 'brake'; id: number } | { type: 'reset' };
export const initialCars: Car[] = [{ id: 1, name: 'Roadster', speed: 0, color: 'purple' }];
export function carsReducer(cars: Car[], action: CarAction): Car[] {
  if (action.type === 'reset') return initialCars;
  if (action.type === 'create') return cars.length >= 4 ? cars : [...cars, { id: Math.max(...cars.map(car => car.id), 0) + 1, name: ['Roadster', 'Comet', 'Orbit', 'Nova'][cars.length], speed: 0, color: ['purple', 'cyan', 'amber', 'green'][cars.length] }];
  return cars.map(car => car.id === action.id ? { ...car, speed: Math.max(0, Math.min(120, car.speed + (action.type === 'accelerate' ? 20 : -20))) } : car);
}
export function variableName(value: string): string { const clean = value.replace(/[^a-zA-Z0-9_]/g, ''); return /^[a-zA-Z_]/.test(clean) ? clean.slice(0, 18) : 'score'; }
export interface TransactionState { original: [number, number]; balances: [number, number]; status: 'idle' | 'pending' | 'committed' | 'rolled-back' }
export const initialTransaction: TransactionState = { original: [100, 40], balances: [100, 40], status: 'idle' };
export function transactionReducer(state: TransactionState, action: 'begin' | 'commit' | 'rollback' | 'reset'): TransactionState {
  if (action === 'reset') return initialTransaction;
  if (action === 'begin' && state.status === 'idle') return { ...state, balances: [70, 70], status: 'pending' };
  if (action === 'rollback' && state.status === 'pending') return { ...state, balances: state.original, status: 'rolled-back' };
  if (action === 'commit' && state.status === 'pending') return { ...state, original: state.balances, status: 'committed' };
  return state;
}
