export type StandardSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "AllSize";

export type Occasion = "Raya" | "Wedding" | "Casual";

export type OrderStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "PACKAGED"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUND";

export interface SizeChart {
  [size: string]: { bust: string; waist: string; hip: string };
}

export interface Product {
  productId: string;
  name: string;
  occasion: Occasion;
  description: string;
  fabricType: string;
  colours: string[];
  availableSizes: StandardSize[];
  sizeChart: SizeChart;
  priceIDR: number;
  primaryImageKey: string;
  imageKeys: string[];
  preOrderWindowStart: string; // ISO date
  preOrderWindowEnd: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  productId: string;
  productName: string;
  size: StandardSize;
  quantity: number;
  unitPriceIDR: number;
}

export interface Order {
  orderId: string;
  customerName: string;
  customerWhatsApp: string;
  lineItems: LineItem[];
  totalPriceIDR: number;
  status: OrderStatus;
  trackingLink: string | null;
  proofOfPaymentKey: string | null;
  proofOfReceiptKey: string | null;
  refundAmountIDR: number | null;
  proofOfRefundKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  size: StandardSize;
  quantity: number;
  unitPriceIDR: number;
  preOrderWindowEnd: string; // ISO date — used to guard expired items
}

export interface Cart {
  items: CartItem[];
}
