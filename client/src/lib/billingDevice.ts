const BILLING_DEVICE_KEY = "deviceId";

export function getBillingDeviceId(): string {
  let deviceId = localStorage.getItem(BILLING_DEVICE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(BILLING_DEVICE_KEY, deviceId);
  }
  return deviceId;
}

