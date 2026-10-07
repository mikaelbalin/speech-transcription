import type { Preview } from "@storybook/react-vite";
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
  ],
};

export default preview;
