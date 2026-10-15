import { AuthActions } from "@/components/AuthActions";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Get the extension · WordTap" };

const STEPS = [
  {
    title: "Download and unzip",
    body: (
      <>
        <a
          href="/wordtap-extension.zip"
          download
          className="font-semibold underline decoration-subtitle decoration-4 underline-offset-4"
        >
          Download wordtap-extension.zip
        </a>{" "}
        and unzip it somewhere you will keep it.
      </>
    ),
  },
  {
    title: "Load it in Chrome",
    body: (
      <>
        Open <code className="rounded bg-line px-1.5 py-0.5">chrome://extensions</code>, turn on Developer mode,
        click Load unpacked, and choose the unzipped folder.
      </>
    ),
  },
  {
    title: "Sign in from the toolbar icon",
    body: "Use the same email and password as this site. Your saved words sync to your account from then on.",
  },
  {
    title: "Tap words while you watch",
    body: "Open a YouTube or Netflix video with subtitles on and click any word. Shift+click translates the whole line.",
  },
] as const;

export default function ExtensionPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <AuthActions size="nav" />
      </header>
      <main className="grid gap-8 pb-20 pt-8">
        <h1 className="text-4xl font-bold tracking-tight">Get the extension</h1>
        <p className="max-w-xl text-lg text-muted">
          The extension adds click-to-translate to subtitles and sends every word you tap to your WordTap account.
        </p>
        <ol className="grid gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[2.25rem_1fr] gap-4">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-full bg-subtitle font-semibold text-subtitle-ink"
              >
                {i + 1}
              </span>
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <section className="grid gap-2 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">Settings in the popup</h2>
          <p className="text-muted">
            Choose the language you translate into, how long the translation stays on screen, whether the video
            pauses when you click a word, and whether words are saved at all. You can turn the extension off
            without removing it.
          </p>
        </section>
      </main>
    </div>
  );
}
