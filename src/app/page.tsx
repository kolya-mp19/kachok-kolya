'use client';

import { useState } from 'react';
import type { GenderValue, FormulaType } from '../types';
import Button from '../components/ui/button/Button';
import CoefficientsTable from '../components/table/coefficients-table/CoefficientsTable';
import InputField from '../components/ui/input/InputField';
import SelectField from '../components/ui/select/SelectField';
import { FORMULA_LABELS } from '../lib/constants';
import { useAthletes, useCalculatedAthletes } from '../hooks';
import styles from './page.module.css';

export default function Home() {
  const { athletes, addAthlete, removeAthlete, toggleAthleteCollapse, updateAthlete } =
    useAthletes();
  const [formula, setFormula] = useState<FormulaType>('wilks');

  const { calculatedAthletes, leaderId } = useCalculatedAthletes({ athletes, formula });

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Калькулятор коэффициентов силы</h1>
          <p>
            Добавляйте спортсменов, указывайте пол, собственный вес и до 3 попыток. Рейтинг
            автоматически сортируется по лучшей попытке и выбранной формуле.
          </p>
        </header>

        <section className={styles.formSection}>
          <div className={styles.formulaLabel}>
            <SelectField
              label="Формула расчета"
              value={formula}
              onChange={(value) => setFormula(value as FormulaType)}
              options={[
                { value: 'wilks', label: 'Уилкс' },
                { value: 'ipfGl', label: 'IPF GL Points' },
                { value: 'dots', label: 'DOTS' },
                { value: 'schwartzMalone', label: 'Schwartz/Malone' },
              ]}
            />
          </div>

          {athletes.map((athlete, index) => (
            <article key={athlete.id} className={styles.athleteCard}>
              <div className={styles.cardTop}>
                <h2>{athlete.name || `Атлет ${index + 1}`}</h2>
                <div className={styles.cardActions}>
                  <Button variant="ghost" onClick={() => toggleAthleteCollapse(athlete.id)}>
                    {athlete.collapsed ? 'Развернуть' : 'Свернуть'}
                  </Button>
                  {athletes.length > 1 && (
                    <Button variant="danger" onClick={() => removeAthlete(athlete.id)}>
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
                      onChange={(value) => updateAthlete(athlete.id, 'name', value)}
                      placeholder="Например: Иван"
                    />

                    <SelectField
                      label="Пол"
                      value={athlete.gender}
                      onChange={(value) =>
                        updateAthlete(athlete.id, 'gender', value as GenderValue)
                      }
                      options={[
                        { value: '', label: 'Выберите пол', disabled: true },
                        { value: 'male', label: 'Мужской' },
                        { value: 'female', label: 'Женский' },
                      ]}
                    />

                    <InputField
                      label="Собственный вес (кг)"
                      value={athlete.bodyWeight}
                      onChange={(value) => updateAthlete(athlete.id, 'bodyWeight', value)}
                      placeholder="Например: 82.5"
                      inputMode="decimal"
                    />
                  </div>

                  <div className={styles.attemptsGrid}>
                    <InputField
                      label="Попытка 1 (кг)"
                      value={athlete.attempts[0]}
                      onChange={(value) =>
                        updateAthlete(athlete.id, 'attempts', [
                          value,
                          athlete.attempts[1],
                          athlete.attempts[2],
                        ])
                      }
                      placeholder="Например: 70"
                      inputMode="decimal"
                    />

                    <InputField
                      label="Попытка 2 (кг)"
                      value={athlete.attempts[1]}
                      onChange={(value) =>
                        updateAthlete(athlete.id, 'attempts', [
                          athlete.attempts[0],
                          value,
                          athlete.attempts[2],
                        ])
                      }
                      placeholder="Например: 72.5"
                      inputMode="decimal"
                    />

                    <InputField
                      label="Попытка 3 (кг)"
                      value={athlete.attempts[2]}
                      onChange={(value) =>
                        updateAthlete(athlete.id, 'attempts', [
                          athlete.attempts[0],
                          athlete.attempts[1],
                          value,
                        ])
                      }
                      placeholder="Например: 75"
                      inputMode="decimal"
                    />
                  </div>
                </>
              )}
            </article>
          ))}

          <Button variant="primary" onClick={addAthlete} className={styles.addButton}>
            + Добавить спортсмена
          </Button>
        </section>

        <CoefficientsTable
          athletes={calculatedAthletes}
          leaderId={leaderId}
          formulaLabel={FORMULA_LABELS[formula]}
        />
      </main>
    </div>
  );
}
