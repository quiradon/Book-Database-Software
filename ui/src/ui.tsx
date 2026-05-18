import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from './lib';

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-500',
        variant === 'secondary' && 'border border-blue-500/60 text-blue-100 hover:bg-blue-500/15',
        variant === 'danger' && 'border border-rose-500/70 text-rose-100 hover:bg-rose-500/15',
        variant === 'ghost' && 'text-slate-200 hover:bg-white/8',
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = 'secondary',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <a
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-500',
        variant === 'secondary' && 'border border-blue-500/60 text-blue-100 hover:bg-blue-500/15',
        variant === 'danger' && 'border border-rose-500/70 text-rose-100 hover:bg-rose-500/15',
        variant === 'ghost' && 'text-slate-200 hover:bg-white/8',
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-md border border-blue-500/60 bg-[#15151d] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-600/30',
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 w-full rounded-md border border-blue-500/60 bg-[#15151d] px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-600/30',
        props.className,
      )}
    />
  );
}

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  onSearchChange,
  placeholder = 'Buscar...',
  emptyText = 'Nenhum resultado encontrado.',
  loading = false,
  disabled = false,
  allowClear = false,
  selectedLabel,
  className,
}: {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string, option?: SearchableSelectOption) => void;
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  selectedLabel?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const displayValue = open ? query : selected?.label ?? selectedLabel ?? '';

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [options, query]);

  const openList = () => {
    if (disabled) {
      return;
    }

    setOpen(true);
    setQuery('');
    onSearchChange?.('');
  };

  const selectOption = (option: SearchableSelectOption) => {
    onChange(option.value, option);
    setOpen(false);
    setQuery('');
  };

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setOpen(true);
    onSearchChange?.(nextQuery);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(0, options.length - 1)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      selectOption(options[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onFocus={openList}
          onClick={openList}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(
            'h-9 w-full rounded-md border border-blue-500/60 bg-[#15151d] px-3 pr-16 text-sm outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-600/30 disabled:opacity-45',
            allowClear && value ? 'pr-20' : 'pr-12',
          )}
        />
        {loading && (
          <span className="absolute right-9 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-blue-200/30 border-t-blue-200" />
        )}
        {allowClear && value && !disabled && (
          <button
            type="button"
            className="absolute right-8 top-1.5 rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            onClick={() => {
              onChange('', undefined);
              updateQuery('');
            }}
            title="Limpar"
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          className="absolute right-2 top-1.5 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-45"
          onClick={() => (open ? setOpen(false) : openList())}
          aria-label="Alternar opções"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {open && !disabled && (
        <div role="listbox" className="absolute z-[70] mt-1 max-h-64 w-full overflow-auto rounded-md border border-blue-500/50 bg-[#111118] p-1 text-sm shadow-xl">
          {options.length > 0 ? options.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'grid w-full gap-0.5 rounded px-3 py-2 text-left outline-none transition',
                index === activeIndex ? 'bg-blue-600/30 text-white' : 'text-slate-100 hover:bg-white/10',
                option.value === value && 'border-l-2 border-blue-400',
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <span className="font-medium">{option.label}</span>
              {option.description && <span className="text-xs text-slate-400">{option.description}</span>}
            </button>
          )) : (
            <div className="px-3 py-3 text-sm text-slate-400">{loading ? 'Carregando...' : emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg border border-white/12 bg-[#1b1b25] p-4 shadow-sm', className)}>{children}</div>;
}

export function Badge({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'green' | 'yellow' | 'red' | 'slate';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        tone === 'blue' && 'bg-blue-600 text-white',
        tone === 'green' && 'bg-emerald-600 text-white',
        tone === 'yellow' && 'bg-amber-500 text-slate-950',
        tone === 'red' && 'bg-rose-600 text-white',
        tone === 'slate' && 'bg-slate-700 text-slate-100',
      )}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  title,
  children,
  contentClassName,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  contentClassName?: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className={cn('fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-blue-500/50 bg-[#1b1b25] p-5 text-slate-100 shadow-xl outline-none', contentClassName)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ActionMenu({ children, label = 'Ações' }: { children: ReactNode; label?: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button>{label}</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-44 rounded-md border border-white/12 bg-[#111118] p-1 text-sm shadow-xl">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ActionItem({
  children,
  onSelect,
  danger,
}: {
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'cursor-pointer rounded px-3 py-2 outline-none hover:bg-white/10',
        danger ? 'text-rose-200' : 'text-slate-100',
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}
