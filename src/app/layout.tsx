import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeInitScript } from "@/components/common/theme-toggle";
import { CommandPalette } from "@/components/common/command-palette";
import { FaviconSync } from "@/components/common/favicon-sync";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getMessages, getTranslator } from "@/i18n/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return {
    title: {
      default: t("meta.title"),
      template: `%s · ${t("meta.title")}`,
    },
    description: t("meta.description"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The language picker's cookie, else the browser's Accept-Language.
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Resolve the theme before paint so there is no light/dark flash.
            next/script hoists this out of the React tree, which keeps React
            from warning about a client-rendered <script>. */}
        <Script
          id="cv-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background"
        >
          {messages.meta.skipToContent}
        </a>
        <FaviconSync />
        <I18nProvider locale={locale} messages={messages}>
          <TooltipProvider>
            {children}
            <CommandPalette />
          </TooltipProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
