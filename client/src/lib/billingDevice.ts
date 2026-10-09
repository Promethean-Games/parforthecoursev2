const BILLING_DEVICE_KEY = "deviceId";

export function getBillingDeviceId(): string {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    let deviceId = storage?.getItem(BILLING_DEVICE_KEY) ?? null;
    if (!deviceId) {
      deviceId = globalThis.crypto?.randomUUID?.() ?? `billing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      storage?.setItem(BILLING_DEVICE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `billing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

