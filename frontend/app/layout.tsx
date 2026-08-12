import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import AppToaster from "@/components/Shared/AppToaster";
import "./globals.css";

// Keep a version in the URL because browsers cache favicons aggressively.
const FAVICON_SRC = "/fav.png?v=2";
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
  title: "Deero - Task Management System",
  description: "Centralized management system for Deero Company",
  icons: {
    icon: [
      { url: "/fav.png?v=2", type: "image/png" },
      { url: "/favicon-01.svg?v=2", type: "image/svg+xml" },
    ],
    shortcut: "/fav.png?v=2",
    apple: "/fav.png?v=2",
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
        <link rel="icon" type="image/png" href="/fav.png?v=2" />
        <link rel="shortcut icon" type="image/png" href="/fav.png?v=2" />
        <link rel="apple-touch-icon" href="/fav.png?v=2" />
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
