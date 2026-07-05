"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "bn-BD" | "en";

const messages = {
  "bn-BD": {
    dashboard: "ড্যাশবোর্ড",
    products: "পণ্য",
    inventory: "স্টক / ইনভেন্টরি",
    sales: "বিক্রয়",
    customers: "কাস্টমার",
    due: "বাকি / পাওনা",
    reports: "রিপোর্ট",
    settings: "সেটিংস",
    workspace: "ওয়ার্কস্পেস",
    currentWorkspace: "বর্তমান ব্যবসা",
    signOut: "লগআউট",
    addProduct: "পণ্য যোগ করুন",
    addSale: "নতুন বিক্রয়",
    addCustomer: "কাস্টমার যোগ করুন",
    receiveDue: "বাকি আদায়",
    printLastMemo: "শেষ মেমো প্রিন্ট",
    save: "সেভ",
    cancel: "বাতিল",
    retry: "আবার চেষ্টা করুন",
    loading: "লোড হচ্ছে…",
    noData: "এখনও কোনো তথ্য নেই",
    buyingPrice: "ক্রয় মূল্য",
    sellingPrice: "বিক্রয় মূল্য",
    profit: "লাভ",
    profitMargin: "লাভের হার",
    cashMemo: "ক্যাশ মেমো",
    print: "প্রিন্ট",
    language: "ভাষা",
    english: "English",
    bangla: "বাংলা",
  },
  en: {
    dashboard: "Dashboard",
    products: "Products",
    inventory: "Inventory",
    sales: "Sales",
    customers: "Customers",
    due: "Due / Baki",
    reports: "Reports",
    settings: "Settings",
    workspace: "Workspace",
    currentWorkspace: "Current workspace",
    signOut: "Sign out",
    addProduct: "Add product",
    addSale: "New sale",
    addCustomer: "Add customer",
    receiveDue: "Receive due",
    printLastMemo: "Print last memo",
    save: "Save",
    cancel: "Cancel",
    retry: "Retry",
    loading: "Loading…",
    noData: "No data yet",
    buyingPrice: "Buying price",
    sellingPrice: "Selling price",
    profit: "Profit",
    profitMargin: "Profit margin",
    cashMemo: "Cash memo",
    print: "Print",
    language: "Language",
    english: "English",
    bangla: "বাংলা",
  },
} as const;

type Key = keyof typeof messages.en;
const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: Key) => string;
} | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("bn-BD");
  useEffect(() => {
    const stored = window.localStorage.getItem("business-os-locale");
    if (stored === "en" || stored === "bn-BD") setLocaleState(stored);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        setLocaleState(next);
        window.localStorage.setItem("business-os-locale", next);
      },
      t: (key: Key) => messages[locale][key],
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is missing");
  return value;
}
