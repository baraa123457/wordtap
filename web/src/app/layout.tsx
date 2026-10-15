import type { Metadata, Viewport } from "next";
import "@fontsource-variable/readex-pro";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "WordTap: practice the words you tap while watching",
  description:
    "WordTap keeps every subtitle word you translate with the browser extension and turns them into short daily practice.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e20" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var raw = localStorage.getItem('wordtap_settings');
                var parsed = null;
                try {
                  if (raw && raw !== 'undefined' && raw !== 'null') parsed = JSON.parse(raw);
                } catch(e) {}
                var t = (parsed && parsed.theme) || localStorage.getItem('wordtap_theme') || 'system';
                var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (dark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } else {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                }
                document.documentElement.setAttribute('data-theme', t);
              } catch(e) {}
            })()`,
          }}
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
