import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "./_components/Header";
import Sidebar from "./_components/Sidebar";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Papas Shorts",
  description: "KI-generierte Bilder für Fashion Store",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full flex flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-white p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
