import type { ParticipantSex } from './comparison.type';

// Оригинальный Уилкс: IPF, Models Evaluation (март 2020), приложение 1, стр. 13.
// Полный источник и независимые эталоны: docs/implementation/epics/e007-calculator-engine/wilks-reference.md.
const coefficients = {
    male: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 0.00000701863, -0.00000001291],
    female: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054],
} as const;

/** Не ограничивает положительный собственный вес и не округляет коэффициент (calculator, §8). */
export function calculateWilksCoefficient(sex: ParticipantSex, bodyWeight: number): number {
    const [a, b, c, d, e, f] = coefficients[sex];
    const denominator =
        a + b * bodyWeight + c * bodyWeight ** 2 + d * bodyWeight ** 3 + e * bodyWeight ** 4 + f * bodyWeight ** 5;

    return 500 / denominator;
}
