'use client';

import { useState } from 'react';
import ActivityIcon from '@/components/ui/icon/ActivityIcon';
import ArrowLeftIcon from '@/components/ui/icon/ArrowLeftIcon';
import BarbellIcon from '@/components/ui/icon/BarbellIcon';
import CheckCircleIcon from '@/components/ui/icon/CheckCircleIcon';
import CheckIcon from '@/components/ui/icon/CheckIcon';
import ChevronLeftIcon from '@/components/ui/icon/ChevronLeftIcon';
import ChevronRightIcon from '@/components/ui/icon/ChevronRightIcon';
import ClipboardListIcon from '@/components/ui/icon/ClipboardListIcon';
import ClockIcon from '@/components/ui/icon/ClockIcon';
import DotsIcon from '@/components/ui/icon/DotsIcon';
import FlameIcon from '@/components/ui/icon/FlameIcon';
import HistoryIcon from '@/components/ui/icon/HistoryIcon';
import InfoCircleIcon from '@/components/ui/icon/InfoCircleIcon';
import LeafIcon from '@/components/ui/icon/LeafIcon';
import MessageIcon from '@/components/ui/icon/MessageIcon';
import TrashIcon from '@/components/ui/icon/TrashIcon';
import styles from './page.module.css';

/* ── Types ──────────────────────────────────────────────────── */
type AvatarColor = 'blue' | 'green' | 'amber' | 'pink' | 'purple';
type SlotStatus = 'done' | 'planned' | 'empty';

interface MockExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  weightUnit: 'kg' | 'bw';
}

interface MockSlot {
  id: string;
  order: number;
  title: string;
  status: 'done' | 'planned';
  completedAt?: string;
  rpe?: number;
  exerciseAvgRpe?: number;
  athleteNote?: string;
  exercises: MockExercise[];
  actualSets?: { name: string; actual: string; plan: string; sameAsPlan: boolean; rpe?: number }[];
}

/* ── Mock data ──────────────────────────────────────────────── */
const ATHLETE = {
  name: 'Михаил Смирнов',
  coach: 'Алекс Соколов',
  avatarInitials: 'МС',
  avatarColor: 'blue' as AvatarColor,
};

const CURRENT_SLOTS: MockSlot[] = [
  {
    id: 's1', order: 1,
    title: 'Тренировка 1 — Присед / Жим',
    status: 'done', completedAt: '19 мая', rpe: 7, exerciseAvgRpe: 7,
    athleteNote: 'Немного болела спина, снизил вес на последних сетах',
    exercises: [
      { id: 'e1', name: 'Приседания со штангой', sets: 5, reps: 5, weight: 120, weightUnit: 'kg' },
      { id: 'e2', name: 'Жим лёжа', sets: 4, reps: 6, weight: 90, weightUnit: 'kg' },
      { id: 'e3', name: 'Румынская тяга', sets: 3, reps: 8, weight: 80, weightUnit: 'kg' },
    ],
    actualSets: [
      { name: 'Приседания со штангой', actual: '5×5 · 120 кг', plan: '5×5 · 120 кг', sameAsPlan: true, rpe: 7 },
      { name: 'Жим лёжа', actual: '4×5 · 85 кг', plan: '4×6 · 90 кг', sameAsPlan: false, rpe: 6 },
      { name: 'Румынская тяга', actual: '3×8 · 80 кг', plan: '3×8 · 80 кг', sameAsPlan: true },
    ],
  },
  {
    id: 's2', order: 2,
    title: 'Тренировка 2 — Тяга / Жим сидя',
    status: 'done', completedAt: '21 мая', rpe: 8, exerciseAvgRpe: 8,
    exercises: [
      { id: 'e4', name: 'Становая тяга', sets: 5, reps: 3, weight: 160, weightUnit: 'kg' },
      { id: 'e5', name: 'Жим гантелей сидя', sets: 4, reps: 10, weight: 30, weightUnit: 'kg' },
    ],
    actualSets: [
      { name: 'Становая тяга', actual: '5×3 · 160 кг', plan: '5×3 · 160 кг', sameAsPlan: true, rpe: 9 },
      { name: 'Жим гантелей сидя', actual: '4×10 · 30 кг', plan: '4×10 · 30 кг', sameAsPlan: true, rpe: 7 },
    ],
  },
  {
    id: 's3', order: 3,
    title: 'Тренировка 3 — Объём / Присед',
    status: 'planned',
    exercises: [
      { id: 'e6', name: 'Приседания', sets: 5, reps: 5, weight: 100, weightUnit: 'kg' },
      { id: 'e7', name: 'Становая тяга', sets: 4, reps: 4, weight: 140, weightUnit: 'kg' },
      { id: 'e8', name: 'Жим лёжа широкий хват', sets: 3, reps: 8, weight: 70, weightUnit: 'kg' },
    ],
  },
];

const CURRENT_WEEK_SLOTS: { status: SlotStatus }[] = [
  { status: 'done' }, { status: 'done' }, { status: 'planned' },
];

const HISTORY_WEEKS = [
  {
    id: 'w20', label: 'Неделя 20 · 12–18 мая', doneSlots: 3, totalSlots: 3, avgRpe: 6,
    slots: [{ status: 'done' as SlotStatus }, { status: 'done' as SlotStatus }, { status: 'done' as SlotStatus }],
  },
  {
    id: 'w19', label: 'Неделя 19 · 5–11 мая', doneSlots: 3, totalSlots: 3, avgRpe: 7,
    slots: [{ status: 'done' as SlotStatus }, { status: 'done' as SlotStatus }, { status: 'done' as SlotStatus }],
  },
  {
    id: 'w18', label: 'Неделя 18 · 28 апр – 4 мая', doneSlots: 2, totalSlots: 3, avgRpe: 5,
    slots: [{ status: 'done' as SlotStatus }, { status: 'done' as SlotStatus }, { status: 'empty' as SlotStatus }],
  },
];

const PAST_SLOTS: MockSlot[] = [
  {
    id: 'p1', order: 1,
    title: 'Тренировка 1 — Присед / Жим',
    status: 'done', completedAt: '12 мая', rpe: 6, exerciseAvgRpe: 6,
    athleteNote: 'Хорошая тренировка, всё по плану',
    exercises: [
      { id: 'pe1', name: 'Приседания со штангой', sets: 4, reps: 6, weight: 110, weightUnit: 'kg' },
      { id: 'pe2', name: 'Жим лёжа', sets: 4, reps: 6, weight: 85, weightUnit: 'kg' },
    ],
    actualSets: [
      { name: 'Приседания со штангой', actual: '4×6 · 110 кг', plan: '4×6 · 110 кг', sameAsPlan: true, rpe: 6 },
      { name: 'Жим лёжа', actual: '4×6 · 85 кг', plan: '4×6 · 85 кг', sameAsPlan: true, rpe: 6 },
    ],
  },
  {
    id: 'p2', order: 2,
    title: 'Тренировка 2 — Тяга',
    status: 'done', completedAt: '14 мая', rpe: 7, exerciseAvgRpe: 7,
    exercises: [
      { id: 'pe3', name: 'Становая тяга', sets: 5, reps: 3, weight: 150, weightUnit: 'kg' },
      { id: 'pe4', name: 'Тяга к поясу', sets: 4, reps: 8, weight: 70, weightUnit: 'kg' },
    ],
    actualSets: [
      { name: 'Становая тяга', actual: '4×3 · 150 кг', plan: '5×3 · 150 кг', sameAsPlan: false, rpe: 8 },
      { name: 'Тяга к поясу', actual: '4×8 · 70 кг', plan: '4×8 · 70 кг', sameAsPlan: true, rpe: 6 },
    ],
  },
  {
    id: 'p3', order: 3,
    title: 'Тренировка 3 — Вспомогательные',
    status: 'done', completedAt: '17 мая', rpe: 5,
    exercises: [
      { id: 'pe5', name: 'Выпады со штангой', sets: 3, reps: 10, weight: 50, weightUnit: 'kg' },
      { id: 'pe6', name: 'Подтягивания', sets: 3, reps: 8, weightUnit: 'bw' },
    ],
    actualSets: [
      { name: 'Выпады со штангой', actual: '3×10 · 50 кг', plan: '3×10 · 50 кг', sameAsPlan: true },
      { name: 'Подтягивания', actual: '3×8 · собств.', plan: '3×8 · собств.', sameAsPlan: true },
    ],
  },
];

/* Workout screen initial state — slot 3 exercises */
function makeInitialWorkoutState() {
  return CURRENT_SLOTS[2].exercises.map(ex => ({
    sets: Array.from({ length: ex.sets }, () => ({
      weight: ex.weight ? String(ex.weight) : '',
      reps: String(ex.reps),
      done: false,
    })),
    rpe: null as number | null,
  }));
}

/* ── Shared sub-components ──────────────────────────────────── */
function Avatar({ initials, color, size = 'sm' }: { initials: string; color: AvatarColor; size?: 'sm' | 'md' }) {
  const colorClass = {
    blue: styles.avatarBlue, green: styles.avatarGreen,
    amber: styles.avatarAmber, pink: styles.avatarPink, purple: styles.avatarPurple,
  }[color];
  return (
    <div className={`${styles.avatar} ${size === 'md' ? styles.avatarMd : styles.avatarSm} ${colorClass}`}>
      {initials}
    </div>
  );
}

function SlotBar({ slots }: { slots: { status: SlotStatus }[] }) {
  const cls = (s: SlotStatus) => ({
    done: styles.slotDone, planned: styles.slotPlanned, empty: styles.slotEmpty,
  }[s]);
  return (
    <div className={styles.slotBar}>
      {slots.map((s, i) => <div key={i} className={`${styles.slotStrip} ${cls(s.status)}`} />)}
    </div>
  );
}

function RpeChip({ rpe }: { rpe: number }) {
  const isEasy = rpe <= 3;
  const isMid = rpe >= 4 && rpe <= 6;
  const chipClass = isEasy ? styles.rpeEasy : isMid ? styles.rpeMid : styles.rpeHard;
  const Icon = isEasy ? LeafIcon : isMid ? ActivityIcon : FlameIcon;
  const label = rpe <= 3 ? 'легко' : rpe <= 6 ? 'умеренно' : rpe <= 8 ? 'тяжело' : 'максимум';
  return (
    <span className={`${styles.rpeChip} ${chipClass}`}>
      <Icon className={styles.icon12} />
      RPE {rpe} — {label}
    </span>
  );
}

function WeekNav({
  label, onPrev, onNext, nextDisabled,
}: { label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className={styles.weekNav}>
      <button className={styles.weekNavBtn} onClick={onPrev} aria-label="Предыдущая неделя">
        <ChevronLeftIcon className={styles.icon16} />
      </button>
      <span className={styles.weekNavLabel}>{label}</span>
      <button className={styles.weekNavBtn} onClick={onNext} disabled={nextDisabled} aria-label="Следующая неделя">
        <ChevronRightIcon className={styles.icon16} />
      </button>
    </div>
  );
}

/* ── RpeScale ───────────────────────────────────────────────── */
function RpeScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const getBtnClass = (n: number) => {
    if (value === null || n > value) return styles.rpeScaleBtn;
    if (n <= 3) return `${styles.rpeScaleBtn} ${styles.rpeScaleBtnEasy}`;
    if (n <= 6) return `${styles.rpeScaleBtn} ${styles.rpeScaleBtnMid}`;
    return `${styles.rpeScaleBtn} ${styles.rpeScaleBtnHard}`;
  };
  return (
    <div>
      <div className={styles.rpeScaleRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button key={n} className={getBtnClass(n)} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
      <div className={styles.rpeScaleHints}>
        <span>легко</span>
        <span>умеренно</span>
        <span>максимум</span>
      </div>
    </div>
  );
}

/* ── WorkoutFeedCard ────────────────────────────────────────── */
function WorkoutFeedCard({ week, onClick }: {
  week: typeof HISTORY_WEEKS[0];
  onClick: () => void;
}) {
  return (
    <div className={styles.feedCard} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className={styles.feedCardTop}>
        <span className={styles.feedCardTitle}>{week.label}</span>
        <span className={`${styles.badge} ${styles.badgeDone}`}>{week.doneSlots}/{week.totalSlots} ✓</span>
        <ChevronRightIcon className={styles.icon16} />
      </div>
      <SlotBar slots={week.slots} />
      {week.avgRpe !== undefined && (
        <div className={styles.feedCardMeta}>
          <HistoryIcon className={styles.icon12} />
          <span>средний RPE: {week.avgRpe}</span>
        </div>
      )}
    </div>
  );
}

/* ── Screen 1: Main feed ────────────────────────────────────── */
function FeedScreen({ onStartWorkout, onHistoryWeek }: {
  onStartWorkout: () => void;
  onHistoryWeek: () => void;
}) {
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const done = CURRENT_SLOTS.filter(s => s.status === 'done').length;
  const total = CURRENT_SLOTS.length;
  const nextSlot = CURRENT_SLOTS.find(s => s.status === 'planned');

  function toggleExpand(id: string) {
    setExpandedSlot(prev => (prev === id ? null : id));
  }

  return (
    <>
      {/* Athlete header card */}
      <div className={styles.athleteHeaderCard}>
        <div className={styles.athleteHeaderTop}>
          <Avatar initials={ATHLETE.avatarInitials} color={ATHLETE.avatarColor} size="md" />
          <div className={styles.athleteHeaderInfo}>
            <div className={styles.athleteHeaderName}>{ATHLETE.name}</div>
            <div className={styles.athleteHeaderMeta}>
              <ClipboardListIcon className={styles.icon12} />
              <span>Тренер: {ATHLETE.coach} · неделя 21</span>
            </div>
          </div>
          <span className={`${styles.badge} ${done === total ? styles.badgeDone : styles.badgePlanned}`}>
            {done === total ? 'неделя завершена' : `${done} / ${total}`}
          </span>
        </div>
        <SlotBar slots={CURRENT_WEEK_SLOTS} />
      </div>

      <WeekNav
        label="Неделя 21 · 19–25 мая 2025"
        onPrev={onHistoryWeek}
        onNext={() => {}}
        nextDisabled
      />

      {/* Active slot cards */}
      <div className={styles.slotList}>
        {CURRENT_SLOTS.map(slot => {
          const isExpanded = expandedSlot === slot.id || (slot.status === 'planned' && slot.id === nextSlot?.id);
          const isNext = slot.id === nextSlot?.id;

          if (slot.status === 'done') {
            return (
              <div key={slot.id} className={`${styles.slotCard} ${styles.slotCardDone}`}>
                <div className={styles.slotHead} onClick={() => toggleExpand(slot.id)}>
                  <div className={`${styles.slotNum} ${styles.slotNumDone}`}>{slot.order}</div>
                  <div className={styles.slotHeadInfo}>
                    <div className={styles.slotTitle}>{slot.title}</div>
                    <div className={styles.slotSubline}>
                      <span className={styles.slotSublineCheck}>
                        <CheckCircleIcon className={styles.icon12} />
                        {slot.completedAt}
                      </span>
                      {slot.rpe && <RpeChip rpe={slot.rpe} />}
                    </div>
                  </div>
                  <div className={styles.slotHeadRight}>
                    <button className={styles.slotExpandBtn} aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}>
                      {isExpanded
                        ? <ChevronLeftIcon className={`${styles.icon16} ${styles.iconRotate90}`} />
                        : <ChevronRightIcon className={`${styles.icon16} ${styles.iconRotate270}`} />}
                    </button>
                  </div>
                </div>
                {isExpanded && slot.actualSets && (
                  <div className={styles.slotDoneExpanded}>
                    {slot.actualSets.map((ex, i) => (
                      <div key={i} className={styles.exerciseDoneRow}>
                        <span className={styles.exerciseDoneName}>{ex.name}</span>
                        {ex.sameAsPlan ? (
                          <span className={styles.exerciseDoneParams}>{ex.actual}</span>
                        ) : (
                          <span className={styles.exerciseSummaryDiverged}>
                            <span className={styles.exerciseSummaryPlan}>{ex.plan}</span>
                            {' → '}
                            <span className={styles.exerciseSummaryActualVal}>{ex.actual}</span>
                          </span>
                        )}
                        {ex.rpe && <RpeChip rpe={ex.rpe} />}
                      </div>
                    ))}
                    {slot.athleteNote && (
                      <div className={styles.summaryNote}>
                        <MessageIcon className={styles.icon14} />
                        <span>&ldquo;{slot.athleteNote}&rdquo;</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          /* pending */
          return (
            <div key={slot.id} className={`${styles.slotCard} ${isNext ? styles.slotCardActive : styles.slotCardDefault}`}>
              <div className={styles.slotHead} onClick={() => !isNext && toggleExpand(slot.id)}>
                <div className={`${styles.slotNum} ${styles.slotNumPending}`}>{slot.order}</div>
                <div className={styles.slotHeadInfo}>
                  <div className={styles.slotTitle}>{slot.title}</div>
                  <div className={styles.slotSubline}>
                    <span>{slot.exercises.length} упражнений · выбери день</span>
                  </div>
                </div>
                <div className={styles.slotHeadRight}>
                  <span className={`${styles.badge} ${styles.badgePlanned}`}>запланировано</span>
                </div>
              </div>

              {(isNext || isExpanded) && (
                <>
                  <div className={styles.slotBody}>
                    {slot.exercises.map(ex => (
                      <div key={ex.id} className={styles.exercisePreviewRow}>
                        <span className={styles.exercisePreviewName}>{ex.name}</span>
                        <span className={styles.exercisePreviewParams}>
                          <span className={styles.exercisePreviewParamsVal}>{ex.sets}×{ex.reps}</span>
                          {ex.weight && <> · <span className={styles.exercisePreviewParamsVal}>{ex.weight} кг</span></>}
                          {ex.weightUnit === 'bw' && <> · <span className={styles.exercisePreviewParamsVal}>собств.</span></>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.slotFooter}>
                    <button className={styles.slotStartBtn} onClick={onStartWorkout}>
                      <BarbellIcon className={styles.icon16} />
                      Начать тренировку →
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* History section */}
      <div className={styles.sectionLabel}>Предыдущие недели</div>
      <div className={styles.historyList}>
        {HISTORY_WEEKS.map(week => (
          <WorkoutFeedCard key={week.id} week={week} onClick={onHistoryWeek} />
        ))}
      </div>
      <button className={styles.showMoreBtn}>Показать ещё...</button>
    </>
  );
}

/* ── ExerciseSetTable ───────────────────────────────────────── */
interface SetState { weight: string; reps: string; done: boolean; }
interface ExState  { sets: SetState[]; rpe: number | null; }

function ExerciseSetTable({ ex, exState, onChange, onRpe }: {
  ex: MockExercise;
  exState: ExState;
  onChange: (setIdx: number, field: 'weight' | 'reps' | 'done', value: string | boolean) => void;
  onRpe: (v: number) => void;
}) {
  const allDone = exState.sets.every(s => s.done);
  const planLabel = `план: ${ex.sets}×${ex.reps}${ex.weight ? ` · ${ex.weight} кг` : ''}`;

  return (
    <div className={`${styles.exerciseCard} ${allDone ? styles.exerciseCardAllDone : ''}`}>
      <div className={styles.exerciseHead}>
        <span className={styles.exerciseHeadName}>{ex.name}</span>
        <span className={styles.exerciseHeadPlan}>{planLabel}</span>
      </div>

      <table className={styles.setTable}>
        <thead>
          <tr className={styles.setTableHeader}>
            <th>№</th>
            <th>Вес (кг)</th>
            <th>Повт.</th>
            <th style={{ textAlign: 'center' }}>✓</th>
          </tr>
        </thead>
        <tbody>
          {exState.sets.map((set, i) => (
            <tr key={i} className={`${styles.setRow} ${set.done ? styles.setRowDone : ''}`}>
              <td className={styles.setNumCell}>{i + 1}</td>
              <td className={styles.setInputCell}>
                {ex.weightUnit === 'bw' ? (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '0 8px' }}>собств.</span>
                ) : (
                  <input
                    className={styles.setInput}
                    type="number"
                    inputMode="decimal"
                    value={set.weight}
                    onChange={e => onChange(i, 'weight', e.target.value)}
                    placeholder="кг"
                  />
                )}
              </td>
              <td className={styles.setInputCell}>
                <input
                  className={styles.setInput}
                  type="number"
                  inputMode="numeric"
                  value={set.reps}
                  onChange={e => onChange(i, 'reps', e.target.value)}
                  placeholder="повт."
                />
              </td>
              <td className={styles.setCheckCell}>
                <button
                  className={`${styles.setCheckbox} ${set.done ? styles.setCheckboxDone : ''}`}
                  onClick={() => {
                    const nowDone = !set.done;
                    onChange(i, 'done', nowDone);
                    if (nowDone && !set.weight && ex.weight) onChange(i, 'weight', String(ex.weight));
                    if (nowDone && !set.reps) onChange(i, 'reps', String(ex.reps));
                  }}
                  aria-label={set.done ? 'Снять отметку' : 'Отметить выполненным'}
                >
                  {set.done && <CheckIcon className={styles.icon12} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.exerciseRpe}>
        <div className={styles.exerciseRpeLabel}>
          <span>Сложность упражнения</span>
          {exState.rpe !== null && <RpeChip rpe={exState.rpe} />}
        </div>
        {exState.rpe === null ? (
          <RpeScale value={null} onChange={onRpe} />
        ) : (
          <button
            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => onRpe(exState.rpe!)}
          >
            изменить оценку
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Screen 2: Active workout ───────────────────────────────── */
function WorkoutScreen({ onBack }: { onBack: () => void }) {
  const slot = CURRENT_SLOTS[2];
  const [exStates, setExStates] = useState<ExState[]>(makeInitialWorkoutState());
  const [note, setNote] = useState('');
  const [workoutRpe, setWorkoutRpe] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const totalSets = exStates.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets  = exStates.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);
  const progress  = totalSets > 0 ? doneSets / totalSets : 0;
  const canFinish = doneSets > 0 && workoutRpe !== null;

  function updateSet(exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'done', val: string | boolean) {
    setExStates(prev => prev.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: val } : s) };
    }));
  }

  function setExRpe(exIdx: number, v: number) {
    setExStates(prev => prev.map((ex, ei) => ei === exIdx ? { ...ex, rpe: v } : ex));
  }

  return (
    <>
      {/* Workout topbar (simulated) */}
      <div className={styles.workoutTopbar}>
        <button className={styles.workoutTopbarBtn} onClick={onBack} aria-label="Назад">
          <ArrowLeftIcon className={styles.icon18} />
        </button>
        <span className={styles.workoutTopbarTitle}>{slot.title}</span>
        <div style={{ position: 'relative' }}>
          <button className={styles.workoutTopbarBtn} onClick={() => setMenuOpen(o => !o)} aria-label="Меню">
            <DotsIcon className={styles.icon18} />
          </button>
          {menuOpen && (
            <div className={styles.overflowMenu}>
              <button className={styles.overflowMenuItem} onClick={() => { setMenuOpen(false); onBack(); }}>
                <TrashIcon className={styles.icon14} />
                Прервать тренировку
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBarWrap}>
        <div className={styles.progressBarTrack}>
          <div className={styles.progressBarFill} style={{ width: `${progress * 100}%` }} />
        </div>
        <div className={styles.progressBarLabel}>{doneSets} / {totalSets} подходов</div>
      </div>

      {/* Exercise tables */}
      {slot.exercises.map((ex, ei) => (
        <ExerciseSetTable
          key={ex.id}
          ex={ex}
          exState={exStates[ei]}
          onChange={(si, field, val) => updateSet(ei, si, field, val)}
          onRpe={v => setExRpe(ei, v)}
        />
      ))}

      {/* Workout note */}
      <div className={styles.workoutSection}>
        <div className={styles.workoutSectionLabel}>Заметка (необязательно)</div>
        <textarea
          className={styles.noteTextarea}
          placeholder="Например: становая давалась тяжело, снизил вес на последнем подходе…"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      {/* Workout RPE */}
      <div className={styles.workoutSection}>
        <div className={styles.workoutSectionHeading}>
          Насколько тяжёлой была тренировка?
          {workoutRpe !== null && <> &nbsp;<RpeChip rpe={workoutRpe} /></>}
        </div>
        <RpeScale value={workoutRpe} onChange={setWorkoutRpe} />
      </div>

      {/* Finish row */}
      <div className={styles.finishRow}>
        <button className={styles.btnGhost} onClick={onBack}>
          <ClockIcon className={styles.icon16} />
          Отложить
        </button>
        <button className={styles.btnPrimary} disabled={!canFinish} onClick={onBack}>
          <CheckCircleIcon className={styles.icon16} />
          Завершить тренировку
        </button>
      </div>
      {!canFinish && (
        <p className={styles.finishHint}>
          {doneSets === 0
            ? 'Отметьте хотя бы один подход и оцените тренировку'
            : 'Оцените тренировку, чтобы завершить'}
        </p>
      )}
    </>
  );
}

/* ── WorkoutSummaryCard ─────────────────────────────────────── */
function WorkoutSummaryCard({ slot }: { slot: MockSlot }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHead}>
        <div className={`${styles.slotNum} ${styles.slotNumDone}`}>{slot.order}</div>
        <div className={styles.summaryHeadInfo}>
          <div className={styles.summaryTitle}>{slot.title}</div>
          <div className={styles.summaryMeta}>
            <CheckCircleIcon className={styles.icon12} />
            <span>Выполнено {slot.completedAt}</span>
          </div>
        </div>
        <div className={styles.summaryHeadRpe}>
          {slot.exerciseAvgRpe && <RpeChip rpe={slot.exerciseAvgRpe} />}
          {slot.rpe && <RpeChip rpe={slot.rpe} />}
        </div>
      </div>

      {slot.actualSets?.map((ex, i) => (
        <div key={i} className={styles.exerciseSummaryRow}>
          <span className={styles.exerciseSummaryName}>{ex.name}</span>
          {ex.sameAsPlan ? (
            <span className={styles.exerciseSummaryActual}>{ex.actual}</span>
          ) : (
            <span className={styles.exerciseSummaryDiverged}>
              <span className={styles.exerciseSummaryPlan}>{ex.plan}</span>
              {' → '}
              <span className={styles.exerciseSummaryActualVal}>{ex.actual}</span>
            </span>
          )}
          {ex.rpe && <RpeChip rpe={ex.rpe} />}
        </div>
      ))}

      {slot.athleteNote && (
        <div className={styles.summaryNote}>
          <MessageIcon className={styles.icon14} />
          <span>&ldquo;{slot.athleteNote}&rdquo;</span>
        </div>
      )}
    </div>
  );
}

/* ── Screen 3: Past week view ───────────────────────────────── */
function PastWeekScreen({ onGoToCurrent }: { onGoToCurrent: () => void }) {
  return (
    <>
      <div className={styles.athleteHeaderCard}>
        <div className={styles.athleteHeaderTop}>
          <Avatar initials={ATHLETE.avatarInitials} color={ATHLETE.avatarColor} size="md" />
          <div className={styles.athleteHeaderInfo}>
            <div className={styles.athleteHeaderName}>{ATHLETE.name}</div>
            <div className={styles.athleteHeaderMeta}>
              <ClipboardListIcon className={styles.icon12} />
              <span>Тренер: {ATHLETE.coach} · неделя 20</span>
            </div>
          </div>
          <span className={`${styles.badge} ${styles.badgeDone}`}>3 / 3</span>
        </div>
        <SlotBar slots={[{ status: 'done' }, { status: 'done' }, { status: 'done' }]} />
      </div>

      <WeekNav
        label="Неделя 20 · 12–18 мая 2025"
        onPrev={() => {}}
        onNext={onGoToCurrent}
      />

      <div className={styles.readOnlyBanner}>
        <InfoCircleIcon className={`${styles.icon14} ${styles.readOnlyBannerIcon}`} />
        <span>
          <strong>Прошлая неделя — только чтение.</strong>{' '}
          Перейдите на{' '}
          <button className={styles.readOnlyBannerLink} onClick={onGoToCurrent}>
            текущую неделю
          </button>
          {' '}для записи тренировок.
        </span>
      </div>

      <div className={styles.slotList}>
        {PAST_SLOTS.map(slot => (
          <WorkoutSummaryCard key={slot.id} slot={slot} />
        ))}
      </div>

      <div className={styles.sectionLabel}>Предыдущие недели</div>
      <div className={styles.historyList}>
        {HISTORY_WEEKS.slice(1).map(week => (
          <WorkoutFeedCard key={week.id} week={week} onClick={() => {}} />
        ))}
      </div>
    </>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
type Screen = 'feed' | 'workout' | 'past';

export default function AthleteProtoPage() {
  const [screen, setScreen] = useState<Screen>('feed');

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        {/* Proto nav hint */}
        <div className={styles.protoHint}>
          <InfoCircleIcon className={styles.icon14} />
          <strong>Интерактивный прототип</strong> — нажмите &laquo;Начать тренировку&raquo; для экрана записи; &laquo;◁&raquo; или карточку истории — для прошлой недели.
          <span className={styles.protoHintNav}>
            {(['feed', 'workout', 'past'] as Screen[]).map(s => (
              <button
                key={s}
                className={`${styles.protoHintBtn} ${screen === s ? styles.protoHintBtnActive : ''}`}
                onClick={() => setScreen(s)}
              >
                {{ feed: 'Лента', workout: 'Тренировка', past: 'История' }[s]}
              </button>
            ))}
          </span>
        </div>

        {screen === 'feed' && (
          <FeedScreen
            onStartWorkout={() => setScreen('workout')}
            onHistoryWeek={() => setScreen('past')}
          />
        )}
        {screen === 'workout' && (
          <WorkoutScreen onBack={() => setScreen('feed')} />
        )}
        {screen === 'past' && (
          <PastWeekScreen onGoToCurrent={() => setScreen('feed')} />
        )}
      </div>
    </div>
  );
}
