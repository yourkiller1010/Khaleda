import { ScanLine } from "lucide-react";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="grid place-items-center border border-dashed border-border rounded-[var(--kb-radius)] px-6 py-12 text-center"><ScanLine className="text-muted mb-4" size={28} strokeWidth={1.4} /><h3 className="font-medium">{title}</h3><p className="text-muted mt-2 max-w-md text-sm">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
