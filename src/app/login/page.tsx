"use client";

import { useState } from "react";
import { loginAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-16">
      <div className="enter-up glass-panel w-full max-w-sm rounded-2xl p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan">
          Personal Tracker
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-glow">
          Enter cockpit
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Owner sign-in. Today’s triage, plans, and execution live here.
        </p>
        <form action={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Owner password"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Open Today"}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Default local password:{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5">tracker-dev</code>
        </p>
      </div>
    </main>
  );
}
