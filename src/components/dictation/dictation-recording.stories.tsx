import type { Meta, StoryObj } from "@storybook/react-vite";
import { DictationRecording } from "./dictation-recording";

const meta: Meta<typeof DictationRecording> = {
  title: "Dictation/DictationRecording",
  component: DictationRecording,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    liveText: "",
    onCancel: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof DictationRecording>;

export const Empty: Story = {};

export const Streaming: Story = {
  args: {
    liveText:
      "refactor the Tauri backend dispatch handlers to stream incoming Mistral voice tokens directly into the React editor buffer",
  },
};
