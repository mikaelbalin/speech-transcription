import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AppSettings } from "./settings-form";
import { SettingsForm } from "./settings-form";

const meta: Meta<typeof SettingsForm> = {
  title: "Pages/SettingsForm",
  component: SettingsForm,
  tags: ["autodocs"],
  args: {
    initialSettings: null,
  },
};

export default meta;

type Story = StoryObj<typeof SettingsForm>;

export const Empty: Story = {};

export const Prefilled: Story = {
  args: {
    initialSettings: {
      apiKey: "mistral-api-key-123",
      model: "mistral-realtime-voice-v1",
      sampleRate: 16000,
      targetDelayMs: null,
      shortcut: "ctrl+alt+space",
      baseUrl: "wss://api.mistral.ai",
      inputDeviceId: "",
    } satisfies AppSettings,
  },
};
