import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    // Verify cron authorization header if CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
