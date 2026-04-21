"use client";

import { nanoid } from "nanoid";
import { useMemo, useState } from "react";
import { saveUserData } from "@/lib/firebase";
import styles from "./page.module.css";

type Gender = "male" | "female";
type GenderValue = Gender | "";

type Athlete = {
  id: string;
  name: string;
  gender: GenderValue;
  bodyWeight: string;
  liftedWeight: string;
};

const WILKS_COEFFICIENTS: Record<Gender, [number, number, number, number, number, number]> = {
  male: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 0.00000701863, -0.00000001291],
  female: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054],
};

function parsePositiveNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function calculateWilksScore(gender: Gender, bodyWeight: number, liftedWeight: number): { coefficient: number; score: number } {
  const [a, b, c, d, e, f] = WILKS_COEFFICIENTS[gender];
  const denominator = a + b * bodyWeight + c * bodyWeight ** 2 + d * bodyWeight ** 3 + e * bodyWeight ** 4 + f * bodyWeight ** 5;
  const coefficient = 500 / denominator;
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

export default function Home() {
  const [athletes, setAthletes] = useState<Athlete[]>([
    { id: nanoid(), name: "", gender: "", bodyWeight: "", liftedWeight: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const calculatedAthletes = useMemo(() => {
    return athletes
      .map((athlete) => {
        const bodyWeight = parsePositiveNumber(athlete.bodyWeight);
        const liftedWeight = parsePositiveNumber(athlete.liftedWeight);

        if (!athlete.gender || !bodyWeight || !liftedWeight) {
          return {
            ...athlete,
            coefficient: null,
            score: null,
          };
        }

        const { coefficient, score } = calculateWilksScore(athlete.gender, bodyWeight, liftedWeight);
        return {
          ...athlete,
          coefficient,
          score,
        };
      })
      .sort((a, b) => {
        const scoreA = a.score ?? -Infinity;
        const scoreB = b.score ?? -Infinity;
        return scoreB - scoreA;
      });
  }, [athletes]);

  const leaderId = calculatedAthletes.find((athlete) => athlete.score !== null)?.id;

  function addAthlete() {
    setAthletes((current) => [
      ...current,
      {
        id: nanoid(),
        name: "",
        gender: "",
        bodyWeight: "",
        liftedWeight: "",
      },
    ]);
  }

  function removeAthlete(id: string) {
    setAthletes((current) => current.filter((athlete) => athlete.id !== id));
  }

  function updateAthlete(id: string, field: keyof Omit<Athlete, "id">, value: string) {
    setAthletes((current) =>
      current.map((athlete) => (athlete.id === id ? { ...athlete, [field]: value } : athlete)),
    );
  }

  async function handleSaveData() {
    setIsSaving(true);
    try {
      const dataToSave = {
        athletes: calculatedAthletes,
        timestamp: new Date().toISOString(),
      };
      await saveUserData(dataToSave);
      alert("Данные сохранены успешно!");
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      alert("Ошибка сохранения данных.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Калькулятор Уилкса для строгого подъема на бицепс</h1>
          <p>
            Добавляйте спортсменов, указывайте пол, собственный вес и поднятый вес. Таблица автоматически отсортирует
            участников по итоговому коэффициенту.
          </p>
        </header>

        <section className={styles.formSection}>
          {athletes.map((athlete, index) => (
            <article key={athlete.id} className={styles.athleteCard}>
              <div className={styles.cardTop}>
                <h2>{athlete.name || `Атлет ${index + 1}`}</h2>
                {athletes.length > 1 && (
                  <button type="button" className={styles.removeButton} onClick={() => removeAthlete(athlete.id)}>
                    Удалить
                  </button>
                )}
              </div>

              <div className={styles.fieldsGrid}>
                <label>
                  Имя
                  <input
                    type="text"
                    value={athlete.name}
                    onChange={(event) => updateAthlete(athlete.id, "name", event.target.value)}
                    placeholder="Например: Иван"
                  />
                </label>

                <label>
                  Пол
                  <select
                    value={athlete.gender}
                    onChange={(event) => updateAthlete(athlete.id, "gender", event.target.value as GenderValue)}
                  >
                    <option value="" disabled>
                      Выберите пол
                    </option>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </label>

                <label>
                  Собственный вес (кг)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={athlete.bodyWeight}
                    onChange={(event) => updateAthlete(athlete.id, "bodyWeight", event.target.value)}
                    placeholder="Например: 82.5"
                  />
                </label>

                <label>
                  Поднятый вес (кг)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={athlete.liftedWeight}
                    onChange={(event) => updateAthlete(athlete.id, "liftedWeight", event.target.value)}
                    placeholder="Например: 70"
                  />
                </label>
              </div>
            </article>
          ))}

          <button type="button" className={styles.addButton} onClick={addAthlete}>
            + Добавить спортсмена
          </button>
        </section>

        <section className={styles.resultSection}>
          <h2>Рейтинг по коэффициенту Уилкса</h2>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Спортсмен</th>
                  <th>Пол</th>
                  <th>Собственный вес</th>
                  <th>Поднятый вес</th>
                  <th>Коэффициент</th>
                  <th>Итог</th>
                </tr>
              </thead>
              <tbody>
                {calculatedAthletes.map((athlete, index) => (
                  <tr key={athlete.id} className={athlete.id === leaderId ? styles.leaderRow : ""}>
                    <td>{index + 1}</td>
                    <td>{athlete.name || "Без имени"}</td>
                    <td>{athlete.gender === "male" ? "М" : "Ж"}</td>
                    <td>{athlete.bodyWeight || "—"}</td>
                    <td>{athlete.liftedWeight || "—"}</td>
                    <td>{athlete.coefficient ? athlete.coefficient.toFixed(3) : "—"}</td>
                    <td>{athlete.score ? athlete.score.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSaveData}
            disabled={isSaving}
          >
            {isSaving ? "Сохранение..." : "Сохранить данные"}
          </button>
        </section>
      </main>
    </div>
  );
}
