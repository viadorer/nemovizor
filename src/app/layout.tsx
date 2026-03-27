import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { FavoritesProvider } from "@/components/favorites-provider";
import { TranslationProvider } from "@/i18n/provider";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { brand } from "@/brands";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: brand.metadata.title,
  description: brand.metadata.description,
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={brand.locale} data-theme="dark" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <FavoritesProvider>
              <TranslationProvider>
              <AnalyticsProvider>{children}</AnalyticsProvider>
            </TranslationProvider>
            </FavoritesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
