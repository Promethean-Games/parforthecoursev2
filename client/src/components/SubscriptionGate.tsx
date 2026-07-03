import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { getBillingDeviceId } from "@/lib/billingDevice";
import {
  isGooglePlayBillingSupported,
  startGooglePlayPurchase,
  type GooglePlayAccessStatus,
  type GooglePlayConfig,
} from "@/lib/googlePlayBilling";

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const [status, setStatus] = useState<GooglePlayAccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceId = useMemo(() => getBillingDeviceId(), []);
  const canUseBilling = useMemo(() => isGooglePlayBillingSupported(), []);

  const refreshStatus = useCallback(async () => {
    const response = await fetch(
      `/api/billing/google-play/status?deviceId=${encodeURIComponent(deviceId)}`,
    );
    if (!response.ok) {
      throw new Error((await response.text()) || "Failed to check status");
    }
    const data = (await response.json()) as GooglePlayAccessStatus;
    setStatus(data);
    return data;
  }, [deviceId]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    refreshStatus()
      .catch((err) => {
        if (mounted)
          setError(
            err instanceof Error ? err.message : "Failed to check status",
          );
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshStatus]);

  const handlePurchase = async () => {
    setError(null);
    setIsPurchasing(true);
    try {
      const configResponse = await fetch("/api/billing/google-play/config");
      if (!configResponse.ok)
        throw new Error("Could not load purchase configuration");

      const config = (await configResponse.json()) as GooglePlayConfig;
      const purchaseToken = await startGooglePlayPurchase(config);

      await apiRequest("POST", "/api/billing/google-play/verify", {
        deviceId,
        purchaseToken,
        packageName: config.packageName,
        productId: config.productId,
      });

      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (status?.hasAccess) {
    return <>{children}</>;
  }

  const trialExpired = status && !status.trialActive && !status.isPurchased;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Par for the Course</h1>
          {trialExpired ? (
            <p className="text-sm text-muted-foreground">
              Your 30-day free trial has ended. Purchase once for permanent access — no subscription, no renewals.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Try free for 30 days. After the trial, a one-time purchase unlocks the app permanently — no subscription, no renewals.
            </p>
          )}
        </div>

        {status?.message && (
          <p className="text-sm font-medium">{status.message}</p>
        )}

        {status?.trialActive && status.trialEndsAt && (
          <p className="text-xs text-muted-foreground">
            Trial ends: {new Date(status.trialEndsAt).toLocaleDateString()}
          </p>
        )}

        {!canUseBilling && (
          <p className="text-sm text-destructive">
            In-app purchasing is not available here. Open this app through Google Play on your Android device to purchase.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          {trialExpired && (
            <Button
              className="flex-1"
              onClick={handlePurchase}
              disabled={!canUseBilling || isPurchasing}
              data-testid="button-purchase-unlock"
            >
              {isPurchasing ? "Processing..." : "Purchase to Unlock"}
            </Button>
          )}
          <Button
            variant="outline"
            className={trialExpired ? "" : "flex-1"}
            onClick={async () => {
              setError(null);
              setIsLoading(true);
              await refreshStatus().catch(() => {});
              setIsLoading(false);
            }}
            disabled={isPurchasing}
            data-testid="button-refresh-status"
          >
            Refresh
          </Button>
        </div>
      </Card>
    </div>
  );
}
