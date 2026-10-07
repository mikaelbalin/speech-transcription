import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { AppSettings } from "@/components/SettingsForm";

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
    <main className="flex min-h-screen flex-col items-center gap-8 p-8">
      <nav className="flex items-center gap-3">
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
          search={{ tab: "general" }}
          activeProps={{ className: "font-bold" }}
        >
          Settings
        </Link>
      </nav>
      <Outlet />
      <TanStackRouterDevtools />
    </main>
  );
}
