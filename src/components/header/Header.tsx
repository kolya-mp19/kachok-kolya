'use client';

import { useState } from 'react';
import Link from 'next/link';

import AuthModal from '@/components/auth/AuthModal';
import Sidebar from '@/components/sidebar/Sidebar';
import { useAuth } from '@/lib/auth/auth-context';
import styles from './Header.module.css';

export default function Header() {
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link href="/" className={styles.logo}>
            Прогрессия
          </Link>

          <div className={styles.actions}>
            {isLoading ? (
              <div className={styles.skeleton} aria-hidden="true" />
            ) : user ? (
              <span className={styles.userName}>Привет, {user.name.split(' ')[0]}</span>
            ) : (
              <button className={styles.authBtn} onClick={() => setModalOpen(true)}>
                Войти
              </button>
            )}

            <button
              className={styles.burger}
              onClick={() => setSidebarOpen(true)}
              aria-label="Открыть меню"
              aria-expanded={sidebarOpen}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M2 5h16M2 10h16M2 15h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
