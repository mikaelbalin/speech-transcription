import { Link, useSearch } from "@tanstack/react-router";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Mirrors the Rust `SetupStatus` (serde camelCase) returned by the
 * `check_setup_status` command.
 */
export type SetupStatus = {
  ruleInstalled: boolean;
  uinputWritable: boolean;
  uinputAvailable: boolean;
};

const UNKNOWN: SetupStatus = {
  ruleInstalled: false,
  uinputWritable: false,
  uinputAvailable: false,
};

/**
 * First-run onboarding screen.
 *
 * Explains why host setup is needed (auto-paste via uinput on Wayland), shows
 * the current status, and offers a button that triggers a `pkexec` password
 * prompt to install the udev rule and add the user to the `input` group.
 */
export function Onboarding() {
  const search = useSearch({ from: "/onboarding" });
  const backTo = search.from === "settings" ? "/settings" : "/";

  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    try {
      setStatus(await invoke<SetupStatus>("check_setup_status"));
    } catch {
      setStatus(UNKNOWN);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runSetup = useCallback(async () => {
    if (!isTauri()) return;
    setBusy(true);
    setError(null);
    try {
      await invoke("run_setup");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const finish = useCallback(async () => {
    if (isTauri()) {
      try {
        await invoke("mark_setup_complete");
      } catch {
        // Non-fatal: onboarding will re-check status on next launch.
      }
    }
  }, []);

  const complete = status?.ruleInstalled && status?.uinputWritable;

  return (
    <PageLayout
      header={
        <div className="flex w-full items-center justify-between">
          <div>
            <h1 className="font-heading text-base leading-snug font-medium">
              Welcome
            </h1>
            <p className="text-sm text-muted-foreground">
              One-time setup for auto-paste on Linux.
            </p>
          </div>
        </div>
      }
      footer={
        <div className="ml-auto flex items-center gap-2">
          {!complete && (
            <Link
              to={backTo}
              onClick={finish}
              className={buttonVariants({ variant: "ghost" })}
            >
              Skip for now
            </Link>
          )}
          {complete ? (
            <Link
              to={backTo}
              onClick={finish}
              className={buttonVariants({ variant: "default" })}
            >
              Continue
            </Link>
          ) : (
            <Button
              type="button"
              variant="default"
              onClick={runSetup}
              disabled={busy}
            >
              {busy ? "Waiting for authentication…" : "Complete setup"}
            </Button>
          )}
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <CardTitle>Enable auto-paste</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              On Wayland, inserting text into another app requires a virtual
              keyboard (<code>uinput</code>). This needs two small, one-time
              system changes:
            </p>

            <StatusRow
              label="udev rule (virtual keyboard → seat0)"
              done={status?.ruleInstalled ?? false}
            />
            <StatusRow
              label="Write access to /dev/uinput"
              done={status?.uinputWritable ?? false}
            />

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {complete && (
              <Badge variant="secondary" className="w-fit gap-1">
                <CheckCircle2 className="size-3" />
                Ready
              </Badge>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll be prompted for your password. You can skip this and
          configure it later.
        </p>
      </div>
    </PageLayout>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="size-4 text-primary" />
      ) : (
        <Circle className="size-4 text-muted-foreground" />
      )}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
