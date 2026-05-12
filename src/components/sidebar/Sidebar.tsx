'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/lib/auth/auth-context';
import styles from './Sidebar.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <nav
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
      >
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLogo}>Wilks App</span>
          <button className={styles.close} onClick={onClose} aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M2 2L16 16M16 2L2 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <ul className={styles.navList}>
          <li>
            <Link
              href="/"
              className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
              onClick={onClose}
            >
              Calculator
            </Link>
          </li>
          {user && (
            <li>
              <Link
                href="/profile"
                className={`${styles.navLink} ${pathname === '/profile' ? styles.active : ''}`}
                onClick={onClose}
              >
                Profile
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}
