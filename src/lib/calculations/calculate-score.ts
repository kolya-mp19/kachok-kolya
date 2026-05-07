import { calculateWilksScore } from './wilks';
import { calculateIpfGlScore } from './ipf-gl';
import { calculateDotsScore } from './dots';
import { calculateSchwartzMaloneScore } from './schwartz-malone';

type Gender = 'male' | 'female';
type FormulaType = 'wilks' | 'ipfGl' | 'dots' | 'schwartzMalone';

function calculateScore(
  formula: FormulaType,
  gender: Gender,
  bodyWeight: number,
  liftedWeight: number
): { coefficient: number; score: number } {
  switch (formula) {
    case 'wilks':
      return calculateWilksScore(gender, bodyWeight, liftedWeight);
    case 'ipfGl':
      return calculateIpfGlScore(gender, bodyWeight, liftedWeight);
    case 'dots':
      return calculateDotsScore(gender, bodyWeight, liftedWeight);
    case 'schwartzMalone':
      return calculateSchwartzMaloneScore(gender, bodyWeight, liftedWeight);
    default:
      return calculateWilksScore(gender, bodyWeight, liftedWeight);
  }
}

export type { FormulaType };
export { calculateScore };
