'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth/auth-context';
import styles from './page.module.css';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const GENDER_LABEL: Record<string, string> = {
  male: 'Male',
  female: 'Female',
};

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user === null) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.heading}>Welcome, {user.name}</h1>

        <div className={styles.sections}>
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Personal Info</h2>
            <dl className={styles.dl}>
              <dt>Email</dt>
              <dd>{user.email}</dd>
              <dt>Gender</dt>
              <dd>{user.gender ? GENDER_LABEL[user.gender] : '—'}</dd>
              <dt>Member since</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </dl>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Training History</h2>
            <p className={styles.placeholder}>Coming soon</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Personal Records</h2>
            <p className={styles.placeholder}>Coming soon</p>
          </section>
        </div>
      </main>
    </div>
  );
}
