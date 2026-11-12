import type { ParticipantSex } from './comparison.type';

// IPF, май 2020, таблица 1: только Classic Powerlifting, без Bench Press и Equipped.
// Источник и независимые протоколы: docs/implementation/epics/e007-calculator-engine/ipf-gl-reference.md.
const coefficients = {
    male: { a: 1199.72839, b: 1025.18162, c: 0.00921 },
    female: { a: 610.32796, b: 1045.59282, c: 0.03048 },
} as const;

/**
 * Справочная адаптация Classic Powerlifting к лучшей попытке строгого подъёма на бицепс.
 * По calculator, R8.1 и §8 не применяет спортивные пороги веса или округление IPF.
 * Неконечный коэффициент обрабатывается общим контрактом расчёта.
 */
export function calculateIpfGlCoefficient(sex: ParticipantSex, bodyWeight: number): number {
    const { a, b, c } = coefficients[sex];

    return 100 / (a - b * Math.exp(-c * bodyWeight));
}
