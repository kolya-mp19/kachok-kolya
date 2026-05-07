import React from 'react';
import Column, { type ColumnAlign, type ColumnComponent, type ColumnProps } from './Column';
import styles from './Table.module.css';

type TableProps<TRow> = {
  rows: TRow[];
  rowKey: (row: TRow, index: number) => string | number;
  rowClassName?: (row: TRow, index: number) => string | undefined;
  children: React.ReactNode;
};

function getAlignClass(align?: ColumnAlign): string | undefined {
  if (align === 'right') return styles.alignRight;
  if (align === 'center') return styles.alignCenter;
  if (align === 'left') return styles.alignLeft;
  return undefined;
}

const Table = Object.assign(
  function Table<TRow extends object>({
    rows,
    rowKey,
    rowClassName,
    children,
  }: TableProps<TRow>) {
    const columns = React.Children.toArray(children).filter(
      (child): child is React.ReactElement<ColumnProps<TRow>> =>
        React.isValidElement(child) &&
        (child.type as { __IS_COLUMN__?: boolean }).__IS_COLUMN__ === true
    );

    return (
      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              {columns.map((col) => {
                const cls = [styles.th, getAlignClass(col.props.align), col.props.className]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <th key={col.props.id} className={cls}>
                    {col.props.title}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const key = rowKey(row, index);
              const rowCls = rowClassName?.(row, index);
              return (
                <tr key={key} className={rowCls}>
                  {columns.map((col) => {
                    let cell: React.ReactNode;
                    if (typeof col.props.children === 'function') {
                      cell = col.props.children(row, index);
                    } else if (col.props.field !== undefined) {
                      cell = String(row[col.props.field] ?? '—');
                    } else {
                      throw new Error(
                        `Column "${col.props.id}" must have either field or children`
                      );
                    }
                    const cls = [styles.td, getAlignClass(col.props.align), col.props.className]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <td key={col.props.id} className={cls}>
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
  { Column }
);

export function typedTable<TRow>() {
  return Table as unknown as React.FC<TableProps<TRow>> & {
    Column: ColumnComponent<TRow>;
  };
}

export default Table;
