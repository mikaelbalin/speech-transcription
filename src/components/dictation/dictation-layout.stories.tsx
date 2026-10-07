import type { Meta, StoryObj } from "@storybook/react-vite";
import { DictationLayout } from "./dictation-layout";

const meta: Meta<typeof DictationLayout> = {
  title: "Dictation/DictationLayout",
  component: DictationLayout,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    header: (
      <div className="flex h-8 items-center rounded-lg bg-muted px-3 text-sm text-muted-foreground">
        Header
      </div>
    ),
    footer: (
      <div className="flex w-full items-center justify-between rounded-xl bg-muted p-3 text-sm text-muted-foreground">
        Footer (always pinned to bottom)
      </div>
    ),
  },
};

export default meta;

type Story = StoryObj<typeof DictationLayout>;

export const Default: Story = {
  args: {
    children: (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Body (flex-1, fills available space)
      </div>
    ),
  },
};
