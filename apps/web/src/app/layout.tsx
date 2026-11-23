import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Inter 4.1 from the upstream distribution. The font and its OFL license are kept together.
const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-sans",
  weight: "400 600",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Silver Care",
  description: "Portal komunikacji i organizacji codziennego życia placówki.",
  manifest: "/manifest.json",
};

import { PwaRegister } from "@/components/PwaRegister";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getAntiFOUCScript } from "@/lib/theme";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getAntiFOUCScript(),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
