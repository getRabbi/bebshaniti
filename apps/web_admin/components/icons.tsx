import type { SVGProps } from "react";

type IconName =
  | "dashboard" | "products" | "inventory" | "sales" | "customers"
  | "due" | "reports" | "settings" | "search" | "plus" | "bell"
  | "arrow" | "lock" | "building" | "users" | "branch" | "device";

const paths: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  products: <><path d="m7.5 4.27 9 5.15v10.3l-9-5.15V4.27Z"/><path d="m16.5 9.42 4-2.29v10.3l-4 2.29M7.5 4.27l4-2.29 9 5.15M7.5 9.42l9 5.15"/></>,
  inventory: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12.1V21"/><path d="m8 5.2 8 4.5"/></>,
  sales: <><path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-3-2-2.5 2-2.5-2-2.5 2L6 17l-2 2Z"/><path d="M8 7h8M8 11h8"/></>,
  customers: <><circle cx="9" cy="8" r="4"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4.5a4 4 0 0 1 0 7.5M17 15a6 6 0 0 1 4 5.65"/></>,
  due: <><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9h-4.5a2 2 0 1 0 0 4H13a2 2 0 1 1 0 4H9"/></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.64 8.94a1.7 1.7 0 0 0-.34-1.88L4.24 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57a1.7 1.7 0 0 0 1.03-1.56V3h4v.08A1.7 1.7 0 0 0 15.06 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.99 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  building: <><path d="M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2"/></>,
  users: <><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 3.3a4 4 0 0 1 0 7.4M18 14a7 7 0 0 1 4 6.3"/></>,
  branch: <><path d="M6 3v12M18 9v12M6 8h8a4 4 0 0 1 4 4M3 18l3 3 3-3M15 18l3 3 3-3"/></>,
  device: <><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 5h6M11 18h2"/></>
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
