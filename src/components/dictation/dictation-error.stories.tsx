import type { Meta, StoryObj } from "@storybook/react-vite";
import { DictationError } from "./dictation-error";

const meta: Meta<typeof DictationError> = {
  title: "Dictation/DictationError",
  component: DictationError,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    error: {
      code: "ERR_MIC_PERMISSION",
      message:
        "Microphone access was denied by the operating system. Enable microphone permissions to continue.",
    },
    onRetry: () => {},
    onBack: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof DictationError>;

export const Default: Story = {};

export const TranscriptionError: Story = {
  args: {
    error: {
      code: "ERR_TRANSCRIPTION",
      message:
        "WebSocket connection to the inference endpoint was interrupted mid-stream.",
    },
  },
};

export const SampleRateMismatch: Story = {
  args: {
    error: {
      code: "ERR_SAMPLE_RATE",
      message:
        "The capture device reports an unsupported sample rate (96kHz). Supported range is 16kHz - 48kHz.",
    },
  },
};
