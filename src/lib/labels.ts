import type { PaymentKind, PaymentMethod, PaymentStatus, Priority, SampleStatus, Stage } from "@prisma/client";

export const STAGES: Stage[] = [
  "PROSPECT",
  "CLIENT_REVIEW",
  "APPROVED",
  "CONTRACT_SENT",
  "CONTRACT_SIGNED",
  "SAMPLE_SHIPPED",
  "POSTING",
  "COMPLETED",
  "STOPPED",
  "DECLINED",
];

export const STAGE_LABEL: Record<Stage, string> = {
  PROSPECT: "Shortlisted",
  CLIENT_REVIEW: "Client review",
  APPROVED: "Client approved",
  CONTRACT_SENT: "Contract sent",
  CONTRACT_SIGNED: "Contract signed",
  SAMPLE_SHIPPED: "Sample shipped",
  POSTING: "Posting",
  COMPLETED: "Completed",
  STOPPED: "Stopped",
  DECLINED: "Declined",
};

export const SAMPLE_LABEL: Record<SampleStatus, string> = {
  NOT_SENT: "Not sent",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  NOT_NEEDED: "Not needed",
};

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  UPFRONT: "Upfront",
  FINAL: "Final",
  BONUS: "Bonus",
  OTHER: "Other",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  DETAILS_SHARED: "Details shared with client",
  ON_HOLD: "On hold",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PAYPAL: "PayPal",
  ZELLE: "Zelle",
  VENMO: "Venmo",
  BANK: "Bank",
  OTHER: "Other",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};
