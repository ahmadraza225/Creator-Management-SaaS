-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('PROSPECT', 'CLIENT_REVIEW', 'APPROVED', 'CONTRACT_SENT', 'CONTRACT_SIGNED', 'SAMPLE_SHIPPED', 'POSTING', 'COMPLETED', 'STOPPED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('NOT_SENT', 'SHIPPED', 'DELIVERED', 'NOT_NEEDED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('UPFRONT', 'FINAL', 'BONUS', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'DETAILS_SHARED', 'ON_HOLD', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PAYPAL', 'ZELLE', 'VENMO', 'BANK', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyBudget" INTEGER NOT NULL DEFAULT 0,
    "retainerProducts" TEXT,
    "affiliateProducts" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "clientNotes" TEXT,
    "internalNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "eukaBrandId" TEXT,
    "reacherShopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "contact" TEXT,
    "payoutMethod" "PaymentMethod",
    "payoutDetails" TEXT,
    "followers" TEXT,
    "gmvNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retainer" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "flatFee" INTEGER NOT NULL DEFAULT 0,
    "videosRequired" INTEGER NOT NULL DEFAULT 0,
    "upfrontPercent" INTEGER NOT NULL DEFAULT 50,
    "affiliateCommissionPct" DOUBLE PRECISION,
    "adsCommissionPct" DOUBLE PRECISION,
    "stage" "Stage" NOT NULL DEFAULT 'PROSPECT',
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleStatus" "SampleStatus" NOT NULL DEFAULT 'NOT_SENT',
    "angles" TEXT,
    "contractUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sparkCode" TEXT,
    "postedOn" TIMESTAMP(3),
    "angle" TEXT,
    "views" INTEGER,
    "gmv" DOUBLE PRECISION,
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "retainerId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod",
    "reference" TEXT,
    "proofUrl" TEXT,
    "paidOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");

-- CreateIndex
CREATE INDEX "Retainer_brandId_idx" ON "Retainer"("brandId");

-- CreateIndex
CREATE INDEX "Retainer_creatorId_idx" ON "Retainer"("creatorId");

-- CreateIndex
CREATE INDEX "Retainer_stage_idx" ON "Retainer"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "Video_retainerId_url_key" ON "Video"("retainerId", "url");

-- CreateIndex
CREATE INDEX "Payment_retainerId_idx" ON "Payment"("retainerId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "Retainer" ADD CONSTRAINT "Retainer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retainer" ADD CONSTRAINT "Retainer_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "Retainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_retainerId_fkey" FOREIGN KEY ("retainerId") REFERENCES "Retainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
