import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./index";
import type { CartItem, StandardSize } from "../../../shared/types";

// Reset store state between tests
beforeEach(() => {
  useCartStore.setState({ items: [], subtotal: 0 });
});

const availableSizes: StandardSize[] = ["S", "M", "L"];

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod-1",
    productName: "Baju Kurung Raya",
    size: "M",
    quantity: 1,
    unitPriceIDR: 450000,
    preOrderWindowEnd: "2099-12-31", // far future — always open
    ...overrides,
  };
}

describe("cartStore — addItem", () => {
  it("adds a valid item to the cart", () => {
    const result = useCartStore.getState().addItem(makeItem(), availableSizes);
    expect(result.success).toBe(true);
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("accumulates quantity when same product+size added again", () => {
    useCartStore.getState().addItem(makeItem({ quantity: 1 }), availableSizes);
    useCartStore.getState().addItem(makeItem({ quantity: 2 }), availableSizes);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it("treats same product with different size as separate line items", () => {
    useCartStore.getState().addItem(makeItem({ size: "S" }), availableSizes);
    useCartStore.getState().addItem(makeItem({ size: "M" }), availableSizes);
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it("rejects add when preOrderWindowEnd is in the past", () => {
    const result = useCartStore
      .getState()
      .addItem(makeItem({ preOrderWindowEnd: "2000-01-01" }), availableSizes);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("rejects add when size is not in availableSizes", () => {
    const result = useCartStore
      .getState()
      .addItem(makeItem({ size: "XS" }), availableSizes); // XS not in ["S","M","L"]
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("rejects add when preOrderWindowEnd equals yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const result = useCartStore
      .getState()
      .addItem(makeItem({ preOrderWindowEnd: dateStr }), availableSizes);
    expect(result.success).toBe(false);
  });

  it("allows add when preOrderWindowEnd is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = useCartStore
      .getState()
      .addItem(makeItem({ preOrderWindowEnd: today }), availableSizes);
    expect(result.success).toBe(true);
  });
});

describe("cartStore — removeItem", () => {
  it("removes the matching item", () => {
    useCartStore.getState().addItem(makeItem(), availableSizes);
    useCartStore.getState().removeItem("prod-1", "M");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("only removes the matching size, leaving others intact", () => {
    useCartStore.getState().addItem(makeItem({ size: "S" }), availableSizes);
    useCartStore.getState().addItem(makeItem({ size: "M" }), availableSizes);
    useCartStore.getState().removeItem("prod-1", "S");
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].size).toBe("M");
  });

  it("is a no-op when item does not exist", () => {
    useCartStore.getState().addItem(makeItem(), availableSizes);
    useCartStore.getState().removeItem("nonexistent", "M");
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});

describe("cartStore — updateQuantity", () => {
  it("updates the quantity of an existing item", () => {
    useCartStore.getState().addItem(makeItem(), availableSizes);
    useCartStore.getState().updateQuantity("prod-1", "M", 5);
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("removes the item when quantity is set to 0", () => {
    useCartStore.getState().addItem(makeItem(), availableSizes);
    useCartStore.getState().updateQuantity("prod-1", "M", 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("removes the item when quantity is negative", () => {
    useCartStore.getState().addItem(makeItem(), availableSizes);
    useCartStore.getState().updateQuantity("prod-1", "M", -1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});

describe("cartStore — clearCart", () => {
  it("empties the cart", () => {
    useCartStore.getState().addItem(makeItem({ size: "S" }), availableSizes);
    useCartStore.getState().addItem(makeItem({ size: "M" }), availableSizes);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().subtotal).toBe(0);
  });
});

describe("cartStore — subtotal", () => {
  it("is 0 for an empty cart", () => {
    expect(useCartStore.getState().subtotal).toBe(0);
  });

  it("equals quantity × unitPriceIDR for a single item", () => {
    useCartStore.getState().addItem(makeItem({ quantity: 3, unitPriceIDR: 200000 }), availableSizes);
    expect(useCartStore.getState().subtotal).toBe(600000);
  });

  it("sums all line item totals", () => {
    useCartStore.getState().addItem(makeItem({ size: "S", quantity: 2, unitPriceIDR: 300000 }), availableSizes);
    useCartStore.getState().addItem(makeItem({ size: "M", quantity: 1, unitPriceIDR: 450000 }), availableSizes);
    // 2×300000 + 1×450000 = 1050000
    expect(useCartStore.getState().subtotal).toBe(1050000);
  });

  it("updates after removeItem", () => {
    useCartStore.getState().addItem(makeItem({ size: "S", quantity: 2, unitPriceIDR: 300000 }), availableSizes);
    useCartStore.getState().addItem(makeItem({ size: "M", quantity: 1, unitPriceIDR: 450000 }), availableSizes);
    useCartStore.getState().removeItem("prod-1", "S");
    expect(useCartStore.getState().subtotal).toBe(450000);
  });
});

describe("cartStore — canCheckout", () => {
  it("returns false when cart is empty", () => {
    expect(useCartStore.getState().canCheckout()).toBe(false);
  });

  it("returns true when cart has items", () => {
    useCartStore.getState().addItem(makeItem(), availableSizes);
    expect(useCartStore.getState().canCheckout()).toBe(true);
  });

  it("returns false after clearing the cart", () => {
    useCartStore.getState().addItem(makeItem(), availableSizes);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().canCheckout()).toBe(false);
  });
});
