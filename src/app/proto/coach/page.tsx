'use client';

import { useState } from 'react';
import ActivityIcon from '@/components/ui/icon/ActivityIcon';
import AlertTriangleIcon from '@/components/ui/icon/AlertTriangleIcon';
import BarbellIcon from '@/components/ui/icon/BarbellIcon';
import CalendarIcon from '@/components/ui/icon/CalendarIcon';
import CheckCircleIcon from '@/components/ui/icon/CheckCircleIcon';
import CheckIcon from '@/components/ui/icon/CheckIcon';
import ChevronLeftIcon from '@/components/ui/icon/ChevronLeftIcon';
import ChevronRightIcon from '@/components/ui/icon/ChevronRightIcon';
import ClockIcon from '@/components/ui/icon/ClockIcon';
import CopyIcon from '@/components/ui/icon/CopyIcon';
import EditIcon from '@/components/ui/icon/EditIcon';
import FlameIcon from '@/components/ui/icon/FlameIcon';
import HistoryIcon from '@/components/ui/icon/HistoryIcon';
import InfoCircleIcon from '@/components/ui/icon/InfoCircleIcon';
import LeafIcon from '@/components/ui/icon/LeafIcon';
import PlusIcon from '@/components/ui/icon/PlusIcon';
import TrashIcon from '@/components/ui/icon/TrashIcon';
import XIcon from '@/components/ui/icon/XIcon';
import styles from './page.module.css';

/* ── Mock data ──────────────────────────────────────────────── */
type SlotStatus = 'done' | 'planned' | 'skipped' | 'empty';
type AvatarColor = 'blue' | 'green' | 'amber' | 'pink' | 'purple';

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
  status: 'planned' | 'done' | 'skipped';
  completedAt?: string;
  rpe?: number;
  athleteNote?: string;
  exercises: MockExercise[];
}

interface MockAthlete {
  id: string;
  name: string;
  sport: string;
  experienceYears: number;
  avatarInitials: string;
  avatarColor: AvatarColor;
  slots: { status: SlotStatus }[];
  lastActivity: string;
  weekSlots: MockSlot[];
}

const ATHLETES: MockAthlete[] = [
  {
    id: 'a1',
    name: 'Михаил Смирнов',
    sport: 'Пауэрлифтинг',
    experienceYears: 3,
    avatarInitials: 'МС',
    avatarColor: 'blue',
    slots: [{ status: 'done' }, { status: 'done' }, { status: 'planned' }],
    lastActivity: 'Вчера в 18:30',
    weekSlots: [
      {
        id: 's1', order: 1, title: 'Тренировка 1 — Присед / Жим',
        status: 'done', completedAt: '19 мая', rpe: 7,
        athleteNote: 'Немного болела спина, снизил вес на последних сетах',
        exercises: [
          { id: 'e1', name: 'Приседания со штангой', sets: 5, reps: 5, weight: 120, weightUnit: 'kg' },
          { id: 'e2', name: 'Жим лёжа', sets: 4, reps: 6, weight: 90, weightUnit: 'kg' },
          { id: 'e3', name: 'Румынская тяга', sets: 3, reps: 8, weight: 80, weightUnit: 'kg' },
        ],
      },
      {
        id: 's2', order: 2, title: 'Тренировка 2 — Тяга / Жим сидя',
        status: 'done', completedAt: '21 мая', rpe: 8,
        exercises: [
          { id: 'e4', name: 'Становая тяга', sets: 5, reps: 3, weight: 160, weightUnit: 'kg' },
          { id: 'e5', name: 'Жим гантелей сидя', sets: 4, reps: 10, weight: 30, weightUnit: 'kg' },
        ],
      },
      {
        id: 's3', order: 3, title: 'Тренировка 3 — Объём',
        status: 'planned',
        exercises: [
          { id: 'e6', name: 'Выпады', sets: 3, reps: 12, weightUnit: 'bw' },
          { id: 'e7', name: 'Подтягивания', sets: 4, reps: 8, weightUnit: 'bw' },
          { id: 'e8', name: 'Планка', sets: 3, reps: 60, weightUnit: 'bw' },
        ],
      },
    ],
  },
  {
    id: 'a2',
    name: 'Ольга Петрова',
    sport: 'Фитнес',
    experienceYears: 1,
    avatarInitials: 'ОП',
    avatarColor: 'pink',
    slots: [{ status: 'done' }, { status: 'skipped' }, { status: 'planned' }],
    lastActivity: '3 дня назад',
    weekSlots: [
      {
        id: 's4', order: 1, title: 'Тренировка 1 — Ноги',
        status: 'done', completedAt: '17 мая', rpe: 5,
        exercises: [
          { id: 'e9', name: 'Приседания', sets: 4, reps: 15, weight: 40, weightUnit: 'kg' },
          { id: 'e10', name: 'Жим ногами', sets: 3, reps: 15, weight: 80, weightUnit: 'kg' },
        ],
      },
      {
        id: 's5', order: 2, title: 'Тренировка 2 — Верхний блок',
        status: 'skipped',
        exercises: [
          { id: 'e11', name: 'Тяга к поясу', sets: 4, reps: 12, weight: 35, weightUnit: 'kg' },
        ],
      },
      {
        id: 's6', order: 3, title: 'Тренировка 3 — Кардио',
        status: 'planned',
        exercises: [
          { id: 'e12', name: 'Беговая дорожка 30 мин', sets: 1, reps: 1, weightUnit: 'bw' },
        ],
      },
    ],
  },
  {
    id: 'a3',
    name: 'Артём Козлов',
    sport: 'Тяжёлая атлетика',
    experienceYears: 5,
    avatarInitials: 'АК',
    avatarColor: 'green',
    slots: [{ status: 'empty' }, { status: 'empty' }, { status: 'empty' }],
    lastActivity: '7 дней назад',
    weekSlots: [],
  },
];

const HISTORY_WEEKS = [
  { id: 'w20', label: 'Неделя 20 · 12–18 мая', workouts: 3, status: 'done' as const, preview: 'Т1: Присед / Жим · 5×5 · 115 кг · Т2: Становая · 5×3 · 155 кг · Т3: Объём' },
  { id: 'w19', label: 'Неделя 19 · 5–11 мая', workouts: 3, status: 'done' as const, preview: 'Т1: Присед · 4×6 · 110 кг · Т2: Жим / Тяга · 4×8 · Т3: Вспомогательные' },
  { id: 'w18', label: 'Неделя 18 · 28 апр – 4 мая', workouts: 2, status: 'skipped' as const, preview: 'Т1: Присед · 3×5 · 105 кг · Т2: Жим лёжа · 4×6 · 85 кг' },
  { id: 'w17', label: 'Неделя 17 · 21–27 апр', workouts: 3, status: 'done' as const, preview: 'Т1: Присед · 5×5 · 110 кг · Т2: Становая · 4×4 · 150 кг · Т3: Объём' },
  { id: 'w16', label: 'Неделя 16 · 14–20 апр', workouts: 3, status: 'done' as const, preview: 'Т1: Объём ноги · Т2: Жим / Развод · Т3: Кардио + пресс' },
];

/* ── Sub-components ─────────────────────────────────────────── */
function Avatar({ initials, color, size = 'sm' }: { initials: string; color: AvatarColor; size?: 'sm' | 'md' }) {
  const colorClass = {
    blue: styles.avatarBlue,
    green: styles.avatarGreen,
    amber: styles.avatarAmber,
    pink: styles.avatarPink,
    purple: styles.avatarPurple,
  }[color];
  return (
    <div className={`${size === 'md' ? styles.avatarMd : styles.avatar} ${colorClass}`}>
      {initials}
    </div>
  );
}

function StatusBadge({ slots }: { slots: { status: SlotStatus }[] }) {
  const done = slots.filter(s => s.status === 'done').length;
  const skipped = slots.filter(s => s.status === 'skipped').length;
  const total = slots.length;
  const empty = slots.every(s => s.status === 'empty');

  if (empty) return <span className={`${styles.badge} ${styles.badgeWarn}`}>нет плана</span>;
  if (done === total) return <span className={`${styles.badge} ${styles.badgeDone}`}>{total} / {total}</span>;
  if (skipped > 0) return <span className={`${styles.badge} ${styles.badgeSkipped}`}>{skipped} пропущено</span>;
  return <span className={`${styles.badge} ${styles.badgePlanned}`}>{done} / {total}</span>;
}

function SlotBar({ slots }: { slots: { status: SlotStatus }[] }) {
  const colorClass = (s: SlotStatus) => ({
    done: styles.slotDone,
    planned: styles.slotPlanned,
    skipped: styles.slotSkipped,
    empty: styles.slotEmpty,
  }[s]);
  return (
    <div className={styles.slotBar}>
      {slots.map((s, i) => <div key={i} className={`${styles.slotStrip} ${colorClass(s.status)}`} />)}
    </div>
  );
}

function RpeChip({ rpe }: { rpe: number }) {
  const isEasy = rpe <= 3;
  const isMid = rpe >= 4 && rpe <= 6;
  const chipClass = isEasy ? styles.rpeEasy : isMid ? styles.rpeMid : styles.rpeHard;
  const Icon = isEasy ? LeafIcon : isMid ? ActivityIcon : FlameIcon;
  const label = rpe <= 3 ? 'лёгко' : rpe <= 6 ? 'умеренно' : rpe <= 8 ? 'тяжело' : 'максимум';
  return (
    <span className={`${styles.rpeChip} ${chipClass}`}>
      <Icon className={styles.icon14} />
      RPE {rpe} — {label}
    </span>
  );
}

/* ── Drawer: Add/Edit workout ───────────────────────────────── */
interface DrawerExercise { id: string; name: string; sets: string; reps: string; weight: string; bw: boolean; }

function WorkoutDrawer({ onClose, editSlot }: {
  onClose: () => void;
  editSlot?: MockSlot;
}) {
  const [title, setTitle] = useState(editSlot?.title ?? '');
  const [exercises, setExercises] = useState<DrawerExercise[]>(
    editSlot?.exercises.map(e => ({
      id: e.id, name: e.name, sets: String(e.sets), reps: String(e.reps),
      weight: e.weight ? String(e.weight) : '', bw: e.weightUnit === 'bw',
    })) ?? [{ id: '1', name: '', sets: '', reps: '', weight: '', bw: false }]
  );

  function addExercise() {
    setExercises(prev => [...prev, { id: Date.now().toString(), name: '', sets: '', reps: '', weight: '', bw: false }]);
  }

  function removeExercise(id: string) {
    setExercises(prev => prev.filter(e => e.id !== id));
  }

  function updateExercise(id: string, field: keyof DrawerExercise, value: string | boolean) {
    setExercises(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>{editSlot ? 'Редактировать тренировку' : 'Добавить тренировку'}</span>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Закрыть">
            <XIcon className={styles.icon18} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Название тренировки</label>
            <input
              className={styles.formInput}
              type="text"
              placeholder="Например: Тренировка 1 — Присед / Жим"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <div className={styles.formLabel} style={{ marginBottom: 8 }}>Упражнения</div>
            {exercises.map((ex, idx) => (
              <div key={ex.id} className={styles.exerciseFormRow}>
                <div className={styles.exerciseFormFields}>
                  <input
                    className={styles.formInputSm}
                    type="text"
                    placeholder={`Упражнение ${idx + 1}`}
                    value={ex.name}
                    onChange={e => updateExercise(ex.id, 'name', e.target.value)}
                  />
                  <button className={styles.exerciseRemoveBtn} onClick={() => removeExercise(ex.id)} aria-label="Удалить упражнение">
                    <XIcon className={styles.icon16} />
                  </button>
                </div>
                <div className={styles.exerciseFormSetsReps}>
                  <div className={styles.exerciseFormSetsRepsField}>
                    <input
                      className={styles.formInputSm}
                      type="number"
                      inputMode="numeric"
                      placeholder="Подх."
                      value={ex.sets}
                      onChange={e => updateExercise(ex.id, 'sets', e.target.value)}
                    />
                  </div>
                  <span className={styles.exerciseMult}>×</span>
                  <div className={styles.exerciseFormSetsRepsField}>
                    <input
                      className={styles.formInputSm}
                      type="number"
                      inputMode="numeric"
                      placeholder="Повт."
                      value={ex.reps}
                      onChange={e => updateExercise(ex.id, 'reps', e.target.value)}
                    />
                  </div>
                  {!ex.bw && (
                    <div style={{ flex: 1 }}>
                      <input
                        className={styles.formInputSm}
                        type="number"
                        inputMode="decimal"
                        placeholder="кг"
                        value={ex.weight}
                        onChange={e => updateExercise(ex.id, 'weight', e.target.value)}
                      />
                    </div>
                  )}
                  {ex.bw && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', paddingLeft: 4 }}>собств. вес</span>}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={ex.bw} onChange={e => updateExercise(ex.id, 'bw', e.target.checked)} />
                  Собственный вес
                </label>
              </div>
            ))}

            <button className={styles.addExerciseBtn} onClick={addExercise}>
              + Добавить упражнение
            </button>
          </div>
        </div>

        <div className={styles.drawerFooter}>
          <button className={styles.btnGhost} onClick={onClose} style={{ flex: 1 }}>Отмена</button>
          <button className={styles.btnPrimary} onClick={onClose} style={{ flex: 2 }}>
            <CheckIcon className={styles.icon16} />
            Сохранить тренировку
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Screen 1: Athletes list ────────────────────────────────── */
function AthletesListScreen({ onSelectAthlete }: { onSelectAthlete: (id: string) => void }) {
  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Мои спортсмены</h1>
          <p className={styles.pageSub}>{ATHLETES.length} спортсмена · неделя 21, 19–25 мая 2025</p>
        </div>
        <button className={styles.btnPrimary}>
          <PlusIcon className={styles.icon16} />
          Добавить
        </button>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={`${styles.icon14} ${styles.dotPlanned}`}>●</span> запланировано</span>
        <span className={styles.legendItem}><span className={`${styles.icon14} ${styles.dotDone}`}>●</span> выполнено</span>
        <span className={styles.legendItem}><span className={`${styles.icon14} ${styles.dotSkipped}`}>●</span> пропущено</span>
        <span className={styles.legendItem}><span className={`${styles.icon14} ${styles.dotEmpty}`}>●</span> нет плана</span>
      </div>

      <div className={styles.athleteGrid}>
        {ATHLETES.map(athlete => {
          const done = athlete.slots.filter(s => s.status === 'done').length;
          const skipped = athlete.slots.filter(s => s.status === 'skipped').length;
          const noPlan = athlete.slots.every(s => s.status === 'empty');
          return (
            <div key={athlete.id} className={styles.athleteCard} onClick={() => onSelectAthlete(athlete.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onSelectAthlete(athlete.id)}>
              <div className={styles.athTop}>
                <Avatar initials={athlete.avatarInitials} color={athlete.avatarColor} />
                <div className={styles.athInfo}>
                  <div className={styles.athName}>{athlete.name}</div>
                  <div className={styles.athSport}>{athlete.sport}</div>
                </div>
                <StatusBadge slots={athlete.slots} />
              </div>
              <SlotBar slots={athlete.slots} />
              <div className={styles.athMeta}>
                <ClockIcon className={styles.athMetaIcon} />
                <span>{athlete.lastActivity}</span>
                <span className={styles.athMetaSep}>·</span>
                {noPlan ? (
                  <><AlertTriangleIcon className={`${styles.athMetaIcon} ${styles.athMetaWarn}`} /><span className={styles.athMetaWarn}>план не создан</span></>
                ) : skipped > 0 ? (
                  <><AlertTriangleIcon className={`${styles.athMetaIcon} ${styles.athMetaWarn}`} /><span className={styles.athMetaWarn}>пропущена тренировка {skipped}</span></>
                ) : done === athlete.slots.length ? (
                  <><CheckCircleIcon className={`${styles.athMetaIcon} ${styles.athMetaOk}`} /><span className={styles.athMetaOk}>неделя закрыта</span></>
                ) : (
                  <><CalendarIcon className={styles.athMetaIcon} /><span>неделя 21</span></>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Screen 2: Weekly plan ──────────────────────────────────── */
function WeeklyPlanScreen({
  athlete,
  onBack,
  onCopy,
}: {
  athlete: MockAthlete;
  onBack: () => void;
  onCopy: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<MockSlot | undefined>(undefined);

  const slots = athlete.weekSlots;
  const done = slots.filter(s => s.status === 'done').length;
  const skipped = slots.filter(s => s.status === 'skipped').length;
  const totalExercises = slots.reduce((acc, s) => acc + s.exercises.length, 0);

  function openAdd() { setEditSlot(undefined); setDrawerOpen(true); }
  function openEdit(slot: MockSlot) { setEditSlot(slot); setDrawerOpen(true); }

  const slotStatusClass = (status: MockSlot['status']) => ({
    planned: styles.slotCardPlanned,
    done: styles.slotCardDone,
    skipped: styles.slotCardSkipped,
  }[status]);

  const slotNumClass = (status: MockSlot['status']) => ({
    planned: styles.slotNumPlanned,
    done: styles.slotNumDone,
    skipped: styles.slotNumSkipped,
  }[status]);

  const weekBadge = done === slots.length && slots.length > 0
    ? <span className={`${styles.badge} ${styles.badgeDone}`}>{done} / {slots.length} выполнено</span>
    : slots.length === 0
      ? <span className={`${styles.badge} ${styles.badgeWarn}`}>нет плана</span>
      : <span className={`${styles.badge} ${styles.badgePlanned}`}>{done} / {slots.length} выполнено</span>;

  return (
    <>
      {drawerOpen && <WorkoutDrawer onClose={() => setDrawerOpen(false)} editSlot={editSlot} />}

      <div className={styles.breadcrumb}>
        <button className={styles.breadcrumbLink} onClick={onBack}>Спортсмены</button>
        <ChevronRightIcon className={styles.breadcrumbSep} />
        <span>{athlete.name}</span>
      </div>

      <div className={styles.athletePageHeader}>
        <Avatar initials={athlete.avatarInitials} color={athlete.avatarColor} size="md" />
        <div className={styles.athletePageInfo}>
          <div className={styles.athletePageName}>{athlete.name}</div>
          <div className={styles.athletePageMeta}>{athlete.sport} · {athlete.experienceYears} г. опыта</div>
        </div>
        <div className={styles.athletePageActions}>
          <button className={styles.btnSmGhost + ' ' + styles.btnSm} onClick={onCopy}>
            <CopyIcon className={styles.icon14} />
            Скопировать с…
          </button>
          <button className={styles.btnSmPrimary + ' ' + styles.btnSm} onClick={openAdd}>
            <PlusIcon className={styles.icon14} />
            Добавить
          </button>
        </div>
      </div>

      <div className={styles.weekNav}>
        <button className={styles.weekNavBtn} aria-label="Предыдущая неделя">
          <ChevronLeftIcon className={styles.icon16} />
        </button>
        <span className={styles.weekNavLabel}>Неделя 21 · 19–25 мая 2025</span>
        <button className={styles.weekNavBtn} aria-label="Следующая неделя">
          <ChevronRightIcon className={styles.icon16} />
        </button>
        {weekBadge}
      </div>

      {slots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
          <BarbellIcon className={styles.icon18} />
          <p style={{ marginTop: 8 }}>Тренировки на эту неделю не добавлены</p>
        </div>
      ) : (
        <div className={styles.slotList}>
          {slots.map(slot => (
            <div key={slot.id} className={`${styles.slotCard} ${slotStatusClass(slot.status)}`}>
              <div className={styles.slotHead}>
                <div className={`${styles.slotNum} ${slotNumClass(slot.status)}`}>{slot.order}</div>
                <div className={styles.slotTitle}>{slot.title}</div>
                <div className={`${styles.slotAthleteDay} ${slot.status === 'done' ? styles.slotAthleteDayDone : slot.status === 'skipped' ? styles.slotAthleteDaySkipped : styles.slotAthleteDayPlanned}`}>
                  {slot.status === 'done' && <><CheckCircleIcon className={styles.icon14} /><span>Выполнено {slot.completedAt}{slot.rpe ? ` · RPE ${slot.rpe}` : ''}</span></>}
                  {slot.status === 'planned' && <><ClockIcon className={styles.icon14} /><span>Не выполнено</span></>}
                  {slot.status === 'skipped' && <><XIcon className={styles.icon14} /><span>Пропущено</span></>}
                </div>
                <StatusBadge slots={[{ status: slot.status }]} />
              </div>

              <div className={styles.slotBody}>
                {slot.exercises.map(ex => (
                  <div key={ex.id} className={styles.exerciseRow}>
                    <span className={styles.exerciseName}>{ex.name}</span>
                    <span className={styles.exerciseParams}>
                      <span className={styles.exerciseParamsVal}>{ex.sets}×{ex.reps}</span>
                      {ex.weight && <> · <span className={styles.exerciseParamsVal}>{ex.weight} кг</span></>}
                      {ex.weightUnit === 'bw' && <> · <span className={styles.exerciseParamsVal}>собств.</span></>}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.slotFooter}>
                {slot.rpe && <RpeChip rpe={slot.rpe} />}
                {slot.athleteNote && (
                  <span className={styles.slotNote}>&ldquo;{slot.athleteNote.slice(0, 60)}{slot.athleteNote.length > 60 ? '…' : ''}&rdquo;</span>
                )}
                <div className={styles.slotActions}>
                  <button className={`${styles.btnSm} ${styles.btnSmGhost}`} onClick={() => openEdit(slot)} aria-label="Редактировать">
                    <EditIcon className={styles.icon14} />
                    Изменить
                  </button>
                  <button className={`${styles.btnSm} ${styles.btnSmDanger}`} aria-label="Удалить">
                    <TrashIcon className={styles.icon14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={styles.addSlotBtn} onClick={openAdd}>+ Добавить тренировку</button>

      <div className={styles.weekSummary}>
        <span className={styles.summaryItem}><CalendarIcon className={`${styles.summaryIcon} ${styles.summaryIconBlue}`} />{slots.length} тренировок</span>
        <span className={styles.summaryItem}><BarbellIcon className={`${styles.summaryIcon} ${styles.summaryIconBlue}`} />{totalExercises} упражнений</span>
        <span className={styles.summaryItem}><CheckIcon className={`${styles.summaryIcon} ${styles.summaryIconGreen}`} />{done} выполнено</span>
        <span className={styles.summaryItem}><ClockIcon className={`${styles.summaryIcon} ${styles.summaryIconMuted}`} />{slots.length - done - skipped} ожидает</span>
        <span className={styles.summaryRight}>
          <button className={`${styles.btnSm} ${styles.btnSmGhost}`}>
            <HistoryIcon className={styles.icon14} />
            История недель
          </button>
        </span>
      </div>
    </>
  );
}

/* ── Screen 3: Copy week ────────────────────────────────────── */
function CopyWeekScreen({
  athlete,
  onBack,
  onConfirm,
}: {
  athlete: MockAthlete;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <div className={styles.breadcrumb}>
        <button className={styles.breadcrumbLink} onClick={() => { /* go to list */ }}>Спортсмены</button>
        <ChevronRightIcon className={styles.breadcrumbSep} />
        <button className={styles.breadcrumbLink} onClick={onBack}>{athlete.name}</button>
        <ChevronRightIcon className={styles.breadcrumbSep} />
        <button className={styles.breadcrumbLink} onClick={onBack}>Неделя 21</button>
        <ChevronRightIcon className={styles.breadcrumbSep} />
        <span>Копировать</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Скопировать план недели</h1>
          <p className={styles.pageSub}>Выберите исходную неделю → скопируется в неделю 21 → затем редактируйте каждую тренировку</p>
        </div>
        <button className={styles.btnGhost} onClick={onBack}>
          <XIcon className={styles.icon16} />
          Отмена
        </button>
      </div>

      <div className={styles.infoBanner}>
        <InfoCircleIcon className={styles.infoBannerIcon} />
        <div>
          <div className={styles.infoBannerTitle}>Как это работает</div>
          <div className={styles.infoBannerBody}>Тренировки копируются как слоты без привязки к дням. Спортсмен сам выберет время для каждой.</div>
        </div>
      </div>

      <div className={styles.sectionLabel}>Выберите исходную неделю</div>

      <div className={styles.weekHistoryList}>
        {HISTORY_WEEKS.map(week => {
          const isSelected = selected === week.id;
          return (
            <div
              key={week.id}
              className={`${styles.weekHistoryCard} ${isSelected ? styles.weekHistoryCardSelected : styles.weekHistoryCardDefault}`}
              onClick={() => setSelected(week.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setSelected(week.id)}
            >
              <div className={styles.weekHistoryHead}>
                <span className={styles.weekHistoryTitle}>{week.label}</span>
                <span className={`${styles.badge} ${styles.badgePlanned}`}>{week.workouts} тренировок</span>
                <span className={`${styles.badge} ${week.status === 'done' ? styles.badgeDone : styles.badgeSkipped}`}>
                  {week.status === 'done' ? 'завершена' : 'пропуски'}
                </span>
                <ChevronRightIcon className={styles.icon16} />
              </div>
              <div className={styles.weekHistoryPreview}>{week.preview}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.copyFooter}>
        <button className={styles.btnGhost} onClick={onBack}>Отмена</button>
        <button
          className={styles.btnPrimary}
          disabled={!selected}
          onClick={() => { if (selected) onConfirm(); }}
        >
          <CopyIcon className={styles.icon16} />
          {selected
            ? `Скопировать нед. ${HISTORY_WEEKS.find(w => w.id === selected)?.id.replace('w', '')} → нед. 21`
            : 'Скопировать неделю'}
        </button>
      </div>
    </>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
type Screen = 'athletes' | 'week' | 'copy';

export default function CoachProtoPage() {
  const [screen, setScreen] = useState<Screen>('athletes');
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('a1');

  const athlete = ATHLETES.find(a => a.id === selectedAthleteId) ?? ATHLETES[0];

  function goToAthlete(id: string) {
    setSelectedAthleteId(id);
    setScreen('week');
  }

  return (
    <div className={styles.page}>
      {/* Proto nav hint */}
      <div style={{
        marginBottom: 16,
        padding: '8px 14px',
        background: 'var(--color-surface-highlight)',
        border: '1px solid var(--color-status-warn-border)',
        borderRadius: 10,
        fontSize: 12,
        color: 'var(--color-status-warn-text)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        <InfoCircleIcon className={styles.icon14} />
        <strong>Интерактивный прототип</strong> — нажмите на карточку спортсмена, чтобы перейти к плану недели; «Скопировать с…» открывает экран копирования.
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setScreen('athletes')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-status-warn-border)', background: screen === 'athletes' ? 'var(--color-status-warn-bg)' : 'transparent', cursor: 'pointer', color: 'var(--color-status-warn-text)', fontWeight: screen === 'athletes' ? 700 : 400 }}>Спортсмены</button>
          <button onClick={() => setScreen('week')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-status-warn-border)', background: screen === 'week' ? 'var(--color-status-warn-bg)' : 'transparent', cursor: 'pointer', color: 'var(--color-status-warn-text)', fontWeight: screen === 'week' ? 700 : 400 }}>План недели</button>
          <button onClick={() => setScreen('copy')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-status-warn-border)', background: screen === 'copy' ? 'var(--color-status-warn-bg)' : 'transparent', cursor: 'pointer', color: 'var(--color-status-warn-text)', fontWeight: screen === 'copy' ? 700 : 400 }}>Копировать</button>
        </span>
      </div>

      {screen === 'athletes' && (
        <AthletesListScreen onSelectAthlete={goToAthlete} />
      )}
      {screen === 'week' && (
        <WeeklyPlanScreen
          athlete={athlete}
          onBack={() => setScreen('athletes')}
          onCopy={() => setScreen('copy')}
        />
      )}
      {screen === 'copy' && (
        <CopyWeekScreen
          athlete={athlete}
          onBack={() => setScreen('week')}
          onConfirm={() => setScreen('week')}
        />
      )}
    </div>
  );
}
