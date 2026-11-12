import type { ParticipantSex } from './engine/comparison.type';

export type ParticipantDraft = {
    id: string;
    additionOrder: number;
    name: string;
    sex: ParticipantSex | null;
    bodyWeight: string;
    attempts: [string, string, string];
    isCollapsed: boolean;
};

export type ParticipantChanges = {
    name?: string;
    sex?: ParticipantSex | null;
    bodyWeight?: string;
    attempts?: [string, string, string];
    isCollapsed?: boolean;
};

export function createParticipant(number: number): ParticipantDraft {
    return {
        id: `participant-${number}`,
        additionOrder: number,
        name: '',
        sex: null,
        bodyWeight: '',
        attempts: ['', '', ''],
        isCollapsed: false,
    };
}

export function participantName(name: string, additionOrder: number): string {
    return name.trim() || `Спортсмен ${additionOrder}`;
}
