import type { Metadata } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import { GlobalBackground } from "@/components/GlobalBackground";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian | Quantum Futarchy",
  description: "Capital-efficient prediction market governance on Monad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistPixelSquare.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-meridian-bg font-sans antialiased">
        <GlobalBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
