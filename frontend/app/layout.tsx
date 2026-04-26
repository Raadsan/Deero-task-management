import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { Toaster } from "react-hot-toast";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full" suppressHydrationWarning>
      <body
        className={` ${popins.className} ${interfont.className} h-full antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
