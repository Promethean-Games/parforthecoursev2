export interface GooglePlayConfig {
  packageName: string;
  productId: string;
}

export interface GooglePlayAccessStatus {
  hasAccess: boolean;
  isPurchased: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  daysLeftInTrial: number | null;
  message: string;
  checkedAt: string;
}

type PaymentDetailsWithToken = {
  purchaseToken?: string;
  token?: string;
  paymentMethodData?: { tokenizationData?: { token?: string } };
};

function parsePurchaseToken(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const typed = details as PaymentDetailsWithToken;
  return (
    typed.purchaseToken ||
    typed.token ||
    typed.paymentMethodData?.tokenizationData?.token ||
    null
  );
}

export function isGooglePlayBillingSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.PaymentRequest !== "undefined" &&
    typeof window.getDigitalGoodsService === "function"
  );
}

export async function startGooglePlayPurchase(
  config: GooglePlayConfig,
): Promise<string> {
  if (!isGooglePlayBillingSupported()) {
    throw new Error(
      "Google Play Billing is not available on this device. Please open the app from Google Play on Android.",
    );
  }

  const methodData: PaymentMethodData[] = [
    {
      supportedMethods: "https://play.google.com/billing",
      data: {
        sku: config.productId,
        packageName: config.packageName,
        type: "inapp", // one-time purchase
      },
    },
  ];

  const details: PaymentDetailsInit = {
    total: {
      label: "Par for the Course — Permanent Unlock",
      amount: { currency: "USD", value: "0.00" },
    },
  };

  const request = new window.PaymentRequest(methodData, details);
  const response = await request.show();

  try {
    const purchaseToken = parsePurchaseToken(response.details);
    if (!purchaseToken) {
      throw new Error(
        "Purchase completed but no purchase token was returned from Google Play.",
      );
    }
    return purchaseToken;
  } finally {
    await response.complete("success");
  }
}
