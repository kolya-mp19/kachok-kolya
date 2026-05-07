type Gender = 'male' | 'female';

function calculateSchwartzCoefficient(bodyWeight: number): number {
  const adjusted = Math.min(Math.max(bodyWeight, 40), 166);

  if (adjusted <= 126) {
    const x0 = 0.631926 * 10;
    const x1 = 0.262349 * adjusted;
    const x2 = 0.51155 * 10 ** -2 * adjusted ** 2;
    const x3 = 0.519738 * 10 ** -4 * adjusted ** 3;
    const x4 = 0.267626 * 10 ** -6 * adjusted ** 4;
    const x5 = 0.540132 * 10 ** -9 * adjusted ** 5;
    const x6 = 0.728875 * 10 ** -13 * adjusted ** 6;
    return x0 - x1 + x2 - x3 + x4 - x5 - x6;
  }

  if (adjusted <= 136) {
    return 0.521 - 0.0012 * (adjusted - 125);
  }

  if (adjusted <= 146) {
    return 0.509 - 0.0011 * (adjusted - 135);
  }

  if (adjusted <= 156) {
    return 0.498 - 0.001 * (adjusted - 145);
  }

  return 0.4879 - 0.00088185 * (adjusted - 155);
}

function calculateMaloneCoefficient(bodyWeight: number): number {
  const a = 106.011586323613;
  const b = -1.293027130579051;
  const c = 0.322935585328304;
  const adjusted = Math.max(bodyWeight, 29.24);

  return a * adjusted ** b + c;
}

function calculateSchwartzMaloneScore(
  gender: Gender,
  bodyWeight: number,
  liftedWeight: number
): { coefficient: number; score: number } {
  const coefficient =
    gender === 'male'
      ? calculateSchwartzCoefficient(bodyWeight)
      : calculateMaloneCoefficient(bodyWeight);
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

export { calculateSchwartzMaloneScore };
