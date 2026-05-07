import { useMemo } from 'react';
import type { Athlete, CalculatedAthlete, FormulaType } from '../types';
import { calculateScore } from '../lib/calculations';
import { parsePositiveNumber } from '../lib/utils';

interface UseCalculatedAthletesProps {
  athletes: Athlete[];
  formula: FormulaType;
}

interface UseCalculatedAthletesReturn {
  calculatedAthletes: CalculatedAthlete[];
  leaderId: string | undefined;
}

export function useCalculatedAthletes(
  props: UseCalculatedAthletesProps
): UseCalculatedAthletesReturn {
  const { athletes, formula } = props;

  const calculatedAthletes = useMemo(() => {
    return athletes
      .map((athlete) => {
        const bodyWeight = parsePositiveNumber(athlete.bodyWeight);
        const parsedAttempts = athlete.attempts
          .map((attempt) => parsePositiveNumber(attempt))
          .filter((attempt): attempt is number => attempt !== null);
        const bestAttempt = parsedAttempts.length ? Math.max(...parsedAttempts) : null;

        if (!athlete.gender || !bodyWeight || bestAttempt === null) {
          return {
            ...athlete,
            bestAttempt,
            coefficient: null,
            score: null,
          };
        }

        const { coefficient, score } = calculateScore(
          formula,
          athlete.gender,
          bodyWeight,
          bestAttempt
        );
        return {
          ...athlete,
          bestAttempt,
          coefficient,
          score,
        };
      })
      .sort((a, b) => {
        const scoreA = a.score ?? -Infinity;
        const scoreB = b.score ?? -Infinity;
        return scoreB - scoreA;
      });
  }, [athletes, formula]);

  const leaderId = calculatedAthletes.find((athlete) => athlete.score !== null)?.id;

  return { calculatedAthletes, leaderId };
}
