import { Children, cloneElement, isValidElement, useMemo, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react';

type SortDirection = 'asc' | 'desc';
interface SortableTableProps {
  children: ReactNode;
  showSortIndicator?: boolean;
  initialSort?: { column: number; direction: SortDirection } | null;
}

function textContent(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children);
  return '';
}

function cellValue(row: ReactElement<{ children?: ReactNode }>, column: number) {
  const cells = Children.toArray(row.props.children);
  const cell = cells[column];
  if (!isValidElement<{ children?: ReactNode; 'data-sort-value'?: string | number }>(cell)) return '';
  const explicit = cell.props['data-sort-value'];
  return explicit == null ? textContent(cell.props.children).trim() : String(explicit);
}

function compareValues(left: string, right: string) {
  const leftNumber = Number(left.replace(/,/g, ''));
  const rightNumber = Number(right.replace(/,/g, ''));
  if (left && right && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);
  if (leftDate && rightDate) return leftDate - rightDate;
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

export default function SortableTable({ children, showSortIndicator = true, initialSort = null }: SortableTableProps) {
  const [sort, setSort] = useState<{ column: number; direction: SortDirection } | null>(initialSort);
  const [hasInteracted, setHasInteracted] = useState(false);

  const table = useMemo(() => {
    const root = Children.toArray(children).find(child => isValidElement(child) && child.type === 'table');
    if (!isValidElement<{ children?: ReactNode; className?: string }>(root)) return root ?? null;
    const parts = Children.toArray(root.props.children);
    const headIndex = parts.findIndex(part => isValidElement(part) && part.type === 'thead');
    const bodyIndex = parts.findIndex(part => isValidElement(part) && part.type === 'tbody');
    if (headIndex < 0 || bodyIndex < 0) return root;

    const head = parts[headIndex];
    const body = parts[bodyIndex];
    if (!isValidElement<{ children?: ReactNode }>(head) || !isValidElement<{ children?: ReactNode }>(body)) return root;
    const headRows = Children.toArray(head.props.children);
    const sortHeaders = (row: ReactNode) => {
      if (!isValidElement<{ children?: ReactNode }>(row) || row.type !== 'tr') return row;
      let column = 0;
      const cells = Children.map(row.props.children, header => {
        if (!isValidElement<{ children?: ReactNode; className?: string; onClick?: (event: MouseEvent<HTMLTableCellElement>) => void; 'aria-sort'?: 'ascending' | 'descending' | 'none' }>(header) || header.type !== 'th') return header;
        const currentColumn = column++;
        const label = textContent(header.props.children).trim();
        const nonSortable = !label || /^(?:\u00a0|—|-)$/.test(label);
        if (nonSortable) return header;
        const active = sort?.column === currentColumn;
        const direction = active ? sort?.direction : undefined;
        const originalClick = header.props.onClick;
        const alignRight = header.props.className?.includes('text-right') ?? false;
        const changeSort = (event: MouseEvent<HTMLButtonElement>) => {
          originalClick?.(event as unknown as MouseEvent<HTMLTableCellElement>);
          if (event.defaultPrevented) return;
          setHasInteracted(true);
          setSort(current => current?.column === currentColumn
            ? { column: currentColumn, direction: current.direction === 'asc' ? 'desc' : 'asc' }
            : { column: currentColumn, direction: 'asc' });
        };
        return cloneElement(header, {
          'aria-sort': direction ? (direction === 'asc' ? 'ascending' : 'descending') : 'none',
          className: `${header.props.className ?? ''} cursor-pointer select-none hover:text-[var(--accent)]`,
          children: <button type="button" onClick={changeSort} className={`inline-flex w-full items-center gap-1 text-inherit ${alignRight ? 'justify-end text-right' : 'justify-start text-left'}`}>
            {header.props.children}{showSortIndicator && <span aria-hidden="true" className="text-[var(--accent)]">{direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}</span>}
          </button>,
        });
      });
      return cloneElement(row, undefined, cells);
    };
    const nextHead = cloneElement(head, undefined, Children.map(headRows, sortHeaders));
    const bodyRows = Children.toArray(body.props.children);
    const plainRows = bodyRows.every(row => isValidElement(row) && row.type === 'tr');
    const nextRows = sort && hasInteracted && plainRows
      ? [...bodyRows].sort((a, b) => {
        if (!isValidElement<{ children?: ReactNode }>(a) || !isValidElement<{ children?: ReactNode }>(b)) return 0;
        const order = compareValues(cellValue(a, sort.column), cellValue(b, sort.column));
        return sort.direction === 'asc' ? order : -order;
      })
      : bodyRows;
    const nextBody = cloneElement(body, undefined, nextRows);
    parts[headIndex] = nextHead;
    parts[bodyIndex] = nextBody;
    return cloneElement(root, undefined, parts);
  }, [children, sort, hasInteracted]);

  return table;
}
