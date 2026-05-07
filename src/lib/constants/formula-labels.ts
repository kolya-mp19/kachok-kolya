import type { FormulaType } from '../../types';
import type { SelectOption } from '../../components/ui/select/SelectField';

export const FORMULA_LABELS: Record<FormulaType, string> = {
  wilks: 'Уилкс',
  ipfGl: 'IPF GL Points',
  dots: 'DOTS',
  schwartzMalone: 'Schwartz/Malone',
} as const;

export const FORMULA_OPTIONS: SelectOption[] = [
  { value: 'wilks', label: FORMULA_LABELS.wilks },
  { value: 'ipfGl', label: FORMULA_LABELS.ipfGl },
  { value: 'dots', label: FORMULA_LABELS.dots },
  { value: 'schwartzMalone', label: FORMULA_LABELS.schwartzMalone },
] as const;
