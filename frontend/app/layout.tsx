import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import AppToaster from "@/components/Shared/AppToaster";
import "./globals.css";

// Keep a version in the URL because browsers cache favicons aggressively.
const FAVICON_SRC = "/fav.png";
const popins = Poppins({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--poppinsFont",
  subsets: ["latin"],
});

const interfont = Inter({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--interfont",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Task Management",
  description: "Centralized management system for Deero Company",
  icons: {
    icon: FAVICON_SRC,
    shortcut: FAVICON_SRC,
    apple: FAVICON_SRC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href={FAVICON_SRC} />
        <link rel="shortcut icon" type="image/svg+xml" href={FAVICON_SRC} />
      </head>
      <body
        suppressHydrationWarning
        className={` ${popins.className} ${interfont.className} h-full bg-[#F8F9FA] text-foreground antialiased`}
      >
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
