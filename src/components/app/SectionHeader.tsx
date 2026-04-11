import type { ReactNode } from 'react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {eyebrow ? (
          <span className="theme-chip inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="mt-2 text-xl font-bold text-text-primary text-balance">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary text-balance">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
