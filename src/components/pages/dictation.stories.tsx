import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dictation } from "./dictation";

const meta: Meta<typeof Dictation> = {
  title: "Pages/Dictation",
  component: Dictation,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Dictation>;

export const Default: Story = {};
