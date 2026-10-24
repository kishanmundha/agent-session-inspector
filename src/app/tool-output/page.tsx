"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { LanguagePicker } from "@/components/common/language-picker";
import { PalettePicker } from "@/components/common/palette-picker";
import { ScrollToTop } from "@/components/common/scroll-to-top";
import { SearchTrigger } from "@/components/common/command-palette";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { ToolResultsView } from "@/components/home/tool-results-view";

/**
 * Every result behind one row of the Analytics tab's Tool output table. A page
 * rather than a dialog, so a result opened in its session comes back to the
 * list as it was left.
 */
export default function ToolOutputPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/?tab=analytics" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Bot className="size-4" aria-hidden />
            </span>
            <span className="hidden truncate text-sm font-semibold leading-none tracking-tight sm:block">
              Agent <span className="text-brand">Session</span> Inspector
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SearchTrigger />
            <LanguagePicker />
            <PalettePicker />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* The view reads the URL, which needs a Suspense boundary to prerender. */}
        <Suspense>
          <ToolResultsView />
        </Suspense>
      </main>
      <ScrollToTop />
    </div>
  );
}
