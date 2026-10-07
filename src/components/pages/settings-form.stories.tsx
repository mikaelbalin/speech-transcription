import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AppSettings } from "./settings-form";
import { SettingsForm } from "./settings-form";

const MODELS = [
  {
    id: "voxtral-mini-transcribe-realtime-2602",
    label: "Voxtral Mini Transcribe Realtime (Recommended)",
  },
];

const DEVICES = [
  {
    id: "alsa_input.pci-0000_c2_00.6.analog-stereo",
    name: "Ryzen HD Audio Controller Analog Stereo",
    isDefault: false,
  },
  {
    id: "alsa_input.usb-Insta360_Insta360_Link_2C-02.mono-fallback",
    name: "Insta360 Link 2C Mono",
    isDefault: true,
  },
];

const meta: Meta<typeof SettingsForm> = {
  title: "Pages/SettingsForm",
  component: SettingsForm,
  tags: ["autodocs"],
  args: {
    initialSettings: null,
    models: MODELS,
    devices: DEVICES,
  },
};

export default meta;

type Story = StoryObj<typeof SettingsForm>;

export const Empty: Story = {};

export const Prefilled: Story = {
  args: {
    initialSettings: {
      apiKey: "mistral-api-key-123",
      model: "voxtral-mini-transcribe-realtime-2602",
      sampleRate: 16000,
      targetDelayMs: null,
      shortcut: "ctrl+alt+space",
      baseUrl: "wss://api.mistral.ai",
      inputDeviceId: "",
    } satisfies AppSettings,
  },
};
