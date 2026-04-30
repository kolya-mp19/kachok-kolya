import type { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={[styles.select, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </select>
  );
}
