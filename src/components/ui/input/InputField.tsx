import styles from './InputField.module.css';

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  type?: 'text' | 'password' | 'email';
};

export default function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = 'text',
}: InputFieldProps) {
  return (
    <label className={styles.label}>
      {label}
      <input
        type={type}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </label>
  );
}
