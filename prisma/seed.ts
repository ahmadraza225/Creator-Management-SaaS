// Creates the first admin user. With --demo, also adds made-up sample data.
//   npm run db:seed
//   npm run db:seed -- --demo
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { splitFee } from "../src/lib/domain";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first");
  if (password === "change-me" || password.length < 8) throw new Error("Pick a real ADMIN_PASSWORD (8+ characters)");

  await db.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 10) },
    create: { email, name: email.split("@")[0], passwordHash: await bcrypt.hash(password, 10), role: "ADMIN" },
  });
  console.log(`Admin user ready: ${email}`);

  if (process.argv.includes("--demo")) await demo();
}

async function demo() {
  const day = 86_400_000;
  const now = Date.now();
  const brand = await db.brand.upsert({
    where: { name: "Demo Saffron Co" },
    update: {},
    create: { name: "Demo Saffron Co", monthlyBudget: 2000, priority: "HIGH", retainerProducts: "2g saffron threads" },
  });
  const deals = [
    { handle: "demo_creator_one", fee: 450, videos: 20, stage: "POSTING" as const, posted: 6, paidUpfront: true },
    { handle: "demo_creator_two", fee: 600, videos: 20, stage: "CONTRACT_SIGNED" as const, posted: 0, paidUpfront: false },
    { handle: "demo_creator_three", fee: 300, videos: 10, stage: "CLIENT_REVIEW" as const, posted: 0, paidUpfront: false },
  ];
  for (const d of deals) {
    const creator = await db.creator.upsert({
      where: { handle: d.handle },
      update: {},
      create: { handle: d.handle, payoutMethod: "PAYPAL", payoutDetails: `${d.handle}@example.com` },
    });
    if (await db.retainer.findFirst({ where: { brandId: brand.id, creatorId: creator.id } })) continue;
    const { upfront, final } = splitFee(d.fee, 50);
    await db.retainer.create({
      data: {
        brandId: brand.id,
        creatorId: creator.id,
        flatFee: d.fee,
        videosRequired: d.videos,
        stage: d.stage,
        stageChangedAt: new Date(now - 5 * day),
        sampleStatus: d.stage === "POSTING" ? "DELIVERED" : "NOT_SENT",
        startDate: new Date(now - 14 * day),
        dueDate: new Date(now + 16 * day),
        affiliateCommissionPct: 15,
        adsCommissionPct: 10,
        payments: {
          create: [
            { kind: "UPFRONT", amount: upfront, status: d.paidUpfront ? "PAID" : "PENDING", method: d.paidUpfront ? "PAYPAL" : null, paidOn: d.paidUpfront ? new Date(now - 10 * day) : null },
            { kind: "FINAL", amount: final },
          ],
        },
        videos: {
          create: Array.from({ length: d.posted }, (_, i) => ({
            url: `https://www.tiktok.com/@${d.handle}/video/${1000 + i}`,
            sparkCode: i % 3 === 2 ? null : `#DEMO-CODE-${i}`,
            angle: i % 2 ? "Visual hook" : "Before you try X",
            views: 1000 * (i + 1),
            gmv: 25 * (i + 1),
            postedOn: new Date(now - (12 - i) * day),
          })),
        },
      },
    });
  }
  console.log("Demo data added");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
