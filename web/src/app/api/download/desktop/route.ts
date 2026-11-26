import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GITHUB_REPO = "baraa123457/wordtap";
const LATEST_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = (searchParams.get("format") || "exe").toLowerCase();
  const arch = (searchParams.get("arch") || "arm64").toLowerCase() === "x64" ? "x64" : "arm64";

  let fileName = "WordTap-Setup-x64.exe";
  if (format === "msi") {
    fileName = "WordTap-Setup-x64.msi";
  } else if (format === "zip") {
    fileName = "WordTap-Setup-x64.zip";
  } else if (format === "dmg") {
    fileName = `WordTap-mac-${arch}.dmg`;
  } else if (format === "mac-zip") {
    fileName = `WordTap-mac-${arch}.zip`;
  }

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
