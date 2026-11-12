export type ParticipantSex = 'male' | 'female';
export type ComparisonFormula = 'wilks' | 'ipf-gl';
export type NumericInput = string | number | null | undefined;
export type Attempts = readonly [NumericInput?, NumericInput?, NumericInput?];

/** Идентификатор и уникальный порядок добавления задаёт вызывающий код и сохраняет при редактировании. */
export type ComparisonParticipant = {
    readonly id: string;
    readonly additionOrder: number;
    readonly sex: ParticipantSex | null;
    readonly bodyWeight: NumericInput;
    readonly attempts: Attempts;
};

export type ComparisonInput = {
    readonly formula?: ComparisonFormula;
    readonly participants: readonly ComparisonParticipant[];
};

/** null означает отсутствие значения; конечный ноль и отрицательный итог остаются рассчитанными. */
export type ComparisonRow = {
    id: string;
    additionOrder: number;
    sex: ParticipantSex | null;
    bodyWeight: number | null;
    bestAttempt: number | null;
    coefficient: number | null;
    score: number | null;
    place: number | null;
    isLeader: boolean;
};
