import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dictation } from "./dictation";

const meta: Meta<typeof Dictation> = {
  title: "Pages/Dictation",
  component: Dictation,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Dictation>;

export const Default: Story = {};
