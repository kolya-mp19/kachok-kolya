import type { Athlete, GenderValue } from '../../types';
import Button from '../ui/button/Button';
import InputField from '../ui/input/InputField';
import SelectField from '../ui/select/SelectField';
import styles from './AthleteCard.module.css';

interface AthleteCardProps {
  athlete: Athlete;
  index: number;
  onToggleCollapse: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: <K extends keyof Omit<Athlete, 'id'>>(
    id: string,
    field: K,
    value: Omit<Athlete, 'id'>[K]
  ) => void;
  showRemove: boolean;
}

export default function AthleteCard({
  athlete,
  index,
  onToggleCollapse,
  onRemove,
  onUpdate,
  showRemove,
}: AthleteCardProps) {
  return (
    <article className={styles.athleteCard}>
      <div className={styles.cardTop}>
        <h2>{athlete.name || `Атлет ${index + 1}`}</h2>
        <div className={styles.cardActions}>
          <Button variant="ghost" onClick={() => onToggleCollapse(athlete.id)}>
            {athlete.collapsed ? 'Развернуть' : 'Свернуть'}
          </Button>
          {showRemove && (
            <Button variant="danger" onClick={() => onRemove(athlete.id)}>
              Удалить
            </Button>
          )}
        </div>
      </div>

      {!athlete.collapsed && (
        <>
          <div className={styles.fieldsGrid}>
            <InputField
              label="Имя"
              value={athlete.name}
              onChange={(value) => onUpdate(athlete.id, 'name', value)}
              placeholder="Например: Иван"
            />

            <SelectField
              label="Пол"
              value={athlete.gender}
              onChange={(value) => onUpdate(athlete.id, 'gender', value as GenderValue)}
              options={[
                { value: '', label: 'Выберите пол', disabled: true },
                { value: 'male', label: 'Мужской' },
                { value: 'female', label: 'Женский' },
              ]}
            />

            <InputField
              label="Собственный вес (кг)"
              value={athlete.bodyWeight}
              onChange={(value) => onUpdate(athlete.id, 'bodyWeight', value)}
              placeholder="Например: 82.5"
              inputMode="decimal"
            />
          </div>

          <div className={styles.attemptsGrid}>
            <InputField
              label="Попытка 1 (кг)"
              value={athlete.attempts[0]}
              onChange={(value) =>
                onUpdate(athlete.id, 'attempts', [value, athlete.attempts[1], athlete.attempts[2]])
              }
              placeholder="Например: 70"
              inputMode="decimal"
            />

            <InputField
              label="Попытка 2 (кг)"
              value={athlete.attempts[1]}
              onChange={(value) =>
                onUpdate(athlete.id, 'attempts', [athlete.attempts[0], value, athlete.attempts[2]])
              }
              placeholder="Например: 72.5"
              inputMode="decimal"
            />

            <InputField
              label="Попытка 3 (кг)"
              value={athlete.attempts[2]}
              onChange={(value) =>
                onUpdate(athlete.id, 'attempts', [athlete.attempts[0], athlete.attempts[1], value])
              }
              placeholder="Например: 75"
              inputMode="decimal"
            />
          </div>
        </>
      )}
    </article>
  );
}
