import type { Metadata } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";
import { Providers } from "@/providers/Providers";

export const metadata: Metadata = {
  title: "Meridian | Quantum Futarchy",
  description: "Capital-efficient prediction market governance on Monad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistPixelSquare.variable}>
      <body className="min-h-screen bg-meridian-bg font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
