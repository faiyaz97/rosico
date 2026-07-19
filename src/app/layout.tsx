import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rosica.it"),
  title: {
    default: "Rosica — Friendly competition, properly ranked",
    template: "%s · Rosica"
  },
  description:
    "Run casual competitions, rankings and tournaments with your group.",
  applicationName: "Rosica",
  icons: { icon: "/rosica-mark.svg" }
};

export const viewport: Viewport = {
  themeColor: "#f7f6f1",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
