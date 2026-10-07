import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ModeToggle } from "@/components/mode-toggle";
import type { AppSettings } from "@/components/pages/settings-form";

export interface RouterContext {
  settings: AppSettings | null;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  pendingComponent: () => <div>Loading…</div>,
  errorComponent: ({ error }) => (
    <div role="alert">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <pre className="text-sm text-destructive">
        {error instanceof Error ? error.message : String(error)}
      </pre>
    </div>
  ),
  notFoundComponent: () => <div>Page not found</div>,
});

function RootLayout() {
  return (
    <main className="flex min-h-dvh flex-col">
      <nav className="flex items-center gap-3 p-8 pb-0">
        <Link
          to="/"
          preload="intent"
          activeProps={{ className: "font-bold" }}
          activeOptions={{ exact: true }}
        >
          Dictation
        </Link>
        <Link
          to="/settings"
          preload="intent"
          activeProps={{ className: "font-bold" }}
        >
          Settings
        </Link>
        <ModeToggle />
      </nav>
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </main>
  );
}
