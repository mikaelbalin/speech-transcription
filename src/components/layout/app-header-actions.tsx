import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { Settings } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";

/**
 * Right-aligned actions shown in the page header across every view.
 *
 * - Always renders the theme `ModeToggle`.
 * - Optionally renders a "Settings" navigation link (used on the dictation
 *   views so the user can reach the settings page; omitted on the settings
 *   page itself to avoid a self-referential link).
 */
export function AppHeaderActions({ showSettings }: { showSettings?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {showSettings ? (
        <Link
          to="/settings"
          className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5")}
        >
          <Settings className="size-4" />
          Settings
        </Link>
      ) : null}
      <ModeToggle />
    </div>
  );
}
