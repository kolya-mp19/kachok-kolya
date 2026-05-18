'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

import Button from '@/components/ui/button/Button';
import CloseIcon from '@/components/ui/icon/CloseIcon';
import VkIcon from '@/components/ui/icon/VkIcon';
import YandexIcon from '@/components/ui/icon/YandexIcon';
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
  { value: '', label: 'Не указывать' },
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
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
              {tab === 'login' ? 'Вход' : 'Регистрация'}
            </DialogTitle>
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Закрыть">
              <CloseIcon />
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
              Вход
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={tab === 'register'}
              className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
              onClick={() => switchTab('register')}
            >
              Регистрация
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
                label="Пароль"
                value={loginPassword}
                onChange={setLoginPassword}
                type="password"
                placeholder="••••••••"
              />
              {error && <p className={styles.error}>{error}</p>}
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Вход…' : 'Войти'}
              </Button>
            </form>
          )}

          {/* ── Register form ────────────────────────────── */}
          {tab === 'register' && (
            <form onSubmit={submitRegister} className={styles.form} noValidate>
              <InputField
                label="Имя"
                value={regName}
                onChange={setRegName}
                placeholder="Ваше имя"
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
                label="Пароль"
                value={regPassword}
                onChange={setRegPassword}
                type="password"
                placeholder="Не менее 8 символов"
              />
              <SelectField
                label="Пол (необязательно)"
                value={regGender}
                onChange={setRegGender}
                options={GENDER_OPTIONS}
              />
              {error && <p className={styles.error}>{error}</p>}
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Регистрация…' : 'Зарегистрироваться'}
              </Button>
            </form>
          )}

          {/* ── Social login ─────────────────────────────── */}
          <div className={styles.divider}>или</div>
          <div className={styles.socialButtons}>
            <a href="/api/auth/yandex" className={`${styles.socialBtn} ${styles.yandexBtn}`}>
              <YandexIcon />
              Войти через Яндекс
            </a>
            <a href="/api/auth/vk" className={`${styles.socialBtn} ${styles.vkBtn}`}>
              <VkIcon />
              Войти через ВКонтакте
            </a>
          </div>

        </DialogPanel>
      </div>
    </Dialog>
  );
}
