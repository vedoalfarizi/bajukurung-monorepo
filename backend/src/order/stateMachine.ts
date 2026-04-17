import type { OrderStatus } from "@baju-kurung/shared";

// Maps each valid (fromStatus → toStatus) pair to its required fields
const VALID_TRANSITIONS: Partial<Record<OrderStatus, Partial<Record<OrderStatus, string[]>>>> = {
  PENDING: {
    PAYMENT_PENDING: [],
    CANCELLED: [],
  },
  PAYMENT_PENDING: {
    PACKAGED: ["proofOfPaymentKey"],
    CANCELLED: [],
  },
  PACKAGED: {
    READY_TO_SHIP: [],
    REFUND: ["refundAmountIDR", "proofOfRefundKey"],
  },
  READY_TO_SHIP: {
    SHIPPED: ["trackingLink"],
  },
  SHIPPED: {
    DELIVERED: [],
    REFUND: ["refundAmountIDR", "proofOfRefundKey"],
  },
  DELIVERED: {
    REFUND: ["refundAmountIDR", "proofOfRefundKey"],
  },
  CANCELLED: {},
  REFUND: {},
};

export interface TransitionError {
  code: "INVALID_STATUS_TRANSITION" | "VALIDATION_ERROR";
  message: string;
}

/**
 * Validates an order status transition.
 * @returns null if valid, or a TransitionError describing the problem.
 */
export function validateTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
  fields: Record<string, unknown>
): TransitionError | null {
  const fromMap = VALID_TRANSITIONS[currentStatus];

  if (!fromMap || !(newStatus in fromMap)) {
    return {
      code: "INVALID_STATUS_TRANSITION",
      message: `Cannot transition from '${currentStatus}' to '${newStatus}'.`,
    };
  }

  const requiredFields = fromMap[newStatus]!;
  const missingFields = requiredFields.filter(
    (field) => fields[field] === undefined || fields[field] === null || fields[field] === ""
  );

  if (missingFields.length > 0) {
    return {
      code: "VALIDATION_ERROR",
      message: `Missing required fields for transition to '${newStatus}': ${missingFields.join(", ")}.`,
    };
  }

  return null;
}
