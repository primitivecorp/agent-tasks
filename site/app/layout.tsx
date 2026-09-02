import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import { Provider } from "./provider";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "agent-tasks",
    template: "%s · agent-tasks",
  },
  description:
    "Task orchestration for coding agents as Kubernetes resources: an operator and five custom resources that take a ticket to a merged, verified, closed change.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col font-sans">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
