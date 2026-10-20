import assert from "node:assert/strict";
import { Environment, type JWSTransactionDecodedPayload, SignedDataVerifier } from "@apple/app-store-server-library";
import {
  type AppleNotificationVerifier,
  type AppleRevocationRpcArgs,
  AppleTransactionVerificationError,
  type AppleTransactionVerifier,
  type AppleVerificationRpcArgs,
  getAppleAllowedEnvironment,
  verifyAndRecordAppleRevocation,
  verifyAndRecordAppleTransaction,
} from "./apple-verification.ts";
import { APPLE_BUNDLE_ID } from "./apple-products.ts";

const validTransaction = {
  bundleId: "com.parforthecourse.app",
  environment: "Sandbox" as const,
  originalTransactionId: "original-1",
  productId: "com.parforthecourse.app.edition.classic",
  purchaseDate: 1_800_000_000_000,
  signedDate: 1_800_000_000_100,
  transactionId: "transaction-1",
  type: "Non-Consumable",
};

const request = {
  deviceId: "device-1",
  signedTransaction: "signed.apple.transaction",
};

function verifier(
  transaction: JWSTransactionDecodedPayload = validTransaction,
  verify: AppleTransactionVerifier["verifyAndDecodeTransaction"] = async () => transaction,
): AppleTransactionVerifier {
  return { verifyAndDecodeTransaction: verify };
}

function recordCalls() {
  const calls: AppleVerificationRpcArgs[] = [];
  return {
    calls,
    record: async (args: AppleVerificationRpcArgs) => {
      calls.push(args);
      return "recorded";
    },
  };
}

Deno.test("valid signed transaction records only verified Apple fields", async () => {
  const db = recordCalls();
  let verifiedSignedData = "";
  const result = await verifyAndRecordAppleTransaction(
    request,
    "Sandbox",
    verifier(validTransaction, async (signedData) => {
      verifiedSignedData = signedData;
      return validTransaction;
    }),
    db.record,
  );

  assert.equal(result, "recorded");
  assert.equal(verifiedSignedData, request.signedTransaction);
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].p_product_id, validTransaction.productId);
  assert.equal(db.calls[0].p_environment, "Sandbox");
  assert.equal(
    db.calls[0].p_purchase_date,
    new Date(validTransaction.purchaseDate).toISOString(),
  );
  assert.equal(db.calls[0].p_revocation_date, null);
  assert.deepEqual(db.calls[0].p_signed_transaction, validTransaction);
});

Deno.test("a transaction rejected by the verifier never reaches the RPC", async () => {
  const db = recordCalls();
  await assert.rejects(
    verifyAndRecordAppleTransaction(
      request,
      "Sandbox",
      verifier(validTransaction, async () => {
        throw new Error("signature verification failed");
      }),
      db.record,
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(db.calls.length, 0);
});

Deno.test("Apple's verification library loads in Deno and rejects malformed signed data", async () => {
  const appleVerifier = new SignedDataVerifier(
    [],
    false,
    Environment.SANDBOX,
    APPLE_BUNDLE_ID,
  );
  await assert.rejects(
    appleVerifier.verifyAndDecodeTransaction("not.a.valid.jws"),
  );
});

Deno.test("Apple environment is selected only by explicit server configuration", () => {
  assert.equal(getAppleAllowedEnvironment("Sandbox"), "Sandbox");
  assert.equal(getAppleAllowedEnvironment("Production"), "Production");
  assert.throws(() => getAppleAllowedEnvironment(undefined));
  assert.throws(() => getAppleAllowedEnvironment("Xcode"));
});

Deno.test("wrong bundle ID is rejected without reaching the RPC", async () => {
  const db = recordCalls();
  await assert.rejects(
    verifyAndRecordAppleTransaction(
      request,
      "Sandbox",
      verifier({ ...validTransaction, bundleId: "com.attacker.app" }),
      db.record,
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(db.calls.length, 0);
});

Deno.test("a consumable transaction is rejected without reaching the RPC", async () => {
  const db = recordCalls();
  await assert.rejects(
    verifyAndRecordAppleTransaction(
      request,
      "Sandbox",
      verifier({ ...validTransaction, type: "Consumable" }),
      db.record,
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(db.calls.length, 0);
});

Deno.test("unsupported Apple product is rejected without reaching the RPC", async () => {
  const db = recordCalls();
  await assert.rejects(
    verifyAndRecordAppleTransaction(
      request,
      "Sandbox",
      verifier({
        ...validTransaction,
        productId: "com.parforthecourse.app.premium",
      }),
      db.record,
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(db.calls.length, 0);
});

Deno.test("revoked transactions are rejected without reaching the RPC", async () => {
  const db = recordCalls();
  await assert.rejects(
    verifyAndRecordAppleTransaction(
      request,
      "Sandbox",
      verifier({ ...validTransaction, revocationDate: 1_800_000_000_500 }),
      db.record,
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(db.calls.length, 0);
});

Deno.test("duplicate verification sends the same idempotency keys to the database RPC", async () => {
  const db = recordCalls();
  await verifyAndRecordAppleTransaction(
    request,
    "Sandbox",
    verifier(),
    db.record,
  );
  await verifyAndRecordAppleTransaction(
    request,
    "Sandbox",
    verifier(),
    db.record,
  );

  assert.equal(db.calls.length, 2);
  assert.deepEqual(
    db.calls.map((
      { p_environment, p_original_transaction_id, p_transaction_id },
    ) => [
      p_environment,
      p_original_transaction_id,
      p_transaction_id,
    ]),
    [
      ["Sandbox", "original-1", "transaction-1"],
      ["Sandbox", "original-1", "transaction-1"],
    ],
  );
});

Deno.test("transactions from the environment not configured by the server are rejected", async () => {
  const db = recordCalls();
  await verifyAndRecordAppleTransaction(
    request,
    "Sandbox",
    verifier(),
    db.record,
  );
  assert.equal(db.calls[0].p_environment, "Sandbox");

  await assert.rejects(
    verifyAndRecordAppleTransaction(
      request,
      "Production",
      verifier(),
      db.record,
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(db.calls.length, 1);
});

Deno.test("refund notifications verify both signatures before recording the revocation", async () => {
  const revokedTransaction = {
    ...validTransaction,
    revocationDate: 1_800_000_100_000,
    revocationReason: 1,
  };
  const notificationVerifier: AppleNotificationVerifier = {
    verifyAndDecodeNotification: async (payload) => {
      assert.equal(payload, "signed.apple.notification");
      return {
        notificationType: "REFUND",
        signedDate: 1_800_000_200_000,
        data: { signedTransactionInfo: "signed.apple.transaction" },
      };
    },
  };
  const transactionVerifier = verifier(revokedTransaction);
  const rpcCalls: AppleRevocationRpcArgs[] = [];
  const result = await verifyAndRecordAppleRevocation(
    "signed.apple.notification",
    "Sandbox",
    notificationVerifier,
    transactionVerifier,
    async (args) => {
      rpcCalls.push(args);
      return "revoked";
    },
  );

  assert.deepEqual(result, { processed: true, result: "revoked" });
  assert.equal(rpcCalls.length, 1);
  assert.equal(
    rpcCalls[0].p_revocation_date,
    new Date(revokedTransaction.revocationDate).toISOString(),
  );
  assert.equal(
    rpcCalls[0].p_notification_signed_date,
    new Date(1_800_000_200_000).toISOString(),
  );
  assert.equal(rpcCalls[0].p_notification_type, "REFUND");
});

Deno.test("invalid notifications and nested transactions never reach the revocation RPC", async () => {
  const db = recordCalls();
  const revocationCalls: AppleRevocationRpcArgs[] = [];
  const invalidNotificationVerifier: AppleNotificationVerifier = {
    verifyAndDecodeNotification: async () => {
      throw new Error("invalid signature");
    },
  };
  const refundVerifier: AppleNotificationVerifier = {
    verifyAndDecodeNotification: async () => ({
      notificationType: "REFUND",
      signedDate: 1_800_000_200_000,
      data: { signedTransactionInfo: "tampered" },
    }),
  };

  await assert.rejects(
    verifyAndRecordAppleRevocation(
      "tampered",
      "Sandbox",
      invalidNotificationVerifier,
      verifier(),
      async (args) => {
        revocationCalls.push(args);
        return "recorded";
      },
    ),
    AppleTransactionVerificationError,
  );
  await assert.rejects(
    verifyAndRecordAppleRevocation(
      "signed.apple.notification",
      "Sandbox",
      refundVerifier,
      verifier(validTransaction),
      async (args) => {
        revocationCalls.push(args);
        return "recorded";
      },
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(revocationCalls.length, 0);
});

Deno.test("a revocation notification without a signed ordering date is rejected before recording", async () => {
  const revocationCalls: AppleRevocationRpcArgs[] = [];
  await assert.rejects(
    verifyAndRecordAppleRevocation(
      "signed.apple.notification",
      "Sandbox",
      {
        verifyAndDecodeNotification: async () => ({
          notificationType: "REFUND",
          data: { signedTransactionInfo: "signed.apple.transaction" },
        }),
      },
      verifier({
        ...validTransaction,
        revocationDate: 1_800_000_100_000,
      }),
      async (args) => {
        revocationCalls.push(args);
        return "recorded";
      },
    ),
    AppleTransactionVerificationError,
  );
  assert.equal(revocationCalls.length, 0);
});

Deno.test("unrelated verified notifications are acknowledged without a database write", async () => {
  const db = recordCalls();
  const result = await verifyAndRecordAppleRevocation(
    "signed.apple.notification",
    "Sandbox",
    {
      verifyAndDecodeNotification: async () => ({ notificationType: "TEST" }),
    },
    verifier(),
    async () => {
      throw new Error("unrelated notifications must not record a revocation");
    },
  );

  assert.deepEqual(result, { processed: false });
  assert.equal(db.calls.length, 0);
});

Deno.test("refund reversal clears revocation through the restricted RPC", async () => {
  const revocationCalls: AppleRevocationRpcArgs[] = [];
  const result = await verifyAndRecordAppleRevocation(
    "signed.apple.notification",
    "Sandbox",
    {
      verifyAndDecodeNotification: async () => ({
        notificationType: "REFUND_REVERSED",
        signedDate: 1_800_000_300_000,
        data: { signedTransactionInfo: "signed.apple.transaction" },
      }),
    },
    verifier(validTransaction),
    async (args) => {
      revocationCalls.push(args);
      return "restored";
    },
  );

  assert.deepEqual(result, { processed: true, result: "restored" });
  assert.equal(revocationCalls[0].p_revocation_date, null);
});
