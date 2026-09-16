import type { ReactNode } from 'react';

export function IconButton({
  children,
  onClick,
  disabled,
  title,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-gray-800/60 hover:text-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2.85 7.5a5.15 5.15 0 0 1 8.78-3.65l1.13-1.13.71.71-2.13 2.13-2.13-2.13.71-.71 1 1A4.15 4.15 0 1 0 11.86 9h1.02A5.15 5.15 0 1 1 2.85 7.5z" />
    </svg>
  );
}

export function ArrowUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 2.75a.75.75 0 0 1 .53.22l4.5 4.5a.75.75 0 1 1-1.06 1.06L8.75 5.31V13a.75.75 0 0 1-1.5 0V5.31L4.03 8.53a.75.75 0 0 1-1.06-1.06l4.5-4.5A.75.75 0 0 1 8 2.75z" />
    </svg>
  );
}

export function ArrowDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 13.25a.75.75 0 0 1-.53-.22l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 1.5 0v7.69l3.22-3.22a.75.75 0 0 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-.53.22z" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="13" cy="8" r="1.25" />
    </svg>
  );
}
