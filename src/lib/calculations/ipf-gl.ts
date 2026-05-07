type Gender = 'male' | 'female';

const IPF_GL_CLASSIC_COEFFICIENTS: Record<Gender, [number, number, number]> = {
  male: [1199.72839, 1025.18162, 0.00921],
  female: [610.32796, 1045.59282, 0.03048],
};

function calculateIpfGlScore(
  gender: Gender,
  bodyWeight: number,
  liftedWeight: number
): { coefficient: number; score: number } {
  const [a, b, c] = IPF_GL_CLASSIC_COEFFICIENTS[gender];
  const denominator = a - b * Math.exp(-c * bodyWeight);
  const coefficient = 100 / denominator;
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

export { IPF_GL_CLASSIC_COEFFICIENTS, calculateIpfGlScore };
