import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SessionType, SESSION_CONFIGS } from "@/types/session";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CheckoutDiagnostics(props: { defaultEmail?: string }) {
  const { toast } = useToast();
  const sessionTypes = useMemo(() => Object.keys(SESSION_CONFIGS) as SessionType[], []);

  const [email, setEmail] = useState(props.defaultEmail ?? "");
  const [sessionType, setSessionType] = useState<SessionType>("quick_prep");
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const url: string | undefined = data?.url;
  const host = (() => {
    try {
      return url ? new URL(url).host : null;
    } catch {
      return null;
    }
  })();

  const isPaymentLink = typeof url === "string" && (url.includes("/test_") || host === "buy.stripe.com");

  const run = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Enter an email to run checkout diagnostics.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await supabase.functions.invoke("create-checkout", {
        body: { session_type: sessionType, email },
      });

      if (res.error) {
        setError(res.error.message || "Invocation failed");
        return;
      }

      setData(res.data);
      toast({
        title: "Diagnostics complete",
        description: "Checkout response received.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="font-heading">Checkout diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Origin: <span className="text-foreground">{window.location.origin}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="diag-email">Email</Label>
            <Input
              id="diag-email"
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Session type</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {sessionTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SESSION_CONFIGS[t].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={run} disabled={isLoading || !email}>
            {isLoading ? "Running…" : "Run create-checkout (no redirect)"}
          </Button>

          <Button
            variant="outline"
            disabled={!url}
            onClick={() => {
              if (!url) return;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            Open returned URL
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Invocation error</AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-3">
            {isPaymentLink ? (
              <Alert variant="destructive">
                <AlertTitle>Wrong checkout URL type</AlertTitle>
                <AlertDescription className="break-words">
                  Returned a Stripe payment-link URL (<code className="font-mono">{host ?? "unknown"}</code>). This app should return a Stripe Checkout URL on <code className="font-mono">checkout.stripe.com</code>.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>Looks good</AlertTitle>
                <AlertDescription className="break-words">
                  Returned host: <code className="font-mono">{host ?? "unknown"}</code>
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Raw response</div>
              <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(data, null, 2)}</pre>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          If you are landing on <code className="font-mono">buy.stripe.com/test_…</code>, that is a Stripe Payment Link and is not generated by this codebase — it usually means you’re on an older deployment.
        </div>
      </CardContent>
    </Card>
  );
}
