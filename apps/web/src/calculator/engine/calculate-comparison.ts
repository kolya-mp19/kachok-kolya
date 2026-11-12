import type {
    ComparisonFormula,
    ComparisonInput,
    ComparisonParticipant,
    ComparisonRow,
    NumericInput,
} from './comparison.type';
import { calculateIpfGlCoefficient } from './ipf-gl';
import { calculateWilksCoefficient } from './wilks';

/**
 * Чистый пересчёт по общей формуле сессии; по умолчанию — оригинальный Уилкс.
 * Возвращает все карточки в порядке рейтинга, не изменяя вход; равенство — строгое, до округления.
 * Вызывающий код передаёт уникальные id и конечные уникальные additionOrder.
 * Неполный или неконечный расчёт не получает места; лучшая попытка сохраняется независимо.
 */
export function calculateComparison(input: ComparisonInput): ComparisonRow[] {
    const formula = input.formula ?? 'wilks';
    const rows = input.participants.map((participant) => calculateParticipant(participant, formula));
    rows.sort(compareRows);

    let previousScore: number | null = null;
    let place = 0;
    for (const [index, row] of rows.entries()) {
        if (row.score === null) {
            continue;
        }
        if (row.score !== previousScore) {
            place = index + 1;
        }
        row.place = place;
        row.isLeader = place === 1;
        previousScore = row.score;
    }

    return rows;
}

function calculateParticipant(participant: ComparisonParticipant, formula: ComparisonFormula): ComparisonRow {
    const bodyWeight = parsePositiveNumber(participant.bodyWeight);
    const attempts = participant.attempts.map(parsePositiveNumber).filter((attempt) => attempt !== null);
    const bestAttempt = attempts.length > 0 ? Math.max(...attempts) : null;
    const row: ComparisonRow = {
        id: participant.id,
        additionOrder: participant.additionOrder,
        sex: participant.sex,
        bodyWeight,
        bestAttempt,
        coefficient: null,
        score: null,
        place: null,
        isLeader: false,
    };
    if (participant.sex === null || bodyWeight === null || bestAttempt === null) {
        return row;
    }

    const coefficient =
        formula === 'ipf-gl'
            ? calculateIpfGlCoefficient(participant.sex, bodyWeight)
            : calculateWilksCoefficient(participant.sex, bodyWeight);
    const score = bestAttempt * coefficient;
    // R8.1: отказ любой вычисленной величины скрывает обе, но не лучшую попытку.
    if (!Number.isFinite(coefficient) || !Number.isFinite(score)) {
        return row;
    }
    row.coefficient = coefficient;
    row.score = score;

    return row;
}

function parsePositiveNumber(input: NumericInput): number | null {
    if (input === null || input === undefined) {
        return null;
    }
    let value = input;
    if (typeof value === 'string') {
        const normalized = value.trim().replace(',', '.');
        // Number принимает hex и пустые строки; карточки содержат десятичные значения в кг.
        if (!/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(normalized)) {
            return null;
        }
        value = Number(normalized);
    }

    return Number.isFinite(value) && value > 0 ? value : null;
}

function compareRows(left: ComparisonRow, right: ComparisonRow): number {
    if (left.score === null && right.score !== null) {
        return 1;
    }
    if (left.score !== null && right.score === null) {
        return -1;
    }
    if (left.score !== null && right.score !== null && left.score !== right.score) {
        // Сравнение без вычитания не переполняется на конечных итогах разных знаков.
        return left.score > right.score ? -1 : 1;
    }

    return left.additionOrder - right.additionOrder;
}
