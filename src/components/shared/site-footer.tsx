import { GitFork } from "lucide-react";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/JetSprow/J-Board";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-md items-center justify-center gap-2 text-xs text-muted-foreground/70",
        className,
      )}
    >
      <span>J-Board</span>
      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden />
      <a
        href={GITHUB_URL}
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
