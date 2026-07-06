const BENGALI_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

export function normalizeNumericInput(value: unknown): string {
  const mapped = String(value ?? "")
    .replace(/[০-৯]/g, (digit) => BENGALI_DIGITS[digit])
    .replace(/[，,]/g, ".")
    .replace(/\s+/g, "");
  const negative = mapped.startsWith("-");
  const unsigned = mapped.replace(/-/g, "").replace(/[^0-9.]/g, "");
  const dot = unsigned.indexOf(".");
  const normalized =
    dot === -1
      ? unsigned
      : `${unsigned.slice(0, dot)}.${unsigned.slice(dot + 1).replaceAll(".", "")}`;
  return `${negative ? "-" : ""}${normalized}`;
}

export function parseLocalizedNumber(value: unknown): number {
  const normalized = normalizeNumericInput(value);
  if (
    !normalized ||
    normalized === "-" ||
    normalized === "." ||
    normalized === "-."
  )
    return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
