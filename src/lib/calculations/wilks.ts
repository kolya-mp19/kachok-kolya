type Gender = 'male' | 'female';

const WILKS_COEFFICIENTS: Record<Gender, [number, number, number, number, number, number]> = {
  male: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 0.00000701863, -0.00000001291],
  female: [
    594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054,
  ],
};

function calculateWilksScore(
  gender: Gender,
  bodyWeight: number,
  liftedWeight: number
): { coefficient: number; score: number } {
  const [a, b, c, d, e, f] = WILKS_COEFFICIENTS[gender];
  const denominator =
    a +
    b * bodyWeight +
    c * bodyWeight ** 2 +
    d * bodyWeight ** 3 +
    e * bodyWeight ** 4 +
    f * bodyWeight ** 5;
  const coefficient = 500 / denominator;
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

export { WILKS_COEFFICIENTS, calculateWilksScore };
