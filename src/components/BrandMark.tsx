import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={cn('h-6 w-6', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.4" />
      <path d="M16.5 16.5 L22 22" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 8.5 V15.5 M8.5 12 H15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
