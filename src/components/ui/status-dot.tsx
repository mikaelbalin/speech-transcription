import { cn } from "cn";

const statusDotVariants = {
  variant: {
    success: "bg-emerald-500",
    destructive: "bg-destructive",
    default: "bg-muted-foreground",
  },
} as const;

type StatusDotVariant = keyof typeof statusDotVariants.variant;

export function StatusDot({
  variant = "default",
  pulse = false,
  className,
}: {
  variant?: StatusDotVariant;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        statusDotVariants.variant[variant],
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}
