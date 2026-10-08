import { cn } from "cn";

function Code({ className, ...props }: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="code"
      className={cn(
        "inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Code };
