import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientAuthProvider from "../components/ClientAuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Placerly",
  description: "Student placement tracking and management system for CBIT(A)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <ClientAuthProvider>
          <div className="min-h-screen flex flex-col">
            <main className="flex-1">{children}</main>
            <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-center py-4">
              <div className="container mx-auto px-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  Developed by{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    AR
                  </span>
                </p>
              </div>
            </footer>
          </div>
        </ClientAuthProvider>
      </body>
    </html>
  );
}
