import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const nunitoSans = Nunito_Sans({variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Subscription Converter",
  description: "Convert between Surge, Clash, and V2Ray subscription formats",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunitoSans.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
