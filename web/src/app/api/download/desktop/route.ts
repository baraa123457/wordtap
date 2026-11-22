import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GITHUB_REPO = "baraa123457/wordtap";
const LATEST_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = (searchParams.get("format") || "exe").toLowerCase();

  const fileName =
    format === "msi"
      ? "WordTap-Setup-x64.msi"
      : format === "zip"
      ? "WordTap-Player-win-x64.zip"
      : "WordTap-Setup-x64.exe";

  // Check if a packaged local binary or installer is present in desktop-player/dist
  try {
    const localExePath = path.resolve(
      process.cwd(),
      "..",
      "desktop-player",
      "dist",
      "WordTap-VLC-Player-win32-x64",
      "WordTap-VLC-Player.exe"
    );

    if (format === "exe" && fs.existsSync(localExePath)) {
      const stat = fs.statSync(localExePath);
      // Stream local binary if running in local development environment
      const fileStream = fs.createReadStream(localExePath);
      // @ts-expect-error Node stream to Web ReadableStream
      return new NextResponse(fileStream, {
        headers: {
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Type": "application/vnd.microsoft.portable-executable",
          "Content-Length": stat.size.toString(),
        },
      });
    }
  } catch {
    // Fall back to GitHub release asset
  }

  // Redirect to official GitHub release binary / installer
  const targetUrl = `${LATEST_RELEASE_URL}/${fileName}`;
  return NextResponse.redirect(targetUrl, 307);
}
