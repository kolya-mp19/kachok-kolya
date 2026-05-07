import type { FormulaType } from '../../types';

export const FORMULA_LABELS: Record<FormulaType, string> = {
  wilks: 'Уилкс',
  ipfGl: 'IPF GL Points',
  dots: 'DOTS',
  schwartzMalone: 'Schwartz/Malone',
} as const;
