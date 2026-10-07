import type { Preview } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import "../src/App.css";

// Mock the Tauri IPC backend so pages that `invoke`/`listen` Tauri commands
// render in Storybook's browser environment without a real Tauri runtime.
mockIPC(() => undefined, { shouldMockEvents: true });

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  // Reset the Tauri mock state before each story re-mounts.
  decorators: [
    (Story) => {
      clearMocks();
      mockIPC(() => undefined, { shouldMockEvents: true });
      return <Story />;
    },
    // Provide a TanStack Router context so components that render <Link> /
    // useRouter (e.g. AppHeaderActions) don't crash outside the real app.
    (Story) => {
      const rootRoute = createRootRoute({ component: Outlet });
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: "/",
        component: () => <Story />,
      });
      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute]),
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
      return <RouterProvider router={router} />;
    },
  ],
};

export default preview;
