/** Форматирует только подпись: исходное число остаётся в расчётном ядре и определяет место. */
export function formatValue(value: number | null, options: Intl.NumberFormatOptions = {}): string {
    if (value === null) {
        return '—';
    }

    return value.toLocaleString('ru-RU', { maximumFractionDigits: 20, ...options });
}
