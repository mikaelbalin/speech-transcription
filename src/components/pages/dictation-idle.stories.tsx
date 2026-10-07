import type { Meta, StoryObj } from "@storybook/react-vite";
import { DictationIdle } from "./dictation-idle";

const meta: Meta<typeof DictationIdle> = {
  title: "Pages/Dictation/DictationIdle",
  component: DictationIdle,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onStart: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof DictationIdle>;

export const Default: Story = {};
