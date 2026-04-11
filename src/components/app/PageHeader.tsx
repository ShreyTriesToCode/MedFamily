import type { ReactNode } from 'react';
import { ArrowLeft, Dot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface PageHeaderStat {
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'brand' | 'accent' | 'warm' | 'neutral';
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  showBackButton?: boolean;
  stats?: PageHeaderStat[];
  highlights?: string[];
}

const toneClassMap = {
  brand: 'text-primary-700',
  accent: 'text-secondary-700',
  warm: 'text-secondary-700',
  neutral: 'text-text-primary',
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  showBackButton = false,
  stats = [],
  highlights = [],
}: PageHeaderProps) {
  const navigate = useNavigate();
  const showMeta = stats.length > 0 || highlights.length > 0;

  return (
    <motion.div
      className="hero-gradient relative overflow-hidden rounded-[34px] p-5 soft-shadow sm:p-6 lg:p-7"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.38),transparent_54%)] lg:block" />
      <div className="pointer-events-none absolute -right-12 top-6 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.28),transparent_68%)] blur-2xl" />

      <div className="relative z-10 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            {eyebrow ? (
              <span className="theme-chip inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                {eyebrow}
              </span>
            ) : null}
            <div className="mt-2 flex items-center gap-3">
              {showBackButton ? (
                <button
                  type="button"
                  className="theme-chip rounded-full p-2 text-text-secondary transition hover:text-primary-700"
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : null}
              <div>
                <h1 className="text-balance text-2xl font-bold text-text-primary sm:text-3xl lg:text-[2rem]">{title}</h1>
                {description ? <p className="mt-2 max-w-2xl text-balance text-sm text-text-secondary sm:text-base">{description}</p> : null}
              </div>
            </div>
          </div>
          {actions ? <div className="flex max-w-full flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
        </div>

        {showMeta ? (
          <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
            {stats.length ? (
              <div className={`grid gap-3 ${stats.length > 2 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2'}`}>
                {stats.map((stat) => (
                  <div key={`${stat.label}-${stat.value}`} className="theme-chip-strong min-h-[108px] rounded-[24px] px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{stat.label}</p>
                    <p className={`mt-2 text-2xl font-bold ${toneClassMap[stat.tone ?? 'brand']}`}>{stat.value}</p>
                    {stat.helper ? <p className="mt-1 text-xs text-text-secondary">{stat.helper}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div />
            )}

            {highlights.length ? (
              <div className="theme-surface-soft flex min-h-[108px] flex-wrap content-start gap-2 rounded-[24px] p-4">
                {highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="theme-chip inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold"
                  >
                    <Dot className="h-3.5 w-3.5" />
                    {highlight}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
