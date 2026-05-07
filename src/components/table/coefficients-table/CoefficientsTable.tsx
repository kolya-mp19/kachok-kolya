import { typedTable } from '../../ui/table/Table';
import styles from './CoefficientsTable.module.css';

type Gender = 'male' | 'female';
type GenderValue = Gender | '';

type CalculatedAthlete = {
  id: string;
  name: string;
  gender: GenderValue;
  bodyWeight: string;
  bestAttempt: number | null;
  coefficient: number | null;
  score: number | null;
};

type CoefficientsTableProps = {
  athletes: CalculatedAthlete[];
  leaderId: string | undefined;
  formulaLabel: string;
};

const AthleteTable = typedTable<CalculatedAthlete>();

export default function CoefficientsTable({
  athletes,
  leaderId,
  formulaLabel,
}: CoefficientsTableProps) {
  return (
    <section className={styles.resultSection}>
      <h2>Рейтинг по формуле {formulaLabel}</h2>
      <AthleteTable
        rows={athletes}
        rowKey={(athlete) => athlete.id}
        rowClassName={(athlete) => (athlete.id === leaderId ? styles.leaderRow : undefined)}
      >
        <AthleteTable.Column id="rank" title="Место">
          {(_, index) => index + 1}
        </AthleteTable.Column>
        <AthleteTable.Column id="name" title="Спортсмен">
          {(athlete) => athlete.name || 'Без имени'}
        </AthleteTable.Column>
        <AthleteTable.Column id="gender" title="Пол">
          {(athlete) =>
            athlete.gender === 'male' ? 'М' : athlete.gender === 'female' ? 'Ж' : '—'
          }
        </AthleteTable.Column>
        <AthleteTable.Column id="bodyWeight" title="Собственный вес">
          {(athlete) => athlete.bodyWeight || '—'}
        </AthleteTable.Column>
        <AthleteTable.Column id="bestAttempt" title="Лучшая попытка">
          {(athlete) => (athlete.bestAttempt !== null ? athlete.bestAttempt.toFixed(2) : '—')}
        </AthleteTable.Column>
        <AthleteTable.Column id="coefficient" title="Коэффициент">
          {(athlete) => (athlete.coefficient !== null ? athlete.coefficient.toFixed(3) : '—')}
        </AthleteTable.Column>
        <AthleteTable.Column id="score" title="Итог">
          {(athlete) => (athlete.score !== null ? athlete.score.toFixed(2) : '—')}
        </AthleteTable.Column>
      </AthleteTable>
    </section>
  );
}
