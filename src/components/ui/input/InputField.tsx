import styles from './InputField.module.css';

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
};

export default function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: InputFieldProps) {
  return (
    <label className={styles.label}>
      {label}
      <input
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </label>
  );
}
