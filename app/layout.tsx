import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Harm Lens — NYC street-safety evidence",
  description: "Compare injury-involved and fatal collision-record evidence under one locked method, then inspect supporting IDs, uncertainty, context, and a governed DRAFT packet.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  openGraph: {
    title: "Harm Lens",
    description: "Compare recorded harm. Inspect the evidence.",
    type: "website",
    images: [{ url: "/harm-lens-social.png", width: 1200, height: 630, alt: "Harm Lens — compare recorded harm and inspect the evidence" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Harm Lens",
    description: "Compare recorded harm. Inspect the evidence.",
    images: ["/harm-lens-social.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
