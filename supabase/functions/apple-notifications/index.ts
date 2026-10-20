import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  AppleTransactionVerificationError,
  getAppleAllowedEnvironment,
  getAppleNotificationVerifier,
  getAppleTransactionVerifier,
  verifyAndRecordAppleRevocation,
} from "../billing/apple-verification.ts";

const notificationSchema = z.object({
  signedPayload: z.string().min(1).max(50_000),
}).strict();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const parsed = notificationSchema.safeParse(payload);
  if (!parsed.success) return json({ error: "Invalid request" }, 400);

  try {
    const environment = getAppleAllowedEnvironment();
    const result = await verifyAndRecordAppleRevocation(
      parsed.data.signedPayload,
      environment,
      getAppleNotificationVerifier(environment),
      getAppleTransactionVerifier(environment),
      async (args) => {
        const { data, error } = await supabase.rpc(
          "billing_record_apple_revocation",
          args,
        );
        if (error) throw error;
        return data;
      },
    );
    return json({ received: true, processed: result.processed }, 200);
  } catch (error) {
    if (error instanceof AppleTransactionVerificationError) {
      return json({ error: "Invalid Apple notification" }, 400);
    }
    console.error(
      "Error processing Apple notification:",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "Failed to process Apple notification" }, 500);
  }
});
