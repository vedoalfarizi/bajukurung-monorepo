import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateOrderIntentLink } from "./index";
import type { CartItem } from "../../../shared/types";

const sampleCart: CartItem[] = [
  {
    productId: "p1",
    productName: "Baju Kurung Raya",
    size: "M",
    quantity: 2,
    unitPriceIDR: 350000,
    preOrderWindowEnd: "2025-12-31",
  },
  {
    productId: "p2",
    productName: "Baju Kurung Kasual",
    size: "L",
    quantity: 1,
    unitPriceIDR: 280000,
    preOrderWindowEnd: "2025-12-31",
  },
];

describe("generateOrderIntentLink", () => {
  it("returns a wa.me URL", () => {
    const url = generateOrderIntentLink(sampleCart, "Siti", "ORD-001", "60123456789");
    expect(url).toMatch(/^https:\/\/wa\.me\/60123456789\?text=/);
  });

  it("URL-encodes the message body", () => {
    const url = generateOrderIntentLink(sampleCart, "Siti", "ORD-001", "60123456789");
    const text = new URL(url).searchParams.get("text");
    expect(text).not.toBeNull();
    // decoded message should contain customer name
    expect(text).toContain("Siti");
  });

  it("decoded message contains order ID", () => {
    const url = generateOrderIntentLink(sampleCart, "Budi", "ORD-999", "628111");
    const text = new URL(url).searchParams.get("text")!;
    expect(text).toContain("ORD-999");
  });

  it("decoded message contains each product name and size", () => {
    const url = generateOrderIntentLink(sampleCart, "Ani", "ORD-002", "628111");
    const text = new URL(url).searchParams.get("text")!;
    expect(text).toContain("Baju Kurung Raya");
    expect(text).toContain("Ukuran M");
    expect(text).toContain("Baju Kurung Kasual");
    expect(text).toContain("Ukuran L");
  });

  it("calculates correct line totals and subtotal", () => {
    const url = generateOrderIntentLink(sampleCart, "Ani", "ORD-002", "628111");
    const text = new URL(url).searchParams.get("text")!;
    // line total: 2 × 350000 = 700000
    expect(text).toContain("700.000");
    // line total: 1 × 280000 = 280000
    expect(text).toContain("280.000");
    // subtotal: 980000
    expect(text).toContain("980.000");
  });

  it("message is in Bahasa Indonesia", () => {
    const url = generateOrderIntentLink(sampleCart, "Ani", "ORD-002", "628111");
    const text = new URL(url).searchParams.get("text")!;
    expect(text).toContain("Halo");
    expect(text).toContain("ingin memesan");
    expect(text).toContain("No. Pesanan");
    expect(text).toContain("Total");
    expect(text).toContain("Mohon konfirmasi");
    expect(text).toContain("Terima kasih");
  });

  it("uses the seller phone number in the URL", () => {
    const url = generateOrderIntentLink(sampleCart, "Ani", "ORD-002", "6281234567890");
    expect(url).toContain("wa.me/6281234567890");
  });

  /**
   * **Validates: Requirements 4.5, 4.6**
   * Property: for any non-empty cart, the generated URL always starts with the correct wa.me base
   * and the decoded text always contains the customer name, order ID, and closing phrase.
   */
  it("property: URL structure and message content hold for arbitrary inputs", () => {
    // Constrain sellerPhone to digits only (valid phone number characters)
    const phoneArb = fc.stringMatching(/^\d{5,15}$/);
    // Constrain customerName and orderId to printable ASCII without URL-breaking chars
    const safeStringArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
      (s) => s.trim().length > 0 && !s.includes("\0")
    );

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            productId: fc.uuid(),
            productName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
            size: fc.constantFrom("XS", "S", "M", "L", "XL", "XXL", "AllSize" as const),
            quantity: fc.integer({ min: 1, max: 99 }),
            unitPriceIDR: fc.integer({ min: 1000, max: 10_000_000 }),
            preOrderWindowEnd: fc.constant("2025-12-31"),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        safeStringArb,
        safeStringArb,
        phoneArb,
        (cart, customerName, orderId, sellerPhone) => {
          const url = generateOrderIntentLink(cart as CartItem[], customerName, orderId, sellerPhone);
          expect(url.startsWith(`https://wa.me/${sellerPhone}?text=`)).toBe(true);
          const rawText = url.slice(`https://wa.me/${sellerPhone}?text=`.length);
          const text = decodeURIComponent(rawText);
          expect(text).toContain(customerName);
          expect(text).toContain(orderId);
          expect(text).toContain("Terima kasih");
        }
      ),
      { numRuns: 100 }
    );
  });
});
