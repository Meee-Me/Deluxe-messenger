import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--display" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--body" });

export const metadata: Metadata = {
  title: "Deluxe Messenger",
  description: "Private, end-to-end encrypted chat and calls.",
  appleWebApp: { capable: true, title: "Deluxe", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-180.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1a0b2e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>;
}
