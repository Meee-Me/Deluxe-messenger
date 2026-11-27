import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--display" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--body" });

export const metadata = { title: "Deluxe Messenger" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>;
}
