import { useState } from 'react';
import { nanoid } from 'nanoid';
import type { Athlete, GenderValue } from '../types';

interface UseAthletesReturn {
  athletes: Athlete[];
  addAthlete: () => void;
  removeAthlete: (id: string) => void;
  toggleAthleteCollapse: (id: string) => void;
  updateAthlete: <K extends keyof Omit<Athlete, 'id'>>(
    id: string,
    field: K,
    value: Omit<Athlete, 'id'>[K]
  ) => void;
}

const initialAthlete = (): Athlete => ({
  id: nanoid(),
  name: '',
  gender: '' as GenderValue,
  attempts: ['', '', ''],
  bodyWeight: '',
  collapsed: false,
});

export function useAthletes(): UseAthletesReturn {
  const [athletes, setAthletes] = useState<Athlete[]>([initialAthlete()]);

  function addAthlete() {
    setAthletes((current) => [...current, initialAthlete()]);
  }

  function toggleAthleteCollapse(id: string) {
    setAthletes((current) =>
      current.map((athlete) =>
        athlete.id === id ? { ...athlete, collapsed: !athlete.collapsed } : athlete
      )
    );
  }

  function removeAthlete(id: string) {
    setAthletes((current) => current.filter((athlete) => athlete.id !== id));
  }

  function updateAthlete<K extends keyof Omit<Athlete, 'id'>>(
    id: string,
    field: K,
    value: Omit<Athlete, 'id'>[K]
  ) {
    setAthletes((current) =>
      current.map((athlete) => (athlete.id === id ? { ...athlete, [field]: value } : athlete))
    );
  }

  return { athletes, addAthlete, removeAthlete, toggleAthleteCollapse, updateAthlete };
}
