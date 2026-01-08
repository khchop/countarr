import { ReactNode, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (value: any, row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField?: string;
  emptyMessage?: string;
  maxHeight?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField = 'id',
  emptyMessage = 'No data available',
  maxHeight,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal === bVal) return 0;
        const compare = aVal < bVal ? -1 : 1;
        return sortDir === 'asc' ? compare : -compare;
      })
    : data;

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={maxHeight ? `overflow-auto ${maxHeight}` : ''}>
      <table className="data-table">
        <thead className="sticky top-0 bg-panel">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${
                  col.sortable ? 'cursor-pointer select-none hover:text-text' : ''
                }`}
                style={{ width: col.width }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  <span>{col.header}</span>
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr key={row[keyField] ?? index}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : ''
                  }
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
