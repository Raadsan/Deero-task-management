import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import AppToaster from "@/components/Shared/AppToaster";
import "./globals.css";
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
  title: "Deero Management System",
  description: "Centralized management system for Deero Company",
  icons: {
    icon: "/logo1.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full" suppressHydrationWarning>
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
