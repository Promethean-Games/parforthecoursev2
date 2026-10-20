export type BillingPlatform = "ios" | "android" | "web";

declare global {
  interface Window {
    __PFTC_IOS_PRODUCTION__?: unknown;
    webkit?: {
      messageHandlers?: {
        PFTCiOSBilling?: unknown;
      };
    };
  }
}

export function resolveBillingPlatform(
  iosProductionBuild: boolean,
  appleBridgeAvailable: boolean,
  googlePlayBridgeAvailable: boolean,
): BillingPlatform {
  if (iosProductionBuild || appleBridgeAvailable) return "ios";
  if (googlePlayBridgeAvailable) return "android";
  return "web";
}

export function getBillingPlatform(): BillingPlatform {
  if (typeof window === "undefined") return "web";
  return resolveBillingPlatform(
    window.__PFTC_IOS_PRODUCTION__ === true,
    window.webkit?.messageHandlers?.PFTCiOSBilling != null,
    window.AndroidPlayBilling != null,
  );
}
