import { createFileRoute } from "@tanstack/react-router";

import { Dictation } from "@/components/Dictation";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <Dictation />;
}
