import type { CartItem } from "../../../shared/types";

/**
 * Generates a WhatsApp deep link with a pre-filled order intent message in Bahasa Indonesia.
 */
export function generateOrderIntentLink(
  cart: CartItem[],
  customerName: string,
  orderId: string,
  sellerPhone: string
): string {
  const lines = cart.map((item, index) => {
    const lineTotal = item.quantity * item.unitPriceIDR;
    return `${index + 1}. ${item.productName} - Ukuran ${item.size} x${item.quantity} = Rp ${lineTotal.toLocaleString("id-ID")}`;
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceIDR,
    0
  );

  const message = [
    `Halo, saya ${customerName} ingin memesan:`,
    ``,
    `No. Pesanan: ${orderId}`,
    ``,
    ...lines,
    ``,
    `Total: Rp ${subtotal.toLocaleString("id-ID")}`,
    ``,
    `Mohon konfirmasi pesanan dan informasi pembayaran. Terima kasih!`,
  ].join("\n");

  return `https://wa.me/${sellerPhone}?text=${encodeURIComponent(message)}`;
}
