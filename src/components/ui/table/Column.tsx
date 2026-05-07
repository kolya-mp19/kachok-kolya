import type { FC, ReactNode } from 'react';

export type ColumnAlign = 'left' | 'right' | 'center';

export type ColumnCellRenderer<TRow> = (row: TRow, index: number) => ReactNode;

export type ColumnProps<TRow> = {
  id: string;
  title: ReactNode;
  field?: keyof TRow;
  children?: ColumnCellRenderer<TRow>;
  align?: ColumnAlign;
  className?: string;
};

export type ColumnComponent<TRow> = FC<ColumnProps<TRow>> & {
  __IS_COLUMN__: true;
};

// Column is a render-nothing config carrier — props are read by Table at runtime.
const Column = Object.assign(
  (() => null) as unknown as <TRow>(props: ColumnProps<TRow>) => null,
  { __IS_COLUMN__: true as const }
);

export default Column;
