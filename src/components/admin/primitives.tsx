import { EmptyState } from "@/components/empty-state";

export function AdminHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="mb-7 flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
    <div><p className="micro text-muted">{eyebrow}</p><h1 className="display mt-3 text-4xl md:text-5xl">{title}</h1><p className="text-muted mt-3 max-w-2xl text-sm">{description}</p></div>{action}
  </header>;
}

export function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="border-l border-border pl-4"><p className="micro text-muted">{label}</p><p className="display mt-3 text-3xl">{value}</p>{note && <p className="text-muted mt-2 text-xs">{note}</p>}</div>;
}

export function Panel({ title, description, children, className = "", action }: { title: string; description?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return <section className={`surface p-5 md:p-6 ${className}`}><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-lg font-medium tracking-tight">{title}</h2>{description && <p className="text-muted mt-1 text-xs">{description}</p>}</div>{action}</div>{children}</section>;
}

export function Field({ label, name, defaultValue, type = "text", required, placeholder, min, max, step }: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; placeholder?: string; min?: number; max?: number; step?: string }) {
  return <div className="field"><label className="label" htmlFor={`${name}-${label.replaceAll(" ", "-")}`}>{label}</label><input className="input" id={`${name}-${label.replaceAll(" ", "-")}`} name={name} type={type} defaultValue={defaultValue ?? undefined} required={required} placeholder={placeholder} min={min} max={max} step={step} /></div>;
}

export function TextArea({ label, name, defaultValue, required, rows = 4, placeholder }: { label: string; name: string; defaultValue?: string | null; required?: boolean; rows?: number; placeholder?: string }) {
  return <div className="field"><label className="label" htmlFor={`${name}-${label.replaceAll(" ", "-")}`}>{label}</label><textarea className="textarea" id={`${name}-${label.replaceAll(" ", "-")}`} name={name} defaultValue={defaultValue ?? ""} required={required} rows={rows} placeholder={placeholder} /></div>;
}

export function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string | null; options: Array<{ value: string; label: string }> }) {
  return <div className="field"><label className="label" htmlFor={`${name}-${label.replaceAll(" ", "-")}`}>{label}</label><select className="select" id={`${name}-${label.replaceAll(" ", "-")}`} name={name} defaultValue={defaultValue ?? ""}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

export function Check({ label, name, defaultChecked = false }: { label: string; name: string; defaultChecked?: boolean }) {
  return <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-current" /><span>{label}</span></label>;
}

export function LocaleField({ locale }: { locale: string }) { return <input type="hidden" name="locale" value={locale} />; }
export function IdField({ id }: { id?: string }) { return id ? <input type="hidden" name="id" value={id} /> : null; }

export function RowActions({ children }: { children: React.ReactNode }) { return <div className="flex flex-wrap items-center gap-2">{children}</div>; }
export function SmallButton({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) { return <button type="submit" className={`btn min-h-9 px-3 py-2 text-[10px] ${danger ? "btn-danger" : "btn-secondary"}`}>{children}</button>; }
export function Empty({ title, body }: { title: string; body: string }) { return <EmptyState title={title} body={body} />; }
export function JsonPreview({ value }: { value: unknown }) { return <pre className="mono scrollbar max-h-72 overflow-auto rounded-xl bg-background p-4 text-xs text-muted">{JSON.stringify(value, null, 2)}</pre>; }
export function DateTime({ value }: { value: Date | null }) { return <span className="mono whitespace-nowrap text-xs text-muted">{value ? value.toISOString().replace("T", " ").slice(0, 16) : "—"}</span>; }
