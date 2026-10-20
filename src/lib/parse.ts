// Turns the messy text people type (or paste from sheets) into clean values.

export function parseHandle(raw: string): string | null {
  const text = raw.trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, "");
  const match = text.match(/@?([A-Za-z0-9._]+)/);
  return match ? match[1].replace(/\.+$/, "").toLowerCase() : null;
}

export function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const match = raw.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function parseCount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  if (typeof raw !== "string") return null;
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : null;
}

// "$450 for 20 videos" -> { fee: 450, videos: 20 }
export function parseDeal(raw: unknown): { fee: number | null; videos: number | null } {
  if (typeof raw !== "string") return { fee: parseMoney(raw), videos: null };
  const videos = raw.match(/(\d+)\s*videos?/i);
  return { fee: parseMoney(raw), videos: videos ? Number(videos[1]) : null };
}

// One video per line: "<url> <spark code>" (tab, comma or space separated). Spark code is optional.
export function parseVideoLines(text: string): { url: string; sparkCode: string | null }[] {
  const out: { url: string; sparkCode: string | null }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/[\s,]+/).filter(Boolean);
    const url = parts.find((p) => /^https?:\/\//i.test(p));
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const code = parts.find((p) => !/^https?:\/\//i.test(p)) ?? null;
    out.push({ url, sparkCode: code });
  }
  return out;
}

export function guessPayoutMethod(details: string | null | undefined) {
  if (!details) return null;
  const d = details.toLowerCase();
  if (d.includes("zelle")) return "ZELLE" as const;
  if (d.includes("venmo")) return "VENMO" as const;
  if (d.includes("paypal") || d.includes("@")) return "PAYPAL" as const;
  if (/\d{7,}/.test(d)) return "ZELLE" as const;
  return null;
}

export function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
