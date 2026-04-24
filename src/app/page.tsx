"use client";

import { nanoid } from "nanoid";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

type Gender = "male" | "female";
type GenderValue = Gender | "";

type Athlete = {
  id: string;
  name: string;
  gender: GenderValue;
  bodyWeight: string;
  attempts: [string, string, string];
  collapsed: boolean;
};

type FormulaType = "wilks" | "ipfGl" | "dots" | "schwartzMalone";

const FORMULA_LABELS: Record<FormulaType, string> = {
  wilks: "Уилкс",
  ipfGl: "IPF GL Points",
  dots: "DOTS",
  schwartzMalone: "Schwartz/Malone",
};

const WILKS_COEFFICIENTS: Record<Gender, [number, number, number, number, number, number]> = {
  male: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 0.00000701863, -0.00000001291],
  female: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054],
};

const IPF_GL_CLASSIC_COEFFICIENTS: Record<Gender, [number, number, number]> = {
  male: [1199.72839, 1025.18162, 0.00921],
  female: [610.32796, 1045.59282, 0.03048],
};

const DOTS_COEFFICIENTS: Record<Gender, [number, number, number, number, number]> = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
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

function calculateIpfGlScore(gender: Gender, bodyWeight: number, liftedWeight: number): { coefficient: number; score: number } {
  const [a, b, c] = IPF_GL_CLASSIC_COEFFICIENTS[gender];
  const denominator = a - b * Math.exp(-c * bodyWeight);
  const coefficient = 100 / denominator;
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

function calculateDotsScore(gender: Gender, bodyWeight: number, liftedWeight: number): { coefficient: number; score: number } {
  const [a, b, c, d, e] = DOTS_COEFFICIENTS[gender];
  const denominator = a + b * bodyWeight + c * bodyWeight ** 2 + d * bodyWeight ** 3 + e * bodyWeight ** 4;
  const coefficient = 500 / denominator;
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

function calculateSchwartzCoefficient(bodyWeight: number): number {
  const adjusted = Math.min(Math.max(bodyWeight, 40), 166);

  if (adjusted <= 126) {
    const x0 = 0.631926 * 10;
    const x1 = 0.262349 * adjusted;
    const x2 = 0.51155 * 10 ** -2 * adjusted ** 2;
    const x3 = 0.519738 * 10 ** -4 * adjusted ** 3;
    const x4 = 0.267626 * 10 ** -6 * adjusted ** 4;
    const x5 = 0.540132 * 10 ** -9 * adjusted ** 5;
    const x6 = 0.728875 * 10 ** -13 * adjusted ** 6;
    return x0 - x1 + x2 - x3 + x4 - x5 - x6;
  }

  if (adjusted <= 136) {
    return 0.521 - 0.0012 * (adjusted - 125);
  }

  if (adjusted <= 146) {
    return 0.509 - 0.0011 * (adjusted - 135);
  }

  if (adjusted <= 156) {
    return 0.498 - 0.001 * (adjusted - 145);
  }

  return 0.4879 - 0.00088185 * (adjusted - 155);
}

function calculateMaloneCoefficient(bodyWeight: number): number {
  const a = 106.011586323613;
  const b = -1.293027130579051;
  const c = 0.322935585328304;
  const adjusted = Math.max(bodyWeight, 29.24);

  return a * adjusted ** b + c;
}

function calculateSchwartzMaloneScore(gender: Gender, bodyWeight: number, liftedWeight: number): { coefficient: number; score: number } {
  const coefficient = gender === "male" ? calculateSchwartzCoefficient(bodyWeight) : calculateMaloneCoefficient(bodyWeight);
  const score = coefficient * liftedWeight;

  return { coefficient, score };
}

function calculateScore(
  formula: FormulaType,
  gender: Gender,
  bodyWeight: number,
  liftedWeight: number,
): { coefficient: number; score: number } {
  switch (formula) {
    case "wilks":
      return calculateWilksScore(gender, bodyWeight, liftedWeight);
    case "ipfGl":
      return calculateIpfGlScore(gender, bodyWeight, liftedWeight);
    case "dots":
      return calculateDotsScore(gender, bodyWeight, liftedWeight);
    case "schwartzMalone":
      return calculateSchwartzMaloneScore(gender, bodyWeight, liftedWeight);
    default:
      return calculateWilksScore(gender, bodyWeight, liftedWeight);
  }
}

export default function Home() {
  const [athletes, setAthletes] = useState<Athlete[]>([
    { id: nanoid(), name: "", gender: "", bodyWeight: "", attempts: ["", "", ""], collapsed: false },
  ]);
  const [formula, setFormula] = useState<FormulaType>("wilks");

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

        const { coefficient, score } = calculateScore(formula, athlete.gender, bodyWeight, bestAttempt);
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

  function addAthlete() {
    setAthletes((current) => [
      ...current,
      {
        id: nanoid(),
        name: "",
        gender: "",
        bodyWeight: "",
        attempts: ["", "", ""],
        collapsed: false,
      },
    ]);
  }

  function toggleAthleteCollapse(id: string) {
    setAthletes((current) =>
      current.map((athlete) =>
        athlete.id === id ? { ...athlete, collapsed: !athlete.collapsed } : athlete,
      ),
    );
  }

  function removeAthlete(id: string) {
    setAthletes((current) => current.filter((athlete) => athlete.id !== id));
  }

  function updateAthlete<K extends keyof Omit<Athlete, "id">>(id: string, field: K, value: Omit<Athlete, "id">[K]) {
    setAthletes((current) =>
      current.map((athlete) => (athlete.id === id ? { ...athlete, [field]: value } : athlete)),
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Калькулятор коэффициентов силы</h1>
          <p>
            Добавляйте спортсменов, указывайте пол, собственный вес и до 3 попыток. Рейтинг автоматически сортируется
            по лучшей попытке и выбранной формуле.
          </p>
        </header>

        <section className={styles.formSection}>
          <label className={styles.formulaLabel}>
            Формула расчета
            <select value={formula} onChange={(event) => setFormula(event.target.value as FormulaType)}>
              <option value="wilks">Уилкс</option>
              <option value="ipfGl">IPF GL Points</option>
              <option value="dots">DOTS</option>
              <option value="schwartzMalone">Schwartz/Malone</option>
            </select>
          </label>

          {athletes.map((athlete, index) => (
            <article key={athlete.id} className={styles.athleteCard}>
              <div className={styles.cardTop}>
                <h2>{athlete.name || `Атлет ${index + 1}`}</h2>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.collapseButton}
                    onClick={() => toggleAthleteCollapse(athlete.id)}
                  >
                    {athlete.collapsed ? "Развернуть" : "Свернуть"}
                  </button>
                  {athletes.length > 1 && (
                    <button type="button" className={styles.removeButton} onClick={() => removeAthlete(athlete.id)}>
                      Удалить
                    </button>
                  )}
                </div>
              </div>

              {!athlete.collapsed && (
                <>
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
                  </div>

                  <div className={styles.attemptsGrid}>
                    <label>
                      Попытка 1 (кг)
                      <input
                        type="text"
                        inputMode="decimal"
                        value={athlete.attempts[0]}
                        onChange={(event) =>
                          updateAthlete(athlete.id, "attempts", [event.target.value, athlete.attempts[1], athlete.attempts[2]])
                        }
                        placeholder="Например: 70"
                      />
                    </label>

                    <label>
                      Попытка 2 (кг)
                      <input
                        type="text"
                        inputMode="decimal"
                        value={athlete.attempts[1]}
                        onChange={(event) =>
                          updateAthlete(athlete.id, "attempts", [athlete.attempts[0], event.target.value, athlete.attempts[2]])
                        }
                        placeholder="Например: 72.5"
                      />
                    </label>

                    <label>
                      Попытка 3 (кг)
                      <input
                        type="text"
                        inputMode="decimal"
                        value={athlete.attempts[2]}
                        onChange={(event) =>
                          updateAthlete(athlete.id, "attempts", [athlete.attempts[0], athlete.attempts[1], event.target.value])
                        }
                        placeholder="Например: 75"
                      />
                    </label>
                  </div>
                </>
              )}
            </article>
          ))}

          <button type="button" className={styles.addButton} onClick={addAthlete}>
            + Добавить спортсмена
          </button>
        </section>

        <section className={styles.resultSection}>
          <h2>Рейтинг по формуле {FORMULA_LABELS[formula]}</h2>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Место</th>
                  <th>Спортсмен</th>
                  <th>Пол</th>
                  <th>Собственный вес</th>
                  <th>Лучшая попытка</th>
                  <th>Коэффициент</th>
                  <th>Итог</th>
                </tr>
              </thead>
              <tbody>
                {calculatedAthletes.map((athlete, index) => (
                  <tr key={athlete.id} className={athlete.id === leaderId ? styles.leaderRow : ""}>
                    <td>{index + 1}</td>
                    <td>{athlete.name || "Без имени"}</td>
                    <td>{athlete.gender === "male" ? "М" : athlete.gender === "female" ? "Ж" : "—"}</td>
                    <td>{athlete.bodyWeight || "—"}</td>
                    <td>{athlete.bestAttempt !== null ? athlete.bestAttempt.toFixed(2) : "—"}</td>
                    <td>{athlete.coefficient !== null ? athlete.coefficient.toFixed(3) : "—"}</td>
                    <td>{athlete.score !== null ? athlete.score.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
