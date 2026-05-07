export type Gender = 'male' | 'female';
export type GenderValue = Gender | '';

export interface Athlete {
  id: string;
  name: string;
  gender: GenderValue;
  bodyWeight: string;
  attempts: [string, string, string];
  collapsed: boolean;
}

export interface CalculatedAthlete extends Athlete {
  bestAttempt: number | null;
  coefficient: number | null;
  score: number | null;
}
