/**
 * store/hooks.ts — Typed Redux hooks
 *
 * React-Redux's generic useDispatch and useSelector hooks don't know about
 * our specific store shape, so TypeScript can't help catch mistakes.
 *
 * These typed wrappers solve that — they tell TypeScript:
 * - useAppDispatch: dispatch is our AppDispatch type (knows all our action creators)
 * - useAppSelector: state is our RootState type (knows all our slice shapes)
 *
 * Always import these instead of the raw react-redux versions.
 */

import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './index';

// Typed hooks for Redux usage throughout the app
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
