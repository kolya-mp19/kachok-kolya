'use client';

import { useState } from 'react';
import type { FormulaType } from '../types';
import Button from '../components/ui/button/Button';
import CoefficientsTable from '../components/table/coefficients-table/CoefficientsTable';
import SelectField from '../components/ui/select/SelectField';
import { FORMULA_LABELS, FORMULA_OPTIONS } from '../lib/constants';
import { useAthletes, useCalculatedAthletes } from '../hooks';
import AthleteCard from '../components/athlete/AthleteCard';
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
              options={FORMULA_OPTIONS}
            />
          </div>

          {athletes.map((athlete, index) => (
            <AthleteCard
              key={athlete.id}
              athlete={athlete}
              index={index}
              onToggleCollapse={toggleAthleteCollapse}
              onRemove={removeAthlete}
              onUpdate={updateAthlete}
              showRemove={athletes.length > 1}
            />
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
