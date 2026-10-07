import { cn } from "cn";
import type { HTMLAttributes } from "react";

/**
 * Top section of the dictation layout. Holds contextual status (device/model
 * badges, error banner, recording indicator) above the main content.
 */
export function DictationHeader({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Middle section of the dictation layout. This is the flexible region: it
 * grows to fill available space so the footer stays pinned to the bottom of
 * the screen regardless of how tall the content is.
 */
export function DictationBody({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

/**
 * Bottom section of the dictation layout. Always anchored to the bottom of
 * the screen; the body above absorbs any extra vertical space.
 */
export function DictationFooter({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-between gap-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Shared shell for every dictation view (idle, recording, error).
 *
 * Composed of three vertical sections — header, body, footer — laid out as a
 * full-height column. The body (`flex-1 min-h-0`) absorbs any extra space so
 * the footer is always pinned to the bottom of the screen regardless of the
 * body's content height.
 *
 * Each view is responsible for filling the three named slots; the layout only
 * owns the geometry and spacing.
 */
export function DictationLayout({
  header,
  children,
  footer,
  className,
  ...props
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <div
      className={cn("flex h-full w-full max-w-md flex-col gap-4", className)}
      {...props}
    >
      {header ? <DictationHeader>{header}</DictationHeader> : null}
      <DictationBody>{children}</DictationBody>
      {footer ? <DictationFooter>{footer}</DictationFooter> : null}
    </div>
  );
}
