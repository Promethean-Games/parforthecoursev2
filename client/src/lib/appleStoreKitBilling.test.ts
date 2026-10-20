import test from "node:test";
import assert from "node:assert/strict";
import { parseAppleTransactionRecords } from "./appleStoreKitBilling";

test("Apple transaction parser keeps only complete signed records", () => {
  assert.deepEqual(
    parseAppleTransactionRecords([
      {
        productId: "com.parforthecourse.app.edition.classic",
        transactionId: "123",
        signedTransaction: "signed-jws",
        unfinished: true,
      },
      { productId: "missing-fields" },
      {
        productId: "com.parforthecourse.app.edition.bundle",
        transactionId: "456",
        signedTransaction: "",
      },
      null,
    ]),
    [{
      productId: "com.parforthecourse.app.edition.classic",
      transactionId: "123",
      signedTransaction: "signed-jws",
      unfinished: true,
    }],
  );
});

test("Apple transaction parser does not trust non-boolean unfinished flags", () => {
  const [transaction] = parseAppleTransactionRecords([{
    productId: "com.parforthecourse.app.edition.bundle",
    transactionId: "456",
    signedTransaction: "signed-jws",
    unfinished: "true",
  }]);
  assert.equal(transaction.unfinished, false);
});
