import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Onboarding } from "@/components/pages/onboarding";

const searchSchema = z.object({
  from: z.enum(["settings"]).optional(),
});

export const Route = createFileRoute("/onboarding")({
  validateSearch: searchSchema,
  component: OnboardingRoute,
});

function OnboardingRoute() {
  return <Onboarding />;
}
