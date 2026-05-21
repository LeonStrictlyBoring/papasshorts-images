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
  icons: {
    icon: "/papasshorts-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geist.variable} h-full antialiased`}>
      <body className="h-full flex flex-col relative">
        <Header />
        <div className="absolute top-2 left-28 -translate-x-1/2 z-20 w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md">
          <img src="/Logo-papasshorts.png" alt="Papas Shorts" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-white pt-[69px] px-8 pb-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
