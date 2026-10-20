// One-off import of the old Google Sheets tracker (downloaded as .xlsx).
//
//   npm run import:sheet -- path/to/tracker.xlsx --dry-run   (preview, writes nothing)
//   npm run import:sheet -- path/to/tracker.xlsx
//
// Tabs are recognised by their header row, not their name:
//   brands tab    -> has "Retainer Focused Products"
//   creators tab  -> has "Creator Status"
//   per-brand tab -> has "Video link" (one block per creator: name row, then one row per video)
// Any other tab (e.g. credentials) is never read. Safe to re-run: existing rows are matched, not duplicated.
import ExcelJS from "exceljs";
import { Prisma, PrismaClient, type PaymentStatus, type Priority, type SampleStatus, type Stage } from "@prisma/client";
import { splitFee } from "../src/lib/domain";
import { guessPayoutMethod, normalizeName, parseCount, parseDeal, parseHandle, parseMoney } from "../src/lib/parse";

const db = new PrismaClient();
type Tx = Prisma.TransactionClient;
type Row = Record<string, unknown>;

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
const warnings: string[] = [];
const stats = { brands: 0, creators: 0, retainers: 0, videos: 0 };

// ---------- reading cells ----------

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("hyperlink" in v) return (v as ExcelJS.CellHyperlinkValue).hyperlink || (v as ExcelJS.CellHyperlinkValue).text;
    if ("text" in v) return String((v as { text: unknown }).text);
    return null;
  }
  return typeof v === "string" ? v.trim() || null : v;
}

function readRows(ws: ExcelJS.Worksheet): { headers: string[]; rows: Row[] } {
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cellValue(cell.value) ?? `col${col}`).trim();
  });
  const rows: Row[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const out: Row = {};
    headers.forEach((h, i) => (out[h] = cellValue(row.getCell(i + 1).value)));
    if (Object.values(out).some((v) => v !== null)) rows.push(out);
  });
  return { headers, rows };
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);

function parseDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  const s = str(v);
  if (!s) return null;
  const d = new Date(s.replace(/(\d+)(st|nd|rd|th)/i, "$1"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function gmvFrom(text: string) {
  const m = text.match(/GMV\s*:?\s*\$?\s*([\d.,]+\s*[kKmM]?)/);
  return m ? `$${m[1].replace(/\s/g, "")}` : null;
}

function joinNotes(parts: [string, unknown][]) {
  return parts
    .map(([who, v]) => (str(v) ? `${who}: ${str(v)}` : null))
    .filter(Boolean)
    .join("\n") || null;
}

// ---------- matching ----------

function findBrand(brands: { id: string; name: string }[], raw: string) {
  const key = normalizeName(raw);
  if (!key) return null;
  return (
    brands.find((b) => normalizeName(b.name) === key) ??
    brands.find((b) => {
      const other = normalizeName(b.name);
      return Math.min(other.length, key.length) >= 4 && (other.startsWith(key) || key.startsWith(other));
    }) ??
    null
  );
}

function mapStage(creatorStatus: string, clientStatus: string, collabStatus: string): Stage {
  const s = creatorStatus.toLowerCase();
  const c = clientStatus.toLowerCase();
  if (s.includes("reject") || c.includes("declin")) return "DECLINED";
  if (s.includes("complete")) return "COMPLETED";
  if (collabStatus.toLowerCase().includes("stop")) return "STOPPED";
  if (s.includes("posting")) return "POSTING";
  if (s.includes("sample") && !s.includes("awaiting")) return "SAMPLE_SHIPPED";
  if (s.includes("signed")) return "CONTRACT_SIGNED";
  if (s.includes("contract")) return "CONTRACT_SENT";
  if (s.includes("client") || c.includes("wait")) return "CLIENT_REVIEW";
  if (c.includes("accept")) return "APPROVED";
  return "PROSPECT";
}

function sampleFor(stage: Stage): SampleStatus {
  if (stage === "SAMPLE_SHIPPED") return "SHIPPED";
  if (stage === "POSTING" || stage === "COMPLETED") return "DELIVERED";
  return "NOT_SENT";
}

// ---------- import steps ----------

async function importBrands(tx: Tx, rows: Row[]) {
  for (const r of rows) {
    const name = str(r["Brand"]);
    if (!name) continue;
    const priority = (str(r["Priority"])?.toUpperCase() ?? "MEDIUM") as Priority;
    const data = {
      monthlyBudget: Math.round(parseMoney(r["Budget"]) ?? 0),
      retainerProducts: str(r["Retainer Focused Products"]),
      affiliateProducts: str(r["Affliate products"] ?? r["Affiliate products"]),
      priority: ["HIGH", "MEDIUM", "LOW"].includes(priority) ? priority : "MEDIUM",
      clientNotes: str(r["Client notes"]),
      internalNotes: joinNotes([
        ["Deadlines", r["Deadline"]],
        ["Shabbir", r["Shabbir Comments"]],
        ["Comments", r["Comments"]],
      ]),
    };
    const existing = await tx.brand.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) await tx.brand.update({ where: { id: existing.id }, data });
    else {
      await tx.brand.create({ data: { name, ...data } });
      stats.brands++;
    }
  }
}

async function brandFor(tx: Tx, raw: string, fallbackBudget: unknown) {
  const brands = await tx.brand.findMany({ select: { id: true, name: true, monthlyBudget: true } });
  const found = findBrand(brands, raw);
  if (found) {
    const budget = Math.round(parseMoney(fallbackBudget) ?? 0);
    const current = brands.find((b) => b.id === found.id)!;
    if (current.monthlyBudget === 0 && budget > 0) await tx.brand.update({ where: { id: found.id }, data: { monthlyBudget: budget } });
    return found;
  }
  stats.brands++;
  warnings.push(`Brand "${raw}" was not in the brands tab, created it`);
  return tx.brand.create({ data: { name: raw.trim(), monthlyBudget: Math.round(parseMoney(fallbackBudget) ?? 0) } });
}

async function creatorFor(tx: Tx, handle: string, extra: { contact?: string | null; payoutDetails?: string | null; followers?: string | null; gmvNote?: string | null }) {
  const existing = await tx.creator.findUnique({ where: { handle } });
  const fill = {
    contact: existing?.contact ?? extra.contact ?? null,
    payoutDetails: existing?.payoutDetails ?? extra.payoutDetails ?? null,
    followers: extra.followers ?? existing?.followers ?? null,
    gmvNote: extra.gmvNote ?? existing?.gmvNote ?? null,
  };
  const payoutMethod = existing?.payoutMethod ?? guessPayoutMethod(fill.payoutDetails);
  if (existing) return tx.creator.update({ where: { id: existing.id }, data: { ...fill, payoutMethod } });
  stats.creators++;
  return tx.creator.create({ data: { handle, ...fill, payoutMethod } });
}

async function createRetainer(
  tx: Tx,
  data: { brandId: string; creatorId: string; flatFee: number; videosRequired: number; stage: Stage; upfront: PaymentStatus; startDate?: Date | null } & Partial<Omit<Prisma.RetainerUncheckedCreateInput, "startDate">>,
) {
  const { upfront: upfrontStatus, startDate, ...rest } = data;
  const { upfront, final } = splitFee(rest.flatFee, rest.upfrontPercent ?? 50);
  stats.retainers++;
  return tx.retainer.create({
    data: {
      ...rest,
      sampleStatus: rest.sampleStatus ?? sampleFor(rest.stage),
      startDate: startDate ?? new Date(),
      payments: {
        create: [
          ...(upfront > 0 ? [{ kind: "UPFRONT" as const, amount: upfront, status: upfrontStatus }] : []),
          ...(final > 0 ? [{ kind: "FINAL" as const, amount: final }] : []),
        ],
      },
    },
  });
}

async function importCreators(tx: Tx, rows: Row[]) {
  for (const r of rows) {
    const brandRaw = str(r["Brand"]);
    const creatorRaw = str(r["Creator"]);
    if (!brandRaw || !creatorRaw) continue; // goal / note rows like "Need 1 more creator"
    const handle = parseHandle(creatorRaw);
    if (!handle) {
      warnings.push(`Skipped creator "${creatorRaw}" (no handle found)`);
      continue;
    }
    const brand = await brandFor(tx, brandRaw, r["Brand Budget"]);
    const payoutDetails = str(r["Paypal Details"]);
    const creator = await creatorFor(tx, handle, { contact: str(r["Contact details"]), payoutDetails, gmvNote: gmvFrom(creatorRaw) });

    const creatorStatus = str(r["Creator Status"]) ?? "";
    const stage = mapStage(creatorStatus, str(r["Client Status"]) ?? "", str(r["Collab status"]) ?? "");
    const notes = joinNotes([
      ["Maryam", r["Maryam Notes"]],
      ["Ahmed", r["Ahmed's Notes"]],
      ["Note", r["col16"]],
      ["Fatima", r["Fatima's Notes"]],
      ["Replacement", r["Replacement"]],
      ["Old status", creatorStatus],
    ]);
    const upfrontRaw = (str(r["Upfront status"]) ?? "").toLowerCase();
    const upfront: PaymentStatus =
      upfrontRaw === "done" ? "PAID" : /shared with client|payment details shared/i.test(notes ?? "") ? "DETAILS_SHARED" : "PENDING";
    const budgetRaw = str(r["Budget"]) ?? "";
    const aff = budgetRaw.match(/(\d+(?:\.\d+)?)\s*%\s*aff/i);

    const existing = await tx.retainer.findFirst({ where: { brandId: brand.id, creatorId: creator.id } });
    if (existing) continue;
    await createRetainer(tx, {
      brandId: brand.id,
      creatorId: creator.id,
      flatFee: Math.round(parseMoney(r["Budget"]) ?? 0),
      videosRequired: parseCount(r["Number of Videos"]) ?? 0,
      stage,
      upfront,
      affiliateCommissionPct: aff ? Number(aff[1]) : null,
      angles: str(r["Angles"]),
      notes,
      sampleStatus: /being shipped/i.test(creatorStatus) ? "SHIPPED" : undefined,
    });
  }
}

async function importVideoTab(tx: Tx, title: string, rows: Row[]) {
  const brands = await tx.brand.findMany({ select: { id: true, name: true } });
  const brand = findBrand(brands, title);
  if (!brand) {
    warnings.push(`Tab "${title}": no matching brand, skipped`);
    return;
  }
  let retainerId: string | null = null;
  let label = "";
  for (const r of rows) {
    const name = str(r["Name"]);
    if (name) {
      const lines = name.split(/\n/).map((l) => l.trim());
      const handle = parseHandle(lines[0]);
      if (!handle) {
        warnings.push(`Tab "${title}": could not read creator "${lines[0]}"`);
        retainerId = null;
        continue;
      }
      label = handle;
      const followers = lines.find((l) => /^followers/i.test(l))?.replace(/^followers\s*:?\s*/i, "") ?? null;
      const creator = await creatorFor(tx, handle, {
        payoutDetails: str(r["PayPal/Bank Details"]),
        followers,
        gmvNote: gmvFrom(name),
      });
      const deal = parseDeal(r["Amount"]);
      const contract = str(r["Contract"]);
      const startDate = parseDate(r["Date"]);
      const existing = await tx.retainer.findFirst({ where: { brandId: brand.id, creatorId: creator.id } });
      if (existing) {
        await tx.retainer.update({
          where: { id: existing.id },
          data: {
            flatFee: existing.flatFee || Math.round(deal.fee ?? 0),
            videosRequired: existing.videosRequired || (deal.videos ?? 0),
            contractUrl: existing.contractUrl ?? (contract?.startsWith("http") ? contract : null),
            startDate: startDate ?? undefined,
          },
        });
        retainerId = existing.id;
      } else {
        warnings.push(`Tab "${title}": @${handle} is not in the creators tab for ${brand.name}, created a "Posting" retainer`);
        const created = await createRetainer(tx, {
          brandId: brand.id,
          creatorId: creator.id,
          flatFee: Math.round(deal.fee ?? 0),
          videosRequired: deal.videos ?? 0,
          stage: "POSTING",
          upfront: "PENDING",
          startDate,
          contractUrl: contract?.startsWith("http") ? contract : null,
          notes: contract && !contract.startsWith("http") ? `Contract file: ${contract}` : null,
        });
        retainerId = created.id;
      }
    }
    const url = str(r["Video link"]);
    const code = str(r["Adcode"]);
    if (!url) {
      if (code) warnings.push(`Tab "${title}": Spark code without a video link for @${label}, skipped`);
      continue;
    }
    if (!retainerId) continue;
    const existingVideo = await tx.video.findUnique({ where: { retainerId_url: { retainerId, url } } });
    if (existingVideo) {
      if (!existingVideo.sparkCode && code) await tx.video.update({ where: { id: existingVideo.id }, data: { sparkCode: code } });
      continue;
    }
    await tx.video.create({ data: { retainerId, url, sparkCode: code } });
    stats.videos++;
  }
}

async function main() {
  if (!file) throw new Error("Usage: npm run import:sheet -- <file.xlsx> [--dry-run]");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const tabs = wb.worksheets.map((ws) => ({ ws, headers: readRows(ws).headers }));
  const brandsTab = tabs.find((t) => t.headers.includes("Retainer Focused Products"));
  const creatorsTab = tabs.find((t) => t.headers.includes("Creator Status"));
  const videoTabs = tabs.filter((t) => t.headers.includes("Video link") && t.headers.includes("Name"));
  console.log(`Brands tab: ${brandsTab?.ws.name ?? "not found"} · Creators tab: ${creatorsTab?.ws.name ?? "not found"} · Video tabs: ${videoTabs.map((t) => t.ws.name).join(", ") || "none"}`);

  await db
    .$transaction(
      async (tx) => {
        if (brandsTab) await importBrands(tx, readRows(brandsTab.ws).rows);
        if (creatorsTab) await importCreators(tx, readRows(creatorsTab.ws).rows);
        for (const t of videoTabs) await importVideoTab(tx, t.ws.name, readRows(t.ws).rows);
        if (dryRun) throw new DryRun();
      },
      { timeout: 120_000 },
    )
    .catch((e) => {
      if (!(e instanceof DryRun)) throw e;
    });

  console.log(`${dryRun ? "[dry run, nothing saved] " : ""}New brands: ${stats.brands}, creators: ${stats.creators}, retainers: ${stats.retainers}, videos: ${stats.videos}`);
  if (warnings.length) console.log(`\nCheck these (${warnings.length}):\n- ${warnings.join("\n- ")}`);
}

class DryRun extends Error {}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
