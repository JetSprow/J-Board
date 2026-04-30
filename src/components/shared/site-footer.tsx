import { GitFork } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { PRODUCT_BASE_NAME, PRODUCT_EDITION, PRODUCT_REPOSITORY_URL, PRODUCT_VERSION } from "@/lib/product";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-md flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground/70",
        className,
      )}
    >
      <div className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1 text-foreground shadow-sm">
        <span className="font-semibold">{PRODUCT_BASE_NAME}</span>
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase text-primary">
          {PRODUCT_EDITION}
        </span>
        <span className="font-mono text-[0.72rem] text-muted-foreground">v{PRODUCT_VERSION}</span>
      </div>
      <ThemeToggle className="size-7 rounded-md border-transparent bg-transparent" />
      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden />
      <a
        href={PRODUCT_REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/15"
      >
        <GitFork className="size-3.5" />
        <span>GitHub</span>
      </a>
    </footer>
  );
}
