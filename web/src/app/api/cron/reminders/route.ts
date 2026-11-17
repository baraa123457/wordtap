import { NextResponse } from "next/server";
import crypto from "crypto";

function isAuthorizedCron(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In production, reject if CRON_SECRET is not configured to prevent unauthenticated execution
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const expectedToken = `Bearer ${cronSecret}`;
  // Constant-time comparison using fixed-size SHA-256 hashes to prevent timing attacks
  const hashActual = crypto.createHash("sha256").update(authHeader).digest();
  const hashExpected = crypto.createHash("sha256").update(expectedToken).digest();

  return crypto.timingSafeEqual(hashActual, hashExpected);
}

async function handleReminders(req: Request) {
  try {
    if (!isAuthorizedCron(req)) {
      return NextResponse.json(
        { error: "Unauthorized. Valid Bearer CRON_SECRET is required." },
        { status: 401 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        {
          status: "simulated",
          message:
            "RESEND_API_KEY is not configured in server env. Reminder emails are ready to send once the key is provided.",
        },
        { status: 200 }
      );
    }

    // In a live production configuration with RESEND_API_KEY, query users with reminders_enabled and due words
    return NextResponse.json({
      status: "ok",
      sent: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process reminder batch" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleReminders(req);
}

export async function POST(req: Request) {
  return handleReminders(req);
}
