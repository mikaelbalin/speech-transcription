import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { Settings, ShieldCheck } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";

/**
 * Right-aligned actions shown in the page header across every view.
 *
 * - Always renders the theme `ModeToggle`.
 * - Optionally renders a "Settings" navigation link (used on the dictation
 *   views so the user can reach the settings page; omitted on the settings
 *   page itself to avoid a self-referential link).
 * - Optionally renders a "Setup" navigation link to the onboarding screen
 *   (used on the settings page so the user can re-open first-run host setup).
 */
export function AppHeaderActions({
  showSettings,
  showOnboarding,
}: {
  showSettings?: boolean;
  showOnboarding?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {showOnboarding ? (
        <Link
          to="/onboarding"
          search={{ from: "settings" }}
          className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5")}
        >
          <ShieldCheck className="size-4" />
          Setup
        </Link>
      ) : null}
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
