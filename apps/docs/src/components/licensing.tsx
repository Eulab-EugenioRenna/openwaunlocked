import type { ReactNode } from 'react';
import { ArrowRight, Unlock } from 'lucide-react';
import { DOCS_PATHS, type AccessTier } from '@/lib/site';

const accessSummary = 'Open API access in the EULAB development branch. Availability depends on the WhatsApp session, native provider and tested functionality.';
const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

export function OpenAccessButton({ href = DOCS_PATHS.licensedFeatures, className, label = 'Open access', subtle = false, onClick }: {
  href?: string; tier?: AccessTier; className?: string; label?: string; subtle?: boolean; onClick?: () => void;
}) {
  return <a href={href} onClick={onClick} className={classes('inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', subtle ? 'ow-license-foil' : 'border-primary bg-primary text-primary-foreground hover:opacity-90', className)}><Unlock size={16} aria-hidden="true" />{label}<ArrowRight size={16} aria-hidden="true" /></a>;
}

export function OpenAccessBadge({ className }: { tier?: AccessTier; className?: string }) {
  return <span data-access="open" className={classes('ow-license-foil inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-semibold', className)}><Unlock size={14} aria-hidden="true" />Open</span>;
}

export function OpenMethodSection({ children, className }: { tier?: AccessTier; children: ReactNode; className?: string }) {
  return <section data-access="open" className={classes('licensed-method-surface', className)}>
    <div className="licensed-method-actions not-prose"><OpenAccessBadge /></div>
    <div className="licensed-method-content">{children}</div>
  </section>;
}

export function OpenFeatureCallout({ title = 'Open access', children, className }: { tier?: AccessTier; title?: string; children?: ReactNode; className?: string }) {
  return <aside aria-label="Open feature" className={classes('license-callout my-5 rounded-2xl p-5 text-left', className)}>
    <OpenAccessBadge /><p className="text-base font-semibold">{title}</p>
    <div className="text-sm leading-6 text-muted-foreground">{children ?? accessSummary}</div>
  </aside>;
}
export type { AccessTier };
