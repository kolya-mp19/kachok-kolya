'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

import Button from '@/components/ui/button/Button';
import InputField from '@/components/ui/input/InputField';
import SelectField from '@/components/ui/select/SelectField';
import { useAuth, type Gender } from '@/lib/auth/auth-context';
import styles from './AuthModal.module.css';

type Tab = 'login' | 'register';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export default function AuthModal({ isOpen, onClose }: Props) {
  const { login, register, isLoading, error, clearError } = useAuth();

  const [tab, setTab] = useState<Tab>('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGender, setRegGender] = useState('');

  function resetForms() {
    setLoginEmail('');
    setLoginPassword('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegGender('');
  }

  function handleClose() {
    clearError();
    resetForms();
    onClose();
  }

  function switchTab(next: Tab) {
    clearError();
    setTab(next);
  }

  async function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await login(loginEmail, loginPassword);
      handleClose();
    } catch {
      // error is set in context and displayed below the form
    }
  }

  async function submitRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const gender: Gender | undefined =
      regGender === 'male' || regGender === 'female' ? regGender : undefined;
    try {
      await register(regEmail, regPassword, regName, gender);
      handleClose();
    } catch {
      // error is set in context
    }
  }

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.container}>
        <DialogPanel className={styles.panel}>

          {/* ── Header ───────────────────────────────────── */}
          <div className={styles.panelHeader}>
            <DialogTitle className={styles.title}>
              {tab === 'login' ? 'Sign in' : 'Create account'}
            </DialogTitle>
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
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

          {/* ── Tabs ─────────────────────────────────────── */}
          <div className={styles.tabs} role="tablist">
            <button
              role="tab"
              type="button"
              aria-selected={tab === 'login'}
              className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
              onClick={() => switchTab('login')}
            >
              Sign in
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={tab === 'register'}
              className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
              onClick={() => switchTab('register')}
            >
              Register
            </button>
          </div>

          {/* ── Login form ───────────────────────────────── */}
          {tab === 'login' && (
            <form onSubmit={submitLogin} className={styles.form} noValidate>
              <InputField
                label="Email"
                value={loginEmail}
                onChange={setLoginEmail}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
              />
              <InputField
                label="Password"
                value={loginPassword}
                onChange={setLoginPassword}
                type="password"
                placeholder="••••••••"
              />
              {error && <p className={styles.error}>{error}</p>}
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          )}

          {/* ── Register form ────────────────────────────── */}
          {tab === 'register' && (
            <form onSubmit={submitRegister} className={styles.form} noValidate>
              <InputField
                label="Name"
                value={regName}
                onChange={setRegName}
                placeholder="Your name"
              />
              <InputField
                label="Email"
                value={regEmail}
                onChange={setRegEmail}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
              />
              <InputField
                label="Password"
                value={regPassword}
                onChange={setRegPassword}
                type="password"
                placeholder="Min 8 characters"
              />
              <SelectField
                label="Gender (optional)"
                value={regGender}
                onChange={setRegGender}
                options={GENDER_OPTIONS}
              />
              {error && <p className={styles.error}>{error}</p>}
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          )}

        </DialogPanel>
      </div>
    </Dialog>
  );
}
