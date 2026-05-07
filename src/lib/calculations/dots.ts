import type { Gender } from '../../types';

const DOTS_COEFFICIENTS: Record<Gender, [number, number, number, number, number]> = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};

function calculateDotsScore(
  gender: Gender,
  bodyWeight: number,
  liftedWeight: number
): { coefficient: number; score: number } {
  const [a, b, c, d, e] = DOTS_COEFFICIENTS[gender];
  const denominator =
    a + b * bodyWeight + c * bodyWeight ** 2 + d * bodyWeight ** 3 + e * bodyWeight ** 4;
  const coefficient = 500 / denominator;
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

export { DOTS_COEFFICIENTS, calculateDotsScore };
