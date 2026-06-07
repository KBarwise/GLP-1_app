'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CollapsibleSection({
  title,
  summary,
  icon,
  defaultExpanded = false,
  forceExpanded = false,
  className,
  children,
}: {
  title: string;
  summary?: string;
  icon?: ReactNode;
  /** Initial open state when nothing is forcing expansion. */
  defaultExpanded?: boolean;
  /** Keep open (e.g. abnormal results or active alerts). */
  forceExpanded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || forceExpanded);
  const open = forceExpanded || expanded;

  return (
    <section className={cn('border border-ink-100 rounded-md overflow-hidden bg-white', className)}>
      <button
        type="button"
        onClick={() => !forceExpanded && setExpanded(v => !v)}
        className={cn(
          'w-full flex items-start gap-2 px-3 py-2 text-left transition-colors',
          forceExpanded ? 'bg-ink-50/80 cursor-default' : 'hover:bg-ink-50/80',
        )}
        aria-expanded={open}
        disabled={forceExpanded}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-ink-500 shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-500 shrink-0 mt-0.5" />
        )}
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 text-[13px] font-medium text-ink-800">
            {icon}
            {title}
          </span>
          {!open && summary && (
            <span className="block text-[11px] text-ink-500 truncate mt-0.5">{summary}</span>
          )}
        </span>
      </button>
      {open && <div className="px-3 pb-3 pt-0 border-t border-ink-100">{children}</div>}
    </section>
  );
}
