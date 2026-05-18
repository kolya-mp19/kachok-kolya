'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

import Button from '@/components/ui/button/Button';
import InputField from '@/components/ui/input/InputField';
import styles from './LoginModal.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log('login', { email, password });
    onClose();
  }

  function handleClose() {
    setEmail('');
    setPassword('');
    onClose();
  }

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      {/* Dark overlay */}
      <div className={styles.overlay} aria-hidden="true" />

      {/* Centering container — click-outside-to-close is handled by headlessui */}
      <div className={styles.container}>
        <DialogPanel className={styles.panel}>
          <div className={styles.panelHeader}>
            <DialogTitle className={styles.title}>Sign in</DialogTitle>
            <button
              className={styles.closeBtn}
              onClick={handleClose}
              aria-label="Close"
            >
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

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <InputField
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
              inputMode="email"
            />
            <InputField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />
            <Button type="submit" variant="primary">
              Log in
            </Button>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
