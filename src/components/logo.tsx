import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", compact = false, className }: { href?: string; compact?: boolean; className?: string }) {
  return <Link href={href} className={cn("wordmark", className)} aria-label="KillByte home"><span className="byte-mark" aria-hidden="true" />{!compact && <span>KillByte<span className="text-muted">.</span></span>}</Link>;
}
