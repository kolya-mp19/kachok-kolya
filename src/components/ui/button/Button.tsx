import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'danger' | 'ghost';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
};

export default function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  className,
  disabled,
}: ButtonProps) {
  const classes = [styles.base, styles[variant], className].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
