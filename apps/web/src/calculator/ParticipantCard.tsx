import { Button, Input, Radio } from 'antd';
import type { RadioChangeEvent } from 'antd';
import type { ComparisonRow } from './engine/comparison.type';
import { formatValue } from './format-value';
import { participantName, type ParticipantChanges, type ParticipantDraft } from './participant-draft';

type ParticipantCardProps = {
    participant: ParticipantDraft;
    row: ComparisonRow;
    canRemove: boolean;
    onChange: (id: string, changes: ParticipantChanges) => void;
    onRemove: (id: string) => void;
};

export function ParticipantCard({ participant, row, canRemove, onChange, onRemove }: ParticipantCardProps) {
    const headingId = `${participant.id}-heading`;
    const fieldsId = `${participant.id}-fields`;
    const name = participantName(participant.name, participant.additionOrder);

    const handleSexChange = (event: RadioChangeEvent): void => {
        const sex: unknown = event.target.value;
        if (sex === 'male' || sex === 'female') {
            onChange(participant.id, { sex });
        }
    };

    const handleAttemptChange = (index: number, value: string): void => {
        const attempts: [string, string, string] = [...participant.attempts];
        attempts[index] = value;
        onChange(participant.id, { attempts });
    };

    return (
        <section aria-labelledby={headingId} className="calculator-card calculator-participant">
            <h2 id={headingId} tabIndex={-1}>
                {name}
            </h2>
            <div id={fieldsId} hidden={participant.isCollapsed}>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                        <label htmlFor={`${participant.id}-name`}>Имя (необязательно)</label>
                        <Input
                            id={`${participant.id}-name`}
                            value={participant.name}
                            autoComplete="off"
                            onChange={(event) => onChange(participant.id, { name: event.target.value })}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span id={`${participant.id}-sex-label`}>Пол</span>
                        <Radio.Group
                            aria-labelledby={`${participant.id}-sex-label`}
                            value={participant.sex}
                            onChange={handleSexChange}
                            className="flex flex-wrap gap-2"
                        >
                            <Radio.Button value="male">
                                {participant.sex === 'male' && <span aria-hidden="true">✓ </span>}Мужской
                            </Radio.Button>
                            <Radio.Button value="female">
                                {participant.sex === 'female' && <span aria-hidden="true">✓ </span>}Женский
                            </Radio.Button>
                        </Radio.Group>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor={`${participant.id}-weight`}>Собственный вес, кг</label>
                        <Input
                            id={`${participant.id}-weight`}
                            inputMode="decimal"
                            autoComplete="off"
                            value={participant.bodyWeight}
                            onChange={(event) => onChange(participant.id, { bodyWeight: event.target.value })}
                        />
                    </div>
                    <fieldset className="m-0 min-w-0 border-0 p-0">
                        <legend className="mb-2">Попытки, кг</legend>
                        <div className="calculator-attempts">
                            {participant.attempts.map((attempt, index) => (
                                <div key={index} className="flex min-w-0 flex-col gap-2">
                                    <label htmlFor={`${participant.id}-attempt-${index}`}>Попытка {index + 1}</label>
                                    <Input
                                        id={`${participant.id}-attempt-${index}`}
                                        inputMode="decimal"
                                        autoComplete="off"
                                        value={attempt}
                                        onChange={(event) => handleAttemptChange(index, event.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </fieldset>
                </div>
            </div>
            {/* После фокуса на заголовке следующий Tab ведёт в имя; CSS сохраняет действие в шапке. */}
            <Button
                className="calculator-toggle"
                aria-expanded={!participant.isCollapsed}
                aria-controls={fieldsId}
                onClick={() => onChange(participant.id, { isCollapsed: !participant.isCollapsed })}
            >
                {participant.isCollapsed ? 'Развернуть' : 'Свернуть'}
            </Button>
            <div className="calculator-summary flex flex-col gap-1" role="status" aria-atomic="true">
                <p>
                    Лучшая попытка: {formatValue(row.bestAttempt)}
                    {row.bestAttempt === null ? '' : ' кг'}
                </p>
                <p>
                    Коэффициент: {formatValue(row.coefficient, { maximumFractionDigits: 4, minimumFractionDigits: 4 })}
                </p>
                <p>
                    Итог:{' '}
                    <strong>{formatValue(row.score, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</strong>
                </p>
            </div>
            <Button
                disabled={!canRemove}
                aria-describedby={!canRemove ? `${participant.id}-remove-note` : undefined}
                onClick={() => onRemove(participant.id)}
            >
                Удалить спортсмена
            </Button>
            {!canRemove && (
                <p id={`${participant.id}-remove-note`} className="calculator-note">
                    Должен остаться хотя бы один спортсмен
                </p>
            )}
        </section>
    );
}
