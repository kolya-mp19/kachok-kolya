import type { ComparisonRow } from './engine/comparison.type';
import { formatValue } from './format-value';
import { participantName } from './participant-draft';

type ComparisonRankingProps = {
    rows: ComparisonRow[];
    namesById: Record<string, string>;
};

const sexLabels = { male: 'Мужской', female: 'Женский' };

export function ComparisonRanking({ rows, namesById }: ComparisonRankingProps) {
    return (
        <section aria-labelledby="ranking-title" className="flex flex-col gap-3">
            <h2 id="ranking-title">Рейтинг · Уилкс</h2>
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
                    </li>
                ))}
            </ol>
        </section>
    );
}
