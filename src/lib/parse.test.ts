import { describe, expect, it } from "vitest";
import { guessPayoutMethod, parseDeal, parseHandle, parseMoney, parseVideoLines } from "./parse";

describe("parseHandle", () => {
  it("handles the formats used in the tracker", () => {
    expect(parseHandle("shopcreator (GMV $7.27K)")).toBe("shopcreator");
    expect(parseHandle("somecreator - GMV $51K")).toBe("somecreator");
    expect(parseHandle("@Cat.Lover")).toBe("cat.lover");
    expect(parseHandle("https://www.tiktok.com/@juicefan")).toBe("juicefan");
    expect(parseHandle("   ")).toBeNull();
  });
});

describe("money and deals", () => {
  it("reads numbers out of free text", () => {
    expect(parseMoney("$1,000 - $1200")).toBe(1000);
    expect(parseMoney("2000\n20% aff")).toBe(2000);
    expect(parseMoney(null)).toBeNull();
    expect(parseDeal("$450 for 20 videos")).toEqual({ fee: 450, videos: 20 });
  });
});

describe("parseVideoLines", () => {
  it("reads url + optional spark code per line and drops duplicates", () => {
    const text = "https://www.tiktok.com/t/A/ #codeA\nhttps://www.tiktok.com/t/B/ https://other.link\n\nhttps://www.tiktok.com/t/A/ #again\nnot a link";
    expect(parseVideoLines(text)).toEqual([
      { url: "https://www.tiktok.com/t/A/", sparkCode: "#codeA" },
      { url: "https://www.tiktok.com/t/B/", sparkCode: null },
    ]);
  });
});

describe("guessPayoutMethod", () => {
  it("recognises the common payout notes", () => {
    expect(guessPayoutMethod("5550100123 Zelle")).toBe("ZELLE");
    expect(guessPayoutMethod("someone@gmail.com")).toBe("PAYPAL");
    expect(guessPayoutMethod("https://venmo.com/u/x")).toBe("VENMO");
    expect(guessPayoutMethod(null)).toBeNull();
  });
});
