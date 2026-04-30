'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { Select } from '@/uikit/select';
import styles from './page.module.css';

// ─── Constants ─────────────────────────────────────────────────────────────────

const USERS = [
  { id: 'trainer1', name: 'Иван Тренеров', role: 'trainer' as const, login: 'trainer', password: 'trainer123' },
  { id: 'athlete1', name: 'Алексей Петров', role: 'athlete' as const, login: 'alex', password: 'alex123' },
  { id: 'athlete2', name: 'Мария Сидорова', role: 'athlete' as const, login: 'maria', password: 'maria123' },
  { id: 'athlete3', name: 'Дмитрий Козлов', role: 'athlete' as const, login: 'dima', password: 'dima123' },
];

const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const CATEGORIES: Record<string, { label: string; exercises: string[] }> = {
  legs: { label: 'Ноги', exercises: ['Приседания', 'Румынская тяга', 'Жим ног', 'Трэп-гриф'] },
  back: { label: 'Спина', exercises: ['Подтягивания', 'Тяга на блоке'] },
  shoulders: { label: 'Плечи', exercises: ['Жим стоя (армейский)', 'Разведения в стороны'] },
  arms: { label: 'Руки', exercises: ['Подъём со штангой (прямой гриф)'] },
};

// ─── Types ──────────────────────────────────────────────────────────────────────

type UserRole = 'trainer' | 'athlete';
type User = { id: string; name: string; role: UserRole; login: string; password: string };

type SetEntry = { weight: number; reps: number };
type ExerciseEntry = { id: string; category: string; exerciseName: string; sets: SetEntry[] };
type TrainingDay = { dayIndex: number; exercises: ExerciseEntry[] };
type WeeklyProgram = { athleteId: string; trainingDays: TrainingDay[] };

type WorkoutLog = {
  id: string;
  athleteId: string;
  date: string;
  exercises: { exerciseName: string; sets: SetEntry[] }[];
};

// ─── Utils ──────────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function displayDate(date: Date): string {
  return `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Storage ───────────────────────────────────────────────────────────────────

function loadProgram(athleteId: string): WeeklyProgram {
  try {
    const raw = localStorage.getItem(`wt_prog_${athleteId}`);
    return raw ? JSON.parse(raw) : { athleteId, trainingDays: [] };
  } catch { return { athleteId, trainingDays: [] }; }
}

function saveProgram(p: WeeklyProgram) {
  localStorage.setItem(`wt_prog_${p.athleteId}`, JSON.stringify(p));
}

function loadLogs(athleteId: string): WorkoutLog[] {
  try {
    const raw = localStorage.getItem(`wt_logs_${athleteId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLogs(athleteId: string, logs: WorkoutLog[]) {
  localStorage.setItem(`wt_logs_${athleteId}`, JSON.stringify(logs));
}

// ─── Seed ──────────────────────────────────────────────────────────────────────

function seedIfNeeded() {
  if (localStorage.getItem('wt_seeded')) return;
  localStorage.setItem('wt_seeded', '1');

  const prog: WeeklyProgram = {
    athleteId: 'athlete1',
    trainingDays: [
      {
        dayIndex: 0,
        exercises: [
          { id: 'e1', category: 'legs', exerciseName: 'Приседания', sets: [{ weight: 50, reps: 8 }, { weight: 70, reps: 6 }, { weight: 100, reps: 4 }] },
          { id: 'e2', category: 'legs', exerciseName: 'Румынская тяга', sets: [{ weight: 150, reps: 8 }, { weight: 170, reps: 6 }, { weight: 200, reps: 4 }] },
        ],
      },
      {
        dayIndex: 2,
        exercises: [
          { id: 'e3', category: 'back', exerciseName: 'Подтягивания', sets: [{ weight: 0, reps: 8 }, { weight: 10, reps: 6 }, { weight: 20, reps: 4 }] },
          { id: 'e4', category: 'shoulders', exerciseName: 'Жим стоя (армейский)', sets: [{ weight: 40, reps: 8 }, { weight: 50, reps: 6 }, { weight: 60, reps: 4 }] },
        ],
      },
      {
        dayIndex: 4,
        exercises: [
          { id: 'e5', category: 'arms', exerciseName: 'Подъём со штангой (прямой гриф)', sets: [{ weight: 30, reps: 10 }, { weight: 35, reps: 8 }, { weight: 40, reps: 6 }] },
          { id: 'e6', category: 'legs', exerciseName: 'Жим ног', sets: [{ weight: 100, reps: 10 }, { weight: 120, reps: 8 }, { weight: 140, reps: 6 }] },
        ],
      },
    ],
  };
  saveProgram(prog);

  const logs: WorkoutLog[] = [];
  const today = new Date();
  for (let week = 7; week >= 1; week--) {
    const mon = getMondayOf(new Date(today.getTime() - week * 7 * 86400000));

    const addLog = (dayOffset: number, exercises: { exerciseName: string; sets: SetEntry[] }[]) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + dayOffset);
      logs.push({ id: makeId(), athleteId: 'athlete1', date: toDateStr(d), exercises });
    };

    addLog(0, [
      { exerciseName: 'Приседания', sets: [{ weight: 50 + week * 2, reps: 8 }, { weight: 70 + week * 2, reps: 6 }, { weight: 100 + week * 2, reps: 4 }] },
      { exerciseName: 'Румынская тяга', sets: [{ weight: 150 + week, reps: 8 }, { weight: 170 + week, reps: 6 }, { weight: 200 + week, reps: 4 }] },
    ]);
    addLog(2, [
      { exerciseName: 'Жим стоя (армейский)', sets: [{ weight: 40 + week, reps: 8 }, { weight: 50 + week, reps: 6 }, { weight: 60 + week, reps: 4 }] },
    ]);
    addLog(4, [
      { exerciseName: 'Подъём со штангой (прямой гриф)', sets: [{ weight: 30 + week, reps: 10 }, { weight: 35 + week, reps: 8 }, { weight: 40 + week, reps: 6 }] },
      { exerciseName: 'Жим ног', sets: [{ weight: 100 + week * 3, reps: 10 }, { weight: 120 + week * 3, reps: 8 }, { weight: 140 + week * 3, reps: 6 }] },
    ]);
  }
  saveLogs('athlete1', logs);
}

// ─── Login ─────────────────────────────────────────────────────────────────────

function LoginView({ onLogin }: { onLogin: (u: User) => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = USERS.find(x => x.login === login && x.password === password);
    if (u) { onLogin(u); } else { setError('Неверный логин или пароль'); }
  }

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <h2 className={styles.loginTitle}>Тренировочный трекер</h2>
        <form onSubmit={submit} className={styles.loginForm}>
          <label className={styles.fieldLabel}>
            Логин
            <input className={styles.input} value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" />
          </label>
          <label className={styles.fieldLabel}>
            Пароль
            <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button className={styles.primaryBtn} type="submit">Войти</button>
        </form>
        <div className={styles.demoHint}>
          <strong>Демо:</strong><br />
          trainer / trainer123<br />
          alex / alex123 &nbsp;·&nbsp; maria / maria123 &nbsp;·&nbsp; dima / dima123
        </div>
      </div>
    </div>
  );
}

// ─── Trainer: athlete list ──────────────────────────────────────────────────────

function TrainerView() {
  const athletes = USERS.filter(u => u.role === 'athlete');
  const [editingId, setEditingId] = useState<string | null>(null);

  if (editingId) {
    const athlete = USERS.find(u => u.id === editingId)!;
    return <ProgramEditor athlete={athlete} onBack={() => setEditingId(null)} />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>Спортсмены</h2>
      <div className={styles.athleteList}>
        {athletes.map(a => (
          <div key={a.id} className={styles.athleteRow}>
            <span className={styles.athleteName}>{a.name}</span>
            <button className={styles.outlineBtn} onClick={() => setEditingId(a.id)}>Программа</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trainer: program editor ────────────────────────────────────────────────────

function ProgramEditor({ athlete, onBack }: { athlete: User; onBack: () => void }) {
  const [program, setProgram] = useState<WeeklyProgram>(() => loadProgram(athlete.id));
  const [openDay, setOpenDay] = useState<number | null>(null);

  function persist(p: WeeklyProgram) { setProgram(p); saveProgram(p); }

  function toggleDay(idx: number) {
    const has = program.trainingDays.some(d => d.dayIndex === idx);
    if (has) {
      persist({ ...program, trainingDays: program.trainingDays.filter(d => d.dayIndex !== idx) });
      if (openDay === idx) setOpenDay(null);
    } else {
      persist({
        ...program,
        trainingDays: [...program.trainingDays, { dayIndex: idx, exercises: [] }]
          .sort((a, b) => a.dayIndex - b.dayIndex),
      });
      setOpenDay(idx);
    }
  }

  function updateDay(day: TrainingDay) {
    persist({ ...program, trainingDays: program.trainingDays.map(d => d.dayIndex === day.dayIndex ? day : d) });
  }

  const activeDayCount = program.trainingDays.length;

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={onBack}>← Назад</button>
      <h2 className={styles.sectionTitle}>Программа: {athlete.name}</h2>
      <p className={styles.hint}>Выбрано тренировочных дней: {activeDayCount}</p>

      <div className={styles.dayChips}>
        {DAY_SHORT.map((name, i) => {
          const active = program.trainingDays.some(d => d.dayIndex === i);
          const editing = openDay === i;
          return (
            <div key={i} className={`${styles.chip} ${active ? styles.chipActive : ''} ${editing ? styles.chipEditing : ''}`}>
              <span onClick={() => toggleDay(i)} className={styles.chipLabel}>{name}</span>
              {active && (
                <button className={styles.chipEditBtn} onClick={() => setOpenDay(editing ? null : i)}>
                  {editing ? '✕' : '✏'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {openDay !== null && (() => {
        const day = program.trainingDays.find(d => d.dayIndex === openDay);
        return day ? <DayEditor day={day} onChange={updateDay} /> : null;
      })()}
    </div>
  );
}

// ─── Day editor ─────────────────────────────────────────────────────────────────

function DayEditor({ day, onChange }: { day: TrainingDay; onChange: (d: TrainingDay) => void }) {
  const firstCat = Object.keys(CATEGORIES)[0];
  const [cat, setCat] = useState(firstCat);
  const [exName, setExName] = useState(CATEGORIES[firstCat].exercises[0]);

  function pickCat(c: string) { setCat(c); setExName(CATEGORIES[c].exercises[0]); }

  function addExercise() {
    const entry: ExerciseEntry = { id: makeId(), category: cat, exerciseName: exName, sets: [{ weight: 20, reps: 8 }] };
    onChange({ ...day, exercises: [...day.exercises, entry] });
  }

  function removeExercise(id: string) {
    onChange({ ...day, exercises: day.exercises.filter(e => e.id !== id) });
  }

  function updateExercise(ex: ExerciseEntry) {
    onChange({ ...day, exercises: day.exercises.map(e => e.id === ex.id ? ex : e) });
  }

  return (
    <div className={styles.dayEditor}>
      <h3 className={styles.dayEditorTitle}>{DAY_FULL[day.dayIndex]}</h3>
      <div className={styles.addExRow}>
        <Select value={cat} onChange={e => pickCat(e.target.value)}>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={exName} onChange={e => setExName(e.target.value)}>
          {CATEGORIES[cat].exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </Select>
        <button className={styles.primaryBtn} onClick={addExercise}>+ Упражнение</button>
      </div>
      {day.exercises.map(ex => (
        <ExerciseBlock key={ex.id} exercise={ex} onChange={updateExercise} onRemove={() => removeExercise(ex.id)} />
      ))}
    </div>
  );
}

// ─── Exercise block ─────────────────────────────────────────────────────────────

function ExerciseBlock({ exercise, onChange, onRemove }: {
  exercise: ExerciseEntry;
  onChange: (e: ExerciseEntry) => void;
  onRemove: () => void;
}) {
  function updSet(i: number, field: keyof SetEntry, raw: string) {
    const num = parseFloat(raw.replace(',', '.'));
    onChange({ ...exercise, sets: exercise.sets.map((s, idx) => idx === i ? { ...s, [field]: isNaN(num) || num < 0 ? 0 : num } : s) });
  }

  function addSet() {
    const last = exercise.sets.at(-1) ?? { weight: 20, reps: 8 };
    onChange({ ...exercise, sets: [...exercise.sets, { ...last }] });
  }

  function removeSet(i: number) {
    if (exercise.sets.length <= 1) return;
    onChange({ ...exercise, sets: exercise.sets.filter((_, idx) => idx !== i) });
  }

  return (
    <div className={styles.exBlock}>
      <div className={styles.exHeader}>
        <span className={styles.exName}>{exercise.exerciseName}</span>
        <span className={styles.catBadge}>{CATEGORIES[exercise.category]?.label}</span>
        <button className={styles.removeBtn} onClick={onRemove} aria-label="Удалить">✕</button>
      </div>
      <table className={styles.setsTable}>
        <thead><tr><th>#</th><th>Вес (кг)</th><th>Повт.</th><th></th></tr></thead>
        <tbody>
          {exercise.sets.map((s, i) => (
            <tr key={i}>
              <td className={styles.setNum}>{i + 1}</td>
              <td><input className={styles.numInput} value={s.weight} onChange={e => updSet(i, 'weight', e.target.value)} /></td>
              <td><input className={styles.numInput} value={s.reps} onChange={e => updSet(i, 'reps', e.target.value)} /></td>
              <td><button className={styles.removeBtn} onClick={() => removeSet(i)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className={styles.addSetBtn} onClick={addSet}>+ Подход</button>
    </div>
  );
}

// ─── Athlete view ───────────────────────────────────────────────────────────────

function AthleteView({ user }: { user: User }) {
  const [tab, setTab] = useState<'schedule' | 'progress'>('schedule');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [program] = useState<WeeklyProgram>(() => loadProgram(user.id));
  const [logs, setLogs] = useState<WorkoutLog[]>(() => loadLogs(user.id));

  const monday = useMemo(() => {
    const m = getMondayOf(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    }), [monday]);

  const todayStr = toDateStr(new Date());

  const selectedDayPlan = useMemo(() => {
    if (!selectedDate) return null;
    const idx = weekDates.findIndex(d => toDateStr(d) === selectedDate);
    if (idx === -1) return null;
    return program.trainingDays.find(d => d.dayIndex === idx) ?? null;
  }, [selectedDate, weekDates, program]);

  const selectedLog = useMemo(() =>
    selectedDate ? logs.find(l => l.date === selectedDate) ?? null : null,
    [selectedDate, logs]);

  function markDone() {
    if (!selectedDate || !selectedDayPlan) return;
    const log: WorkoutLog = {
      id: makeId(),
      athleteId: user.id,
      date: selectedDate,
      exercises: selectedDayPlan.exercises.map(ex => ({ exerciseName: ex.exerciseName, sets: ex.sets })),
    };
    const updated = [...logs, log];
    setLogs(updated);
    saveLogs(user.id, updated);
  }

  return (
    <div className={styles.container}>
      <div className={styles.tabBar}>
        <button className={`${styles.tabBtn} ${tab === 'schedule' ? styles.tabActive : ''}`} onClick={() => setTab('schedule')}>Расписание</button>
        <button className={`${styles.tabBtn} ${tab === 'progress' ? styles.tabActive : ''}`} onClick={() => setTab('progress')}>Прогресс</button>
      </div>

      {tab === 'schedule' && (
        <>
          <div className={styles.weekNav}>
            <button className={styles.navBtn} onClick={() => { setWeekOffset(o => o - 1); setSelectedDate(null); }}>‹</button>
            <span className={styles.weekLabel}>{displayDate(weekDates[0])} – {displayDate(weekDates[6])}</span>
            <button className={styles.navBtn} onClick={() => { setWeekOffset(o => o + 1); setSelectedDate(null); }}>›</button>
          </div>

          <div className={styles.calRow}>
            {weekDates.map((date, i) => {
              const ds = toDateStr(date);
              const hasTraining = program.trainingDays.some(d => d.dayIndex === i);
              const isLogged = logs.some(l => l.date === ds);
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              return (
                <div
                  key={i}
                  className={[
                    styles.calDay,
                    hasTraining ? styles.calTraining : '',
                    isLogged ? styles.calLogged : '',
                    isToday ? styles.calToday : '',
                    isSelected ? styles.calSelected : '',
                  ].join(' ')}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                >
                  <span className={styles.calDayName}>{DAY_SHORT[i]}</span>
                  <span className={styles.calDayNum}>{date.getDate()}</span>
                  {hasTraining && <span className={styles.calDot}>{isLogged ? '✓' : '·'}</span>}
                </div>
              );
            })}
          </div>

          {selectedDate && (
            <div className={styles.dayDetail}>
              {selectedDayPlan ? (
                <>
                  <h3 className={styles.detailTitle}>
                    {DAY_FULL[weekDates.findIndex(d => toDateStr(d) === selectedDate)]}
                  </h3>
                  {selectedDayPlan.exercises.map(ex => (
                    <div key={ex.id} className={styles.exBlock}>
                      <div className={styles.exHeader}>
                        <span className={styles.exName}>{ex.exerciseName}</span>
                        <span className={styles.catBadge}>{CATEGORIES[ex.category]?.label}</span>
                      </div>
                      <table className={styles.setsTable}>
                        <thead><tr><th>#</th><th>Вес</th><th>Повт.</th></tr></thead>
                        <tbody>
                          {ex.sets.map((s, i) => (
                            <tr key={i}>
                              <td className={styles.setNum}>{i + 1}</td>
                              <td>{s.weight} кг</td>
                              <td>{s.reps}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {selectedLog
                    ? <p className={styles.doneNote}>✓ Тренировка выполнена</p>
                    : <button className={styles.primaryBtn} onClick={markDone}>Отметить выполненной</button>
                  }
                </>
              ) : (
                <p className={styles.emptyNote}>В этот день тренировки нет.</p>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'progress' && <ProgressView logs={logs} />}
    </div>
  );
}

// ─── Progress charts ────────────────────────────────────────────────────────────

function ProgressView({ logs }: { logs: WorkoutLog[] }) {
  const exerciseNames = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => l.exercises.forEach(e => set.add(e.exerciseName)));
    return Array.from(set).sort();
  }, [logs]);

  const [selected, setSelected] = useState(() => exerciseNames[0] ?? '');

  const data = useMemo(() => {
    if (!selected) return [];
    return logs
      .filter(l => l.exercises.some(e => e.exerciseName === selected))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(log => {
        const ex = log.exercises.find(e => e.exerciseName === selected)!;
        const tonnage = ex.sets.reduce((s, set) => s + set.weight * set.reps, 0);
        const maxSet = ex.sets.reduce((best, s) => s.weight > best.weight ? s : best, ex.sets[0]);
        return { date: log.date.slice(5), tonnage, maxWeight: maxSet.weight, maxReps: maxSet.reps };
      });
  }, [logs, selected]);

  if (exerciseNames.length === 0) {
    return <p className={styles.emptyNote}>Нет данных. Отметьте тренировки выполненными.</p>;
  }

  return (
    <div className={styles.progressWrap}>
      <label className={styles.fieldLabel}>
        Упражнение
        <Select value={selected} onChange={e => setSelected(e.target.value)}>
          {exerciseNames.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </Select>
      </label>

      <div className={styles.chartCard}>
        <h4 className={styles.chartTitle}>Тоннаж за тренировку (кг)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => [`${v} кг`, 'Тоннаж']} />
            <Line type="monotone" dataKey="tonnage" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.chartCard}>
        <h4 className={styles.chartTitle}>Максимальный вес (кг)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { date: string; maxWeight: number; maxReps: number };
                return (
                  <div className={styles.tooltip}>
                    <p className={styles.tooltipDate}>{d.date}</p>
                    <p>{d.maxWeight} кг × {d.maxReps} повт.</p>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="maxWeight" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── App shell ──────────────────────────────────────────────────────────────────

// Seed runs once per client mount during render (only writes to localStorage, no setState)
const _seedRef = { done: false };

export default function WorkoutPage() {
  // Lazy initializer: server returns null (no window), client reads sessionStorage.
  // React 19 handles the server/client mismatch gracefully.
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    // Seed demo data on first client render
    if (!_seedRef.done) { _seedRef.done = true; seedIfNeeded(); }
    try {
      const raw = sessionStorage.getItem('wt_user');
      return raw ? (JSON.parse(raw) as User) : null;
    } catch { return null; }
  });

  function login(u: User) {
    setUser(u);
    sessionStorage.setItem('wt_user', JSON.stringify(u));
  }

  function logout() {
    setUser(null);
    sessionStorage.removeItem('wt_user');
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.headerBack}>← Калькулятор</Link>
          <span className={styles.headerTitle}>Трекер</span>
        </div>
        {user && (
          <div className={styles.headerRight}>
            <span className={styles.headerUser}>{user.name}</span>
            <button className={styles.logoutBtn} onClick={logout}>Выйти</button>
          </div>
        )}
      </header>

      {!user
        ? <LoginView onLogin={login} />
        : user.role === 'trainer'
          ? <TrainerView />
          : <AthleteView user={user} />
      }
    </div>
  );
}
