import type { Metadata } from "next";
import { Chakra_Petch, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IntegrityPro · RFX",
  description: "Internal RFX response drafting console for IntegrityPro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${chakra.variable} ${manrope.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="relative isolate flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
