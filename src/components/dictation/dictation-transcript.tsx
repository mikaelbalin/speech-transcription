import { cn } from "cn";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

/**
 * The live transcript card shown in the recording overlay.
 *
 * Displays the accumulating dictation text in a scrollable area with fade
 * masks at the top and bottom that only appear when content is clipped, and
 * auto-scrolls to the bottom as new text arrives. Includes copy and clear
 * actions in the footer.
 */
export function DictationTranscript({
  text,
  onClear,
}: {
  text: string;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowTopFade(el.scrollTop > 0);
    setShowBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight);
  }, []);

  // Observe the text content (not the scroll container) so we react to the
  // content growing/shrinking: recompute the fade masks and auto-scroll to the
  // bottom so the latest dictation stays visible.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      updateFades();
      const scroller = scrollRef.current;
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
      }
    });
    observer.observe(el);
    updateFades();

    return () => observer.disconnect();
  }, [updateFades]);

  return (
    <Card size="sm" className="mt-4 min-h-0 flex-1">
      <CardContent
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          showTopFade &&
            "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-4 before:bg-linear-to-b before:from-card before:to-transparent",
          showBottomFade &&
            "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-4 after:bg-linear-to-t after:from-card after:to-transparent",
        )}
      >
        <div
          ref={scrollRef}
          onScroll={updateFades}
          className="h-full overflow-y-auto no-scrollbar text-[13px] leading-snug text-foreground whitespace-pre-wrap wrap-break-word"
        >
          <div ref={contentRef}>{text}</div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label="Copy text"
        >
          {copied ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label="Clear text"
        >
          <XIcon className="size-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
