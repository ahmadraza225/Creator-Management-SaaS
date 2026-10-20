export function usd(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value % 1 === 0 ? 0 : 2 });
}

export function pct(value: number | null) {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

export function shortDate(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "–";
}

export function inputDate(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function compact(n: number) {
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}
