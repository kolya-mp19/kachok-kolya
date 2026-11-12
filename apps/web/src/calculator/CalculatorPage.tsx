import { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { calculateComparison } from './engine/calculate-comparison';
import { ParticipantCard } from './ParticipantCard';
import { ComparisonRanking } from './ComparisonRanking';
import { createParticipant, type ParticipantChanges, type ParticipantDraft } from './participant-draft';

export default function CalculatorPage() {
    const [participants, setParticipants] = useState<ParticipantDraft[]>(() => [createParticipant(1)]);
    const nextNumber = useRef(2);
    const pendingFocus = useRef<string | null>(null);
    const rows = calculateComparison({ formula: 'wilks', participants });
    // Карточки сохраняют порядок ввода; рассчитанные строки соединяются по ID, а не по месту.
    const rowsById = Object.fromEntries(rows.map((row) => [row.id, row]));
    const namesById = Object.fromEntries(participants.map((participant) => [participant.id, participant.name]));

    useEffect(() => {
        if (pendingFocus.current) {
            document.getElementById(pendingFocus.current)?.focus();
            pendingFocus.current = null;
        }
    }, [participants]);

    const handleChange = (id: string, changes: ParticipantChanges): void => {
        setParticipants((current) =>
            current.map((participant) => (participant.id === id ? { ...participant, ...changes } : participant)),
        );
    };

    const handleAdd = (): void => {
        const participant = createParticipant(nextNumber.current++);
        pendingFocus.current = `${participant.id}-heading`;
        setParticipants((current) => [...current, participant]);
    };

    const handleRemove = (id: string): void => {
        // Последняя карточка остаётся доступной для нового ввода (calculator, R4).
        if (participants.length === 1) {
            return;
        }

        const index = participants.findIndex((participant) => participant.id === id);
        const neighbor = participants[index + 1] ?? participants[index - 1];
        pendingFocus.current = `${neighbor.id}-heading`;
        setParticipants((current) => current.filter((participant) => participant.id !== id));
    };

    return (
        <section aria-labelledby="calculator-title" className="calculator-page flex flex-col gap-6">
            <div>
                <h1 id="calculator-title">Калькулятор</h1>
                <p className="context-description">Строгий подъём на бицепс</p>
            </div>
            <p>
                Формула: <strong>Уилкс</strong>
            </p>
            <div className="flex flex-col gap-4">
                {participants.map((participant) => (
                    <ParticipantCard
                        key={participant.id}
                        participant={participant}
                        row={rowsById[participant.id]}
                        canRemove={participants.length > 1}
                        onChange={handleChange}
                        onRemove={handleRemove}
                    />
                ))}
            </div>
            <Button type="primary" onClick={handleAdd} block>
                Добавить спортсмена
            </Button>
            <ComparisonRanking rows={rows} namesById={namesById} />
        </section>
    );
}
