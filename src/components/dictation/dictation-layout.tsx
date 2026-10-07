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
        "flex shrink-0 items-center justify-between gap-2 px-8",
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
 *
 * The content inside the body is kept to a centered, readable column
 * (`max-w-md mx-auto w-full`), while the header and footer above/below span
 * the full width of the screen.
 */
export function DictationBody({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("flex flex-1 flex-col", className)} {...props} />
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
        "flex shrink-0 items-center justify-between gap-2 px-8",
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
      className={cn("flex h-full w-full flex-1 flex-col gap-4", className)}
      {...props}
    >
      {header ? <DictationHeader>{header}</DictationHeader> : null}
      <DictationBody>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          {children}
        </div>
      </DictationBody>
      {footer ? <DictationFooter>{footer}</DictationFooter> : null}
    </div>
  );
}
