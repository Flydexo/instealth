import type { Metadata } from "next";
import "./globals.css";
import { Inter as FontSans } from "next/font/google";
import { cn } from "@/lib/utils";
import { config } from "@/lib/config";
import { headers } from "next/headers";
import { cookieToInitialState } from "@alchemy/aa-alchemy/config";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Instealth",
  description: "Instealth",
};

const fontSans = FontSans({ subsets: ["latin"], variable: "--font-sans" });

const RootLayout: React.FC = ({
  children,
}: any) => {
  const initialState = cookieToInitialState(
    config,
    headers().get("cookie") ?? undefined,
  );

  return (
    <html lang="en">
      <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
        <Providers initialState={initialState}>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}

export default RootLayout;
