import { useState } from 'react';
import { Button } from 'antd';
import type { ComparisonFormula, ComparisonRow } from './engine/comparison.type';
import { formatValue } from './format-value';
import { formulaLabels } from './formula-labels';
import { participantName } from './participant-draft';

type ComparisonRankingProps = {
    rows: ComparisonRow[];
    namesById: Record<string, string>;
    formula: ComparisonFormula;
};

const sexLabels = { male: 'Мужской', female: 'Женский' };

export function ComparisonRanking({ rows, namesById, formula }: ComparisonRankingProps) {
    const [isPrecisionVisible, setIsPrecisionVisible] = useState(false);

    return (
        <section aria-labelledby="ranking-title" className="flex flex-col gap-3">
            <h2 id="ranking-title">Рейтинг · {formulaLabels[formula]}</h2>
            <Button
                className="calculator-precision-action"
                aria-expanded={isPrecisionVisible}
                aria-controls="ranking-precision-note"
                onClick={() => setIsPrecisionVisible((visible) => !visible)}
            >
                {isPrecisionVisible ? 'Скрыть точность' : 'Показать точнее'}
            </Button>
            <p id="ranking-precision-note" hidden={!isPrecisionVisible} className="calculator-note">
                Короткие подписи округлены. Места определены до округления.
            </p>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {rows.map((row) => (
                    <li key={row.id} className={`calculator-ranking-row${row.isLeader ? ' calculator-leader' : ''}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="m-0 text-base font-semibold">
                                {participantName(namesById[row.id], row.additionOrder)}
                            </h3>
                            <span>Место: {row.place ?? '—'}</span>
                        </div>
                        {row.isLeader && <p className="calculator-leader-label">★ Лидер</p>}
                        <dl className="calculator-ranking-details">
                            <div>
                                <dt>Пол</dt>
                                <dd>{row.sex === null ? '—' : sexLabels[row.sex]}</dd>
                            </div>
                            <div>
                                <dt>Собственный вес, кг</dt>
                                <dd>{formatValue(row.bodyWeight)}</dd>
                            </div>
                            <div>
                                <dt>Лучшая попытка, кг</dt>
                                <dd>{formatValue(row.bestAttempt)}</dd>
                            </div>
                            <div>
                                <dt>Коэффициент</dt>
                                <dd>
                                    {formatValue(row.coefficient, {
                                        maximumFractionDigits: 4,
                                        minimumFractionDigits: 4,
                                    })}
                                </dd>
                            </div>
                            <div className="calculator-score">
                                <dt>Итог</dt>
                                <dd>
                                    {formatValue(row.score, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </dd>
                            </div>
                        </dl>
                        {isPrecisionVisible && row.score !== null && (
                            <p className="mt-3">
                                {/* toString сохраняет различия number, включая очень малые итоги: фиксированная точность может их скрыть. */}
                                Итог до округления: {row.score.toString().replace('.', ',')}
                            </p>
                        )}
                    </li>
                ))}
            </ol>
        </section>
    );
}
