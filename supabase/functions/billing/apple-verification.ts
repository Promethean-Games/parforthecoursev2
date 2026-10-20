import { Buffer } from "node:buffer";
import {
  Environment,
  type JWSTransactionDecodedPayload,
  NotificationTypeV2,
  type ResponseBodyV2DecodedPayload,
  SignedDataVerifier,
  Type,
} from "@apple/app-store-server-library";
import { ALLOWED_APPLE_PRODUCT_IDS, APPLE_BUNDLE_ID } from "./apple-products.ts";

export type AppleEnvironment = "Sandbox" | "Production";

export interface AppleVerificationRequest {
  deviceId: string;
  signedTransaction: string;
}

export interface AppleVerificationRpcArgs {
  p_device_id: string;
  p_environment: AppleEnvironment;
  p_original_transaction_id: string;
  p_transaction_id: string;
  p_product_id: string;
  p_bundle_id: string;
  p_purchase_date: string;
  p_revocation_date: null;
  p_revocation_reason: null;
  p_signed_date: string;
  p_signed_transaction: JWSTransactionDecodedPayload;
}

export type AppleRevocationNotificationType =
  | typeof NotificationTypeV2.REFUND
  | typeof NotificationTypeV2.REVOKE
  | typeof NotificationTypeV2.REFUND_REVERSED;

export interface AppleRevocationRpcArgs {
  p_environment: AppleEnvironment;
  p_original_transaction_id: string;
  p_transaction_id: string;
  p_product_id: string;
  p_bundle_id: string;
  p_notification_type: AppleRevocationNotificationType;
  p_notification_signed_date: string;
  p_revocation_date: string | null;
  p_revocation_reason: number | null;
  p_signed_date: string;
  p_signed_transaction: JWSTransactionDecodedPayload;
}

export interface AppleTransactionVerifier {
  verifyAndDecodeTransaction(
    signedTransaction: string,
  ): Promise<JWSTransactionDecodedPayload>;
}

export interface AppleNotificationVerifier {
  verifyAndDecodeNotification(
    signedPayload: string,
  ): Promise<ResponseBodyV2DecodedPayload>;
}

export class AppleTransactionVerificationError extends Error {}

class AppleConfigurationError extends Error {}

const verifiers = new Map<AppleEnvironment, SignedDataVerifier>();

export function getAppleAllowedEnvironment(
  configuredEnvironment = Deno.env.get("APPLE_ALLOWED_ENVIRONMENT"),
): AppleEnvironment {
  if (
    configuredEnvironment !== "Sandbox" &&
    configuredEnvironment !== "Production"
  ) {
    throw new AppleConfigurationError(
      "APPLE_ALLOWED_ENVIRONMENT must be Sandbox or Production",
    );
  }
  return configuredEnvironment;
}

function getAppleRootCertificates(): Buffer[] {
  const configuredRoots = Deno.env.get("APPLE_ROOT_CA_CERTIFICATES");
  if (!configuredRoots) {
    throw new AppleConfigurationError(
      "APPLE_ROOT_CA_CERTIFICATES is not configured",
    );
  }

  let encodedCertificates: unknown;
  try {
    encodedCertificates = JSON.parse(configuredRoots);
  } catch {
    throw new AppleConfigurationError(
      "APPLE_ROOT_CA_CERTIFICATES is not valid JSON",
    );
  }
  if (!Array.isArray(encodedCertificates) || encodedCertificates.length === 0) {
    throw new AppleConfigurationError(
      "APPLE_ROOT_CA_CERTIFICATES must contain root certificates",
    );
  }
  if (
    encodedCertificates.some((certificate) =>
      typeof certificate !== "string" || certificate.length === 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        certificate,
      )
    )
  ) {
    throw new AppleConfigurationError(
      "APPLE_ROOT_CA_CERTIFICATES contains invalid base64",
    );
  }

  return encodedCertificates.map((certificate: string) => Buffer.from(certificate, "base64"));
}

function getAppleSignedDataVerifier(
  environment: AppleEnvironment,
): SignedDataVerifier {
  if (environment !== getAppleAllowedEnvironment()) {
    throw new AppleConfigurationError(
      "Apple transaction environment is not enabled",
    );
  }
  let verifier = verifiers.get(environment);
  if (verifier) return verifier;

  const appAppleId = environment === "Production" ? Number(Deno.env.get("APPLE_APP_ID")) : undefined;
  if (
    environment === "Production" &&
    (!Number.isSafeInteger(appAppleId) || appAppleId! <= 0)
  ) {
    throw new AppleConfigurationError(
      "APPLE_APP_ID must be configured for Production verification",
    );
  }

  verifier = new SignedDataVerifier(
    getAppleRootCertificates(),
    true,
    environment === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION,
    APPLE_BUNDLE_ID,
    appAppleId,
  );
  verifiers.set(environment, verifier);
  return verifier;
}

export function getAppleTransactionVerifier(
  environment: AppleEnvironment,
): AppleTransactionVerifier {
  return getAppleSignedDataVerifier(environment);
}

export function getAppleNotificationVerifier(
  environment: AppleEnvironment,
): AppleNotificationVerifier {
  return getAppleSignedDataVerifier(environment);
}

function isValidAppleTimestamp(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    Number.isFinite(new Date(value).getTime());
}

function requireTransactionFields(
  transaction: JWSTransactionDecodedPayload,
  environment: AppleEnvironment,
  revocationMode: "reject" | "require" | "allow" = "reject",
): asserts transaction is JWSTransactionDecodedPayload & {
  bundleId: string;
  environment: AppleEnvironment;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  signedDate: number;
  transactionId: string;
} {
  if (
    transaction.bundleId !== APPLE_BUNDLE_ID ||
    transaction.environment !== environment ||
    transaction.type !== Type.NON_CONSUMABLE ||
    !transaction.productId ||
    !ALLOWED_APPLE_PRODUCT_IDS.has(transaction.productId) ||
    (revocationMode === "require"
      ? !isValidAppleTimestamp(transaction.revocationDate)
      : revocationMode === "reject"
      ? transaction.revocationDate !== undefined
      : transaction.revocationDate !== undefined &&
        !isValidAppleTimestamp(transaction.revocationDate)) ||
    !transaction.originalTransactionId ||
    !transaction.transactionId ||
    !isValidAppleTimestamp(transaction.purchaseDate) ||
    !isValidAppleTimestamp(transaction.signedDate)
  ) {
    throw new AppleTransactionVerificationError("Apple transaction is invalid");
  }
}

export async function verifyAndRecordAppleTransaction<T>(
  request: AppleVerificationRequest,
  environment: AppleEnvironment,
  verifier: AppleTransactionVerifier,
  record: (args: AppleVerificationRpcArgs) => Promise<T>,
): Promise<T> {
  let transaction: JWSTransactionDecodedPayload;
  try {
    transaction = await verifier.verifyAndDecodeTransaction(
      request.signedTransaction,
    );
  } catch {
    throw new AppleTransactionVerificationError(
      "Apple transaction signature is invalid",
    );
  }

  requireTransactionFields(transaction, environment);

  return await record({
    p_device_id: request.deviceId,
    p_environment: transaction.environment,
    p_original_transaction_id: transaction.originalTransactionId,
    p_transaction_id: transaction.transactionId,
    p_product_id: transaction.productId,
    p_bundle_id: transaction.bundleId,
    p_purchase_date: new Date(transaction.purchaseDate).toISOString(),
    p_revocation_date: null,
    p_revocation_reason: null,
    p_signed_date: new Date(transaction.signedDate).toISOString(),
    p_signed_transaction: transaction,
  });
}

export async function verifyAndRecordAppleRevocation<T>(
  signedPayload: string,
  environment: AppleEnvironment,
  notificationVerifier: AppleNotificationVerifier,
  transactionVerifier: AppleTransactionVerifier,
  record: (args: AppleRevocationRpcArgs) => Promise<T>,
): Promise<{ processed: boolean; result?: T }> {
  let notification: ResponseBodyV2DecodedPayload;
  try {
    notification = await notificationVerifier.verifyAndDecodeNotification(
      signedPayload,
    );
  } catch {
    throw new AppleTransactionVerificationError(
      "Apple notification signature is invalid",
    );
  }

  const notificationType = notification.notificationType;
  if (
    notificationType !== NotificationTypeV2.REFUND &&
    notificationType !== NotificationTypeV2.REVOKE &&
    notificationType !== NotificationTypeV2.REFUND_REVERSED
  ) {
    return { processed: false };
  }
  if (!isValidAppleTimestamp(notification.signedDate)) {
    throw new AppleTransactionVerificationError(
      "Apple notification signed date is invalid",
    );
  }
  const signedTransaction = notification.data?.signedTransactionInfo;
  if (!signedTransaction) {
    throw new AppleTransactionVerificationError(
      "Apple revocation notification has no signed transaction",
    );
  }

  let transaction: JWSTransactionDecodedPayload;
  try {
    transaction = await transactionVerifier.verifyAndDecodeTransaction(
      signedTransaction,
    );
  } catch {
    throw new AppleTransactionVerificationError(
      "Apple transaction signature is invalid",
    );
  }

  requireTransactionFields(
    transaction,
    environment,
    notificationType === NotificationTypeV2.REFUND_REVERSED ? "allow" : "require",
  );
  if (
    typeof transaction.revocationReason !== "undefined" &&
    !Number.isInteger(transaction.revocationReason)
  ) {
    throw new AppleTransactionVerificationError(
      "Apple revocation reason is invalid",
    );
  }

  const args: AppleRevocationRpcArgs = {
    p_environment: transaction.environment,
    p_original_transaction_id: transaction.originalTransactionId,
    p_transaction_id: transaction.transactionId,
    p_product_id: transaction.productId,
    p_bundle_id: transaction.bundleId,
    p_notification_type: notificationType,
    p_notification_signed_date: new Date(notification.signedDate).toISOString(),
    p_revocation_date: notificationType === NotificationTypeV2.REFUND_REVERSED
      ? null
      : new Date(transaction.revocationDate!).toISOString(),
    p_revocation_reason: typeof transaction.revocationReason === "number" ? transaction.revocationReason : null,
    p_signed_date: new Date(transaction.signedDate).toISOString(),
    p_signed_transaction: transaction,
  };

  return { processed: true, result: await record(args) };
}
