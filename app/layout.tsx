import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harm Lens — NYC collision records",
  description: "A live-connected visualization of how NYC road-user rankings shift from injury-involved to fatal crash records.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
