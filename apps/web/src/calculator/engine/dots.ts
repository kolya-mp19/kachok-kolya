import type { ParticipantSex } from './comparison.type';

// Tim Konertz, «Die DOTS-Formeln – Die neuen Wilks», раздел «Die DOTS Formel».
// Источник и независимые протоколы: docs/implementation/epics/e007-calculator-engine/dots-reference.md.
const coefficients = {
    male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
    female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
} as const;

/**
 * По calculator, R8.1 и §8 экстраполирует формулу для любого положительного собственного веса.
 * В отличие от спортивного правила автора не подменяет вес граничным значением диапазона.
 * Коэффициент не округляется; неконечность обрабатывает общий контракт расчёта.
 */
export function calculateDotsCoefficient(sex: ParticipantSex, bodyWeight: number): number {
    const [a, b, c, d, e] = coefficients[sex];
    const denominator = a + b * bodyWeight + c * bodyWeight ** 2 + d * bodyWeight ** 3 + e * bodyWeight ** 4;

    return 500 / denominator;
}
