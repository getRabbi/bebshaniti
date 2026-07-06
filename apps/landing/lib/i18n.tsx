"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LandingLocale = "bn" | "en";

const LandingI18nContext = createContext<{
  locale: LandingLocale;
  setLocale: (locale: LandingLocale) => void;
} | null>(null);

export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LandingLocale>("bn");

  useEffect(() => {
    const stored = window.localStorage.getItem("bebshaniti-site-locale");
    if (stored === "bn" || stored === "en") setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "bn" ? "bn-BD" : "en-BD";
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale: (next: LandingLocale) => {
      setLocaleState(next);
      window.localStorage.setItem("bebshaniti-site-locale", next);
    },
  }), [locale]);

  return <LandingI18nContext.Provider value={value}>{children}</LandingI18nContext.Provider>;
}

export function useLandingI18n() {
  const value = useContext(LandingI18nContext);
  if (!value) throw new Error("LandingI18nProvider is missing");
  return value;
}
