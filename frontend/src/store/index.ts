import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, StandardSize } from "../../../shared/types";

export interface AddItemResult {
  success: boolean;
  error?: string;
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  addItem: (item: CartItem, availableSizes: StandardSize[]) => AddItemResult;
  removeItem: (productId: string, size: StandardSize) => void;
  updateQuantity: (productId: string, size: StandardSize, quantity: number) => void;
  clearCart: () => void;
  canCheckout: () => boolean;
}

function computeSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPriceIDR, 0);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      subtotal: 0,

      addItem(item: CartItem, availableSizes: StandardSize[]): AddItemResult {
        // Guard: Pre-Order Window must still be open
        const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        if (item.preOrderWindowEnd < today) {
          return {
            success: false,
            error: "Periode pre-order untuk produk ini telah berakhir.",
          };
        }

        // Guard: size must be in the product's available sizes
        if (!availableSizes.includes(item.size)) {
          return {
            success: false,
            error: "Ukuran yang dipilih tidak tersedia untuk produk ini.",
          };
        }

        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.size === item.size
          );

          let updatedItems: CartItem[];
          if (existing) {
            updatedItems = state.items.map((i) =>
              i.productId === item.productId && i.size === item.size
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            );
          } else {
            updatedItems = [...state.items, item];
          }

          return { items: updatedItems, subtotal: computeSubtotal(updatedItems) };
        });

        return { success: true };
      },

      removeItem(productId: string, size: StandardSize): void {
        set((state) => {
          const updatedItems = state.items.filter(
            (i) => !(i.productId === productId && i.size === size)
          );
          return { items: updatedItems, subtotal: computeSubtotal(updatedItems) };
        });
      },

      updateQuantity(productId: string, size: StandardSize, quantity: number): void {
        if (quantity <= 0) {
          get().removeItem(productId, size);
          return;
        }
        set((state) => {
          const updatedItems = state.items.map((i) =>
            i.productId === productId && i.size === size ? { ...i, quantity } : i
          );
          return { items: updatedItems, subtotal: computeSubtotal(updatedItems) };
        });
      },

      clearCart(): void {
        set({ items: [], subtotal: 0 });
      },

      canCheckout(): boolean {
        return get().items.length > 0;
      },
    }),
    {
      name: "baju-kurung-cart",
    }
  )
);
