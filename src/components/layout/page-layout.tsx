import { cn } from "cn";
import type { HTMLAttributes } from "react";

/**
 * Top section of the page layout. Holds contextual status (device/model
 * badges, error banner, page title) above the main content.
 */
export function PageHeader({
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
 * Middle section of the page layout. This is the flexible region: it grows to
 * fill available space so the footer stays pinned to the bottom of the screen
 * regardless of how tall the content is.
 */
export function PageBody({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("flex flex-1 flex-col", className)} {...props} />
  );
}

/**
 * Bottom section of the page layout. Always anchored to the bottom of the
 * screen; the body above absorbs any extra vertical space.
 */
export function PageFooter({
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
 * Shared shell for every page view (dictation idle/recording/error, settings).
 *
 * Composed of three vertical sections — header, body, footer — laid out as a
 * full-height column. The body (`flex-1`) absorbs any extra space so the
 * footer is always pinned to the bottom of the screen regardless of the
 * body's content height, while never shrinking below its own content.
 *
 * Each view is responsible for filling the three named slots; the layout only
 * owns the geometry and spacing.
 */
export function PageLayout({
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
      className={cn(
        "flex h-full w-full flex-1 flex-col gap-4 px-8 py-6",
        className,
      )}
      {...props}
    >
      {header ? <PageHeader>{header}</PageHeader> : null}
      <PageBody>
        <div className="flex w-full flex-1 flex-col justify-center">
          {children}
        </div>
      </PageBody>
      {footer ? <PageFooter>{footer}</PageFooter> : null}
    </div>
  );
}
