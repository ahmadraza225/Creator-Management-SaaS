import type { Prisma } from "@prisma/client";

export const retainerWithAll = {
  brand: true,
  creator: true,
  videos: { orderBy: [{ postedOn: "asc" }, { createdAt: "asc" }] },
  payments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.RetainerInclude;

export type RetainerWithAll = Prisma.RetainerGetPayload<{ include: typeof retainerWithAll }>;
