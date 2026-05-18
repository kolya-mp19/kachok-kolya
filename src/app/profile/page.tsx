'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth, type Gender, type UpdateProfilePayload } from '@/lib/auth/auth-context';
import styles from './page.module.css';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProfilePage() {
  const { user, isLoading, updateProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isLoading && user === null) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setGender((user.gender as Gender | undefined) ?? '');
    }
  }, [user]);

  if (isLoading || !user) return null;

  const isOwnAccount = !user.provider;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const payload: UpdateProfilePayload = {
      name,
      gender: gender || null,
    };

    if (isOwnAccount && (password || confirmPassword)) {
      payload.password = password;
      payload.confirmPassword = confirmPassword;
    }

    setSaving(true);
    try {
      await updateProfile(payload);
      setPassword('');
      setConfirmPassword('');
      setSuccessMsg('Профиль успешно обновлён');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.heading}>Добро пожаловать, {user.name}</h1>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Личная информация</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                value={user.email}
                disabled
                readOnly
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">Имя</label>
              <input
                id="name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="gender">Пол</label>
              <select
                id="gender"
                className={styles.select}
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | '')}
              >
                <option value="">Не указан</option>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>

            <div className={styles.meta}>
              Участник с {formatDate(user.createdAt)}
            </div>
          </section>

          {isOwnAccount && (
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>Изменить пароль</h2>
              <p className={styles.hint}>Оставьте поля пустыми, если не хотите менять пароль</p>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">Новый пароль</label>
                <input
                  id="password"
                  className={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="Минимум 8 символов"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="confirmPassword">Повторите пароль</label>
                <input
                  id="confirmPassword"
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Повторите новый пароль"
                />
              </div>
            </section>
          )}

          {errorMsg && <p className={styles.error}>{errorMsg}</p>}
          {successMsg && <p className={styles.success}>{successMsg}</p>}

          <button className={styles.saveBtn} type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      </main>
    </div>
  );
}
