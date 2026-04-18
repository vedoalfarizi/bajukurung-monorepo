import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEvent } from "aws-lambda";

// ── Mock DynamoDB so tests don't hit AWS ──────────────────────────────────────
vi.mock("../shared/index", () => ({
  ddbClient: { send: vi.fn().mockResolvedValue({}) },
  TABLE_NAME: "baju-kurung-test",
  errorResponse: (statusCode: number, code: string, message: string) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: { code, message } }),
  }),
  successResponse: (statusCode: number, body: unknown) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  withErrorHandler: (fn: Function) => fn,
}));

// ── Mock S3 presigner so tests don't hit AWS ──────────────────────────────────
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.amazonaws.com/mock-presigned-url"),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));import { handler } from "./index";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: "POST",
    path: "/orders",
    body: null,
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: { requestId: "test-req-id" } as APIGatewayProxyEvent["requestContext"],
    resource: "",
    isBase64Encoded: false,
    ...overrides,
  };
}

const validLineItem = {
  productId: "prod-uuid-1",
  productName: "Baju Kurung Moden Raya",
  size: "M",
  quantity: 2,
  unitPriceIDR: 450000,
};

const validPayload = {
  customerName: "Siti Rahayu",
  customerWhatsApp: "+628123456789",
  lineItems: [validLineItem],
};

// ── POST /orders tests ────────────────────────────────────────────────────────

describe("POST /orders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 with orderId on valid payload", async () => {
    const event = makeEvent({ body: JSON.stringify(validPayload) });
    const res = await handler(event);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(typeof body.orderId).toBe("string");
    expect(body.orderId.length).toBeGreaterThan(0);
  });

  it("returns a unique orderId each call", async () => {
    const event = makeEvent({ body: JSON.stringify(validPayload) });
    const res1 = await handler(event);
    const res2 = await handler(event);
    expect(JSON.parse(res1.body).orderId).not.toBe(JSON.parse(res2.body).orderId);
  });

  it("returns 400 VALIDATION_ERROR for invalid JSON body", async () => {
    const event = makeEvent({ body: "not-json" });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when customerName is missing", async () => {
    const { customerName: _n, ...rest } = validPayload;
    const event = makeEvent({ body: JSON.stringify(rest) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when customerName is empty string", async () => {
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, customerName: "   " }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when customerWhatsApp is missing", async () => {
    const { customerWhatsApp: _w, ...rest } = validPayload;
    const event = makeEvent({ body: JSON.stringify(rest) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when customerWhatsApp is empty string", async () => {
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, customerWhatsApp: "" }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when lineItems is missing", async () => {
    const { lineItems: _l, ...rest } = validPayload;
    const event = makeEvent({ body: JSON.stringify(rest) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when lineItems is empty array", async () => {
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, lineItems: [] }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when a lineItem is missing productId", async () => {
    const { productId: _p, ...itemWithout } = validLineItem;
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, lineItems: [itemWithout] }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when a lineItem is missing productName", async () => {
    const { productName: _p, ...itemWithout } = validLineItem;
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, lineItems: [itemWithout] }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when a lineItem has invalid size", async () => {
    const event = makeEvent({
      body: JSON.stringify({ ...validPayload, lineItems: [{ ...validLineItem, size: "XXXL" }] }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when quantity is zero", async () => {
    const event = makeEvent({
      body: JSON.stringify({ ...validPayload, lineItems: [{ ...validLineItem, quantity: 0 }] }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when quantity is negative", async () => {
    const event = makeEvent({
      body: JSON.stringify({ ...validPayload, lineItems: [{ ...validLineItem, quantity: -1 }] }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when quantity is a float", async () => {
    const event = makeEvent({
      body: JSON.stringify({ ...validPayload, lineItems: [{ ...validLineItem, quantity: 1.5 }] }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when unitPriceIDR is zero", async () => {
    const event = makeEvent({
      body: JSON.stringify({ ...validPayload, lineItems: [{ ...validLineItem, unitPriceIDR: 0 }] }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when unitPriceIDR is negative", async () => {
    const event = makeEvent({
      body: JSON.stringify({ ...validPayload, lineItems: [{ ...validLineItem, unitPriceIDR: -500 }] }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts all valid StandardSize values", async () => {
    const sizes = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];
    for (const size of sizes) {
      const event = makeEvent({
        body: JSON.stringify({ ...validPayload, lineItems: [{ ...validLineItem, size }] }),
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(201);
    }
  });

  it("calculates totalPriceIDR correctly for multiple line items", async () => {
    const { ddbClient } = await import("../shared/index");
    const lineItems = [
      { ...validLineItem, quantity: 2, unitPriceIDR: 450000 },
      { ...validLineItem, productId: "prod-2", size: "L", quantity: 1, unitPriceIDR: 500000 },
    ];
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, lineItems }) });
    await handler(event);

    const putCall = vi.mocked(ddbClient.send).mock.calls[0][0] as { input: { Item: Record<string, unknown> } };
    expect(putCall.input.Item.totalPriceIDR).toBe(2 * 450000 + 1 * 500000);
  });

  it("stores order with PENDING status in DynamoDB", async () => {
    const { ddbClient } = await import("../shared/index");
    const event = makeEvent({ body: JSON.stringify(validPayload) });
    await handler(event);

    const putCall = vi.mocked(ddbClient.send).mock.calls[0][0] as { input: { Item: Record<string, unknown> } };
    expect(putCall.input.Item.status).toBe("PENDING");
  });

  it("stores PK as ORDER#<orderId> and SK as METADATA", async () => {
    const { ddbClient } = await import("../shared/index");
    const event = makeEvent({ body: JSON.stringify(validPayload) });
    const res = await handler(event);
    const { orderId } = JSON.parse(res.body);

    const putCall = vi.mocked(ddbClient.send).mock.calls[0][0] as { input: { Item: Record<string, unknown> } };
    expect(putCall.input.Item.PK).toBe(`ORDER#${orderId}`);
    expect(putCall.input.Item.SK).toBe("METADATA");
  });

  it("stores customerWhatsApp with the order", async () => {
    const { ddbClient } = await import("../shared/index");
    const event = makeEvent({ body: JSON.stringify(validPayload) });
    await handler(event);

    const putCall = vi.mocked(ddbClient.send).mock.calls[0][0] as { input: { Item: Record<string, unknown> } };
    expect(putCall.input.Item.customerWhatsApp).toBe(validPayload.customerWhatsApp);
  });

  it("returns 404 for unknown routes", async () => {
    const event = makeEvent({ httpMethod: "DELETE", path: "/orders" });
    const res = await handler(event);
    expect(res.statusCode).toBe(404);
  });
});

// ── GET /orders tests ─────────────────────────────────────────────────────────

describe("GET /orders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with orders array using GSI2 when no status filter", async () => {
    const { ddbClient } = await import("../shared/index");
    const mockOrders = [
      { orderId: "order-1", status: "PENDING", entityType: "ORDER", createdAt: "2025-01-01T00:00:00Z" },
      { orderId: "order-2", status: "SHIPPED", entityType: "ORDER", createdAt: "2025-01-02T00:00:00Z" },
    ];
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Items: mockOrders } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/orders", queryStringParameters: null });
    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders).toHaveLength(2);
  });

  it("queries GSI2 with entityType=ORDER when no status filter", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Items: [] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/orders", queryStringParameters: null });
    await handler(event);

    const queryCall = vi.mocked(ddbClient.send).mock.calls[0][0] as {
      input: { IndexName: string; ExpressionAttributeValues: Record<string, unknown> };
    };
    expect(queryCall.input.IndexName).toBe("GSI2");
    expect(queryCall.input.ExpressionAttributeValues[":entityType"]).toBe("ORDER");
  });

  it("returns 200 with filtered orders using GSI3 when status filter provided", async () => {
    const { ddbClient } = await import("../shared/index");
    const mockOrders = [
      { orderId: "order-1", status: "PENDING", entityType: "ORDER", createdAt: "2025-01-01T00:00:00Z" },
    ];
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Items: mockOrders } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders",
      queryStringParameters: { status: "PENDING" },
    });
    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].status).toBe("PENDING");
  });

  it("queries GSI3 with the provided status when status filter is given", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Items: [] } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders",
      queryStringParameters: { status: "SHIPPED" },
    });
    await handler(event);

    const queryCall = vi.mocked(ddbClient.send).mock.calls[0][0] as {
      input: { IndexName: string; ExpressionAttributeValues: Record<string, unknown> };
    };
    expect(queryCall.input.IndexName).toBe("GSI3");
    expect(queryCall.input.ExpressionAttributeValues[":status"]).toBe("SHIPPED");
  });

  it("returns 400 VALIDATION_ERROR for invalid status filter", async () => {
    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders",
      queryStringParameters: { status: "INVALID_STATUS" },
    });
    const res = await handler(event);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns empty orders array when no orders exist", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Items: [] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/orders", queryStringParameters: null });
    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).orders).toEqual([]);
  });

  it("accepts all valid OrderStatus values as filter", async () => {
    const { ddbClient } = await import("../shared/index");
    const statuses = ["PENDING", "PAYMENT_PENDING", "PACKAGED", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED", "REFUND"];

    for (const status of statuses) {
      vi.mocked(ddbClient.send).mockResolvedValueOnce({ Items: [] } as never);
      const event = makeEvent({
        httpMethod: "GET",
        path: "/orders",
        queryStringParameters: { status },
      });
      const res = await handler(event);
      expect(res.statusCode).toBe(200);
    }
  });
});

// ── GET /orders/{orderId} tests ───────────────────────────────────────────────

describe("GET /orders/{orderId}", () => {
  beforeEach(() => vi.clearAllMocks());

  const mockOrder = {
    PK: "ORDER#order-abc",
    SK: "METADATA",
    entityType: "ORDER",
    orderId: "order-abc",
    customerName: "Siti Rahayu",
    customerWhatsApp: "+628123456789",
    lineItems: [{ productId: "prod-1", productName: "Baju Kurung Moden Raya", size: "M", quantity: 1, unitPriceIDR: 450000 }],
    totalPriceIDR: 450000,
    status: "PENDING",
    trackingLink: null,
    proofOfPaymentKey: null,
    proofOfReceiptKey: null,
    refundAmountIDR: null,
    proofOfRefundKey: null,
    createdAt: "2025-02-15T10:30:00Z",
    updatedAt: "2025-02-15T10:30:00Z",
  };

  it("returns 200 with full order detail when order exists", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: mockOrder } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders/order-abc",
      pathParameters: { orderId: "order-abc" },
    });
    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.order.orderId).toBe("order-abc");
  });

  it("returns all required order fields in the response", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: mockOrder } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders/order-abc",
      pathParameters: { orderId: "order-abc" },
    });
    const res = await handler(event);
    const { order } = JSON.parse(res.body);

    expect(order.orderId).toBe("order-abc");
    expect(order.status).toBe("PENDING");
    expect(order.customerName).toBe("Siti Rahayu");
    expect(order.customerWhatsApp).toBe("+628123456789");
    expect(Array.isArray(order.lineItems)).toBe(true);
    expect(order.lineItems).toHaveLength(1);
    expect(order.totalPriceIDR).toBe(450000);
    expect(order.createdAt).toBe("2025-02-15T10:30:00Z");
    expect(order.trackingLink).toBeNull();
  });

  it("fetches by PK ORDER#<orderId> and SK METADATA", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: mockOrder } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders/order-abc",
      pathParameters: { orderId: "order-abc" },
    });
    await handler(event);

    const getCall = vi.mocked(ddbClient.send).mock.calls[0][0] as {
      input: { Key: Record<string, string> };
    };
    expect(getCall.input.Key.PK).toBe("ORDER#order-abc");
    expect(getCall.input.Key.SK).toBe("METADATA");
  });

  it("returns 404 ORDER_NOT_FOUND when order does not exist", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: undefined } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders/nonexistent",
      pathParameters: { orderId: "nonexistent" },
    });
    const res = await handler(event);

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe("ORDER_NOT_FOUND");
  });

  it("returns order with trackingLink when present", async () => {
    const { ddbClient } = await import("../shared/index");
    const shippedOrder = { ...mockOrder, status: "SHIPPED", trackingLink: "https://track.example.com/123" };
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: shippedOrder } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders/order-abc",
      pathParameters: { orderId: "order-abc" },
    });
    const res = await handler(event);
    const { order } = JSON.parse(res.body);

    expect(order.trackingLink).toBe("https://track.example.com/123");
  });

  it("returns order with refund fields when present", async () => {
    const { ddbClient } = await import("../shared/index");
    const refundOrder = { ...mockOrder, status: "REFUND", refundAmountIDR: 450000, proofOfRefundKey: "proofs/refund.jpg" };
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: refundOrder } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/orders/order-abc",
      pathParameters: { orderId: "order-abc" },
    });
    const res = await handler(event);
    const { order } = JSON.parse(res.body);

    expect(order.refundAmountIDR).toBe(450000);
    expect(order.proofOfRefundKey).toBe("proofs/refund.jpg");
  });
});

// ── validateTransition (state machine) tests ─────────────────────────────────

import { validateTransition } from "./stateMachine";

describe("validateTransition", () => {
  // ── Valid transitions ───────────────────────────────────────────────────────

  it("PENDING → PAYMENT_PENDING is valid (no required fields)", () => {
    expect(validateTransition("PENDING", "PAYMENT_PENDING", {})).toBeNull();
  });

  it("PENDING → CANCELLED is valid", () => {
    expect(validateTransition("PENDING", "CANCELLED", {})).toBeNull();
  });

  it("PAYMENT_PENDING → PACKAGED is valid with proofOfPaymentKey", () => {
    expect(validateTransition("PAYMENT_PENDING", "PACKAGED", { proofOfPaymentKey: "proofs/pay.jpg" })).toBeNull();
  });

  it("PAYMENT_PENDING → CANCELLED is valid", () => {
    expect(validateTransition("PAYMENT_PENDING", "CANCELLED", {})).toBeNull();
  });

  it("PACKAGED → READY_TO_SHIP is valid (no required fields)", () => {
    expect(validateTransition("PACKAGED", "READY_TO_SHIP", {})).toBeNull();
  });

  it("PACKAGED → REFUND is valid with required fields", () => {
    expect(
      validateTransition("PACKAGED", "REFUND", { refundAmountIDR: 450000, proofOfRefundKey: "proofs/refund.jpg" })
    ).toBeNull();
  });

  it("READY_TO_SHIP → SHIPPED is valid with trackingLink", () => {
    expect(validateTransition("READY_TO_SHIP", "SHIPPED", { trackingLink: "https://track.example.com/123" })).toBeNull();
  });

  it("SHIPPED → DELIVERED is valid (no required fields)", () => {
    expect(validateTransition("SHIPPED", "DELIVERED", {})).toBeNull();
  });

  it("SHIPPED → DELIVERED is valid with optional proofOfReceiptKey", () => {
    expect(validateTransition("SHIPPED", "DELIVERED", { proofOfReceiptKey: "proofs/receipt.jpg" })).toBeNull();
  });

  it("SHIPPED → REFUND is valid with required fields", () => {
    expect(
      validateTransition("SHIPPED", "REFUND", { refundAmountIDR: 450000, proofOfRefundKey: "proofs/refund.jpg" })
    ).toBeNull();
  });

  it("DELIVERED → REFUND is valid with required fields", () => {
    expect(
      validateTransition("DELIVERED", "REFUND", { refundAmountIDR: 450000, proofOfRefundKey: "proofs/refund.jpg" })
    ).toBeNull();
  });

  // ── Invalid transitions → INVALID_STATUS_TRANSITION ────────────────────────

  it("PENDING → SHIPPED returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("PENDING", "SHIPPED", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("PENDING → DELIVERED returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("PENDING", "DELIVERED", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("PENDING → REFUND returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("PENDING", "REFUND", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("DELIVERED → PENDING returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("DELIVERED", "PENDING", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("CANCELLED → PENDING returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("CANCELLED", "PENDING", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("REFUND → PENDING returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("REFUND", "PENDING", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("SHIPPED → PACKAGED returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("SHIPPED", "PACKAGED", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("PACKAGED → PAYMENT_PENDING returns INVALID_STATUS_TRANSITION", () => {
    const err = validateTransition("PACKAGED", "PAYMENT_PENDING", {});
    expect(err?.code).toBe("INVALID_STATUS_TRANSITION");
  });

  // ── Missing required fields → VALIDATION_ERROR ─────────────────────────────

  it("PAYMENT_PENDING → PACKAGED without proofOfPaymentKey returns VALIDATION_ERROR", () => {
    const err = validateTransition("PAYMENT_PENDING", "PACKAGED", {});
    expect(err?.code).toBe("VALIDATION_ERROR");
  });

  it("READY_TO_SHIP → SHIPPED without trackingLink returns VALIDATION_ERROR", () => {
    const err = validateTransition("READY_TO_SHIP", "SHIPPED", {});
    expect(err?.code).toBe("VALIDATION_ERROR");
  });

  it("PACKAGED → REFUND without refundAmountIDR returns VALIDATION_ERROR", () => {
    const err = validateTransition("PACKAGED", "REFUND", { proofOfRefundKey: "proofs/refund.jpg" });
    expect(err?.code).toBe("VALIDATION_ERROR");
  });

  it("PACKAGED → REFUND without proofOfRefundKey returns VALIDATION_ERROR", () => {
    const err = validateTransition("PACKAGED", "REFUND", { refundAmountIDR: 450000 });
    expect(err?.code).toBe("VALIDATION_ERROR");
  });

  it("SHIPPED → REFUND without both required fields returns VALIDATION_ERROR", () => {
    const err = validateTransition("SHIPPED", "REFUND", {});
    expect(err?.code).toBe("VALIDATION_ERROR");
  });

  it("DELIVERED → REFUND without both required fields returns VALIDATION_ERROR", () => {
    const err = validateTransition("DELIVERED", "REFUND", {});
    expect(err?.code).toBe("VALIDATION_ERROR");
  });

  it("null/empty string field values are treated as missing", () => {
    const err = validateTransition("READY_TO_SHIP", "SHIPPED", { trackingLink: "" });
    expect(err?.code).toBe("VALIDATION_ERROR");
  });
});

// ── PATCH /orders/{orderId} tests ─────────────────────────────────────────────

describe("PATCH /orders/{orderId}", () => {
  beforeEach(() => vi.clearAllMocks());

  const mockPendingOrder = {
    PK: "ORDER#order-abc",
    SK: "METADATA",
    entityType: "ORDER",
    orderId: "order-abc",
    customerName: "Siti Rahayu",
    customerWhatsApp: "+628123456789",
    lineItems: [{ productId: "prod-1", productName: "Baju Kurung Moden Raya", size: "M", quantity: 2, unitPriceIDR: 450000 }],
    totalPriceIDR: 900000,
    status: "PENDING",
    trackingLink: null,
    proofOfPaymentKey: null,
    proofOfReceiptKey: null,
    refundAmountIDR: null,
    proofOfRefundKey: null,
    createdAt: "2025-02-15T10:30:00Z",
    updatedAt: "2025-02-15T10:30:00Z",
  };

  function makePatchEvent(orderId: string, body: unknown): APIGatewayProxyEvent {
    return makeEvent({
      httpMethod: "PATCH",
      path: `/orders/${orderId}`,
      pathParameters: { orderId },
      body: JSON.stringify(body),
    });
  }

  it("returns 404 NOT_FOUND when orderId path parameter is absent", async () => {
    const event = makeEvent({
      httpMethod: "PATCH",
      path: "/orders/",
      pathParameters: null,
      body: JSON.stringify({ status: "PAYMENT_PENDING" }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 VALIDATION_ERROR for invalid JSON body", async () => {
    const event = makeEvent({
      httpMethod: "PATCH",
      path: "/orders/order-abc",
      pathParameters: { orderId: "order-abc" },
      body: "not-json",
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when status is missing", async () => {
    const res = await handler(makePatchEvent("order-abc", {}));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for invalid status value", async () => {
    const res = await handler(makePatchEvent("order-abc", { status: "FLYING" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 ORDER_NOT_FOUND when order doesn't exist", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: undefined } as never);

    const res = await handler(makePatchEvent("nonexistent", { status: "PAYMENT_PENDING" }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe("ORDER_NOT_FOUND");
  });

  it("returns 400 INVALID_STATUS_TRANSITION for invalid transition (PENDING → SHIPPED)", async () => {
    const { ddbClient } = await import("../shared/index");
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: mockPendingOrder } as never);

    const res = await handler(makePatchEvent("order-abc", { status: "SHIPPED" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("returns 400 VALIDATION_ERROR for missing required fields (READY_TO_SHIP → SHIPPED without trackingLink)", async () => {
    const { ddbClient } = await import("../shared/index");
    const readyOrder = { ...mockPendingOrder, status: "READY_TO_SHIP" };
    vi.mocked(ddbClient.send).mockResolvedValueOnce({ Item: readyOrder } as never);

    const res = await handler(makePatchEvent("order-abc", { status: "SHIPPED" }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 with updated order on valid transition (PENDING → PAYMENT_PENDING)", async () => {
    const { ddbClient } = await import("../shared/index");
    const updatedOrder = { ...mockPendingOrder, status: "PAYMENT_PENDING" };
    vi.mocked(ddbClient.send)
      .mockResolvedValueOnce({ Item: mockPendingOrder } as never) // GetCommand (fetch current)
      .mockResolvedValueOnce({} as never)                          // UpdateCommand
      .mockResolvedValueOnce({} as never)                          // PutCommand (history)
      .mockResolvedValueOnce({ Item: updatedOrder } as never);     // GetCommand (fetch updated)

    const res = await handler(makePatchEvent("order-abc", { status: "PAYMENT_PENDING" }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.order.status).toBe("PAYMENT_PENDING");
  });

  it("writes STATUS# history item to DynamoDB on successful transition", async () => {
    const { ddbClient } = await import("../shared/index");
    const updatedOrder = { ...mockPendingOrder, status: "PAYMENT_PENDING" };
    vi.mocked(ddbClient.send)
      .mockResolvedValueOnce({ Item: mockPendingOrder } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ Item: updatedOrder } as never);

    await handler(makePatchEvent("order-abc", { status: "PAYMENT_PENDING" }));

    const calls = vi.mocked(ddbClient.send).mock.calls;
    // Third call (index 2) should be the PutCommand for history
    const putCall = calls[2][0] as { input: { Item: Record<string, unknown> } };
    expect(putCall.input.Item.PK).toBe("ORDER#order-abc");
    expect((putCall.input.Item.SK as string).startsWith("STATUS#")).toBe(true);
    expect(putCall.input.Item.entityType).toBe("ORDER_STATUS");
    expect(putCall.input.Item.status).toBe("PAYMENT_PENDING");
    expect(putCall.input.Item.changedAt).toBeDefined();
  });

  it("returns copyableMessage for PAYMENT_PENDING transition", async () => {
    const { ddbClient } = await import("../shared/index");
    const updatedOrder = { ...mockPendingOrder, status: "PAYMENT_PENDING" };
    vi.mocked(ddbClient.send)
      .mockResolvedValueOnce({ Item: mockPendingOrder } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ Item: updatedOrder } as never);

    const res = await handler(makePatchEvent("order-abc", { status: "PAYMENT_PENDING" }));
    const body = JSON.parse(res.body);
    expect(typeof body.copyableMessage).toBe("string");
    expect(body.copyableMessage).toContain("Siti Rahayu");
    expect(body.copyableMessage).toContain("order-abc");
    expect(body.copyableMessage).toContain("pembayaran");
  });

  it("returns copyableMessage for SHIPPED transition", async () => {
    const { ddbClient } = await import("../shared/index");
    const readyOrder = { ...mockPendingOrder, status: "READY_TO_SHIP" };
    const shippedOrder = { ...mockPendingOrder, status: "SHIPPED", trackingLink: "https://track.example.com/123" };
    vi.mocked(ddbClient.send)
      .mockResolvedValueOnce({ Item: readyOrder } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ Item: shippedOrder } as never);

    const res = await handler(makePatchEvent("order-abc", { status: "SHIPPED", trackingLink: "https://track.example.com/123" }));
    const body = JSON.parse(res.body);
    expect(typeof body.copyableMessage).toBe("string");
    expect(body.copyableMessage).toContain("Siti Rahayu");
    expect(body.copyableMessage).toContain("order-abc");
    expect(body.copyableMessage).toContain("https://track.example.com/123");
  });

  it("returns null copyableMessage for transitions that don't generate messages (PACKAGED → READY_TO_SHIP)", async () => {
    const { ddbClient } = await import("../shared/index");
    const packagedOrder = { ...mockPendingOrder, status: "PACKAGED" };
    const readyOrder = { ...mockPendingOrder, status: "READY_TO_SHIP" };
    vi.mocked(ddbClient.send)
      .mockResolvedValueOnce({ Item: packagedOrder } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ Item: readyOrder } as never);

    const res = await handler(makePatchEvent("order-abc", { status: "READY_TO_SHIP" }));
    const body = JSON.parse(res.body);
    expect(body.copyableMessage).toBeNull();
  });

  it("allows line item edits when transitioning to PAYMENT_PENDING", async () => {
    const { ddbClient } = await import("../shared/index");
    const newLineItems = [
      { productId: "prod-2", productName: "Baju Kurung Klasik", size: "L", quantity: 1, unitPriceIDR: 600000 },
    ];
    const updatedOrder = { ...mockPendingOrder, status: "PAYMENT_PENDING", lineItems: newLineItems, totalPriceIDR: 600000 };
    vi.mocked(ddbClient.send)
      .mockResolvedValueOnce({ Item: mockPendingOrder } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ Item: updatedOrder } as never);

    const res = await handler(makePatchEvent("order-abc", { status: "PAYMENT_PENDING", lineItems: newLineItems }));
    expect(res.statusCode).toBe(200);

    const updateCall = vi.mocked(ddbClient.send).mock.calls[1][0] as {
      input: { ExpressionAttributeValues: Record<string, unknown> };
    };
    expect(updateCall.input.ExpressionAttributeValues[":lineItems"]).toEqual(newLineItems);
  });

  it("recalculates totalPriceIDR when line items are updated on PAYMENT_PENDING", async () => {
    const { ddbClient } = await import("../shared/index");
    const newLineItems = [
      { productId: "prod-2", productName: "Baju Kurung Klasik", size: "L", quantity: 3, unitPriceIDR: 200000 },
    ];
    const updatedOrder = { ...mockPendingOrder, status: "PAYMENT_PENDING", lineItems: newLineItems, totalPriceIDR: 600000 };
    vi.mocked(ddbClient.send)
      .mockResolvedValueOnce({ Item: mockPendingOrder } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ Item: updatedOrder } as never);

    await handler(makePatchEvent("order-abc", { status: "PAYMENT_PENDING", lineItems: newLineItems }));

    const updateCall = vi.mocked(ddbClient.send).mock.calls[1][0] as {
      input: { ExpressionAttributeValues: Record<string, unknown> };
    };
    expect(updateCall.input.ExpressionAttributeValues[":totalPriceIDR"]).toBe(3 * 200000);
  });
});

// ── POST /orders/{orderId}/uploads tests ─────────────────────────────────────

describe("POST /orders/{orderId}/uploads", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeUploadEvent(orderId: string | null, body: unknown): APIGatewayProxyEvent {
    return makeEvent({
      httpMethod: "POST",
      path: orderId ? `/orders/${orderId}/uploads` : "/orders//uploads",
      pathParameters: orderId ? { orderId } : null,
      body: JSON.stringify(body),
    });
  }

  it("returns 200 with uploadUrl and key for proofOfPayment", async () => {
    const event = makeUploadEvent("order-abc", { fileType: "proofOfPayment" });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.uploadUrl).toBe("string");
    expect(body.uploadUrl.length).toBeGreaterThan(0);
    expect(typeof body.key).toBe("string");
  });

  it("returns 200 with uploadUrl and key for proofOfReceipt", async () => {
    const event = makeUploadEvent("order-abc", { fileType: "proofOfReceipt" });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.key).toMatch(/^orders\/order-abc\/proofOfReceipt\/.+\.jpg$/);
  });

  it("returns 200 with uploadUrl and key for proofOfRefund", async () => {
    const event = makeUploadEvent("order-abc", { fileType: "proofOfRefund" });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.key).toMatch(/^orders\/order-abc\/proofOfRefund\/.+\.jpg$/);
  });

  it("key follows pattern orders/{orderId}/{fileType}/{uuid}.jpg", async () => {
    const event = makeUploadEvent("order-xyz", { fileType: "proofOfPayment" });
    const res = await handler(event);
    const { key } = JSON.parse(res.body);
    expect(key).toMatch(/^orders\/order-xyz\/proofOfPayment\/[0-9a-f-]{36}\.jpg$/);
  });

  it("uses .png extension when contentType is image/png", async () => {
    const event = makeUploadEvent("order-abc", { fileType: "proofOfPayment", contentType: "image/png" });
    const res = await handler(event);
    const { key } = JSON.parse(res.body);
    expect(key).toMatch(/\.png$/);
  });

  it("defaults to .jpg extension when contentType is image/jpeg", async () => {
    const event = makeUploadEvent("order-abc", { fileType: "proofOfPayment", contentType: "image/jpeg" });
    const res = await handler(event);
    const { key } = JSON.parse(res.body);
    expect(key).toMatch(/\.jpg$/);
  });

  it("defaults to .jpg extension when contentType is omitted", async () => {
    const event = makeUploadEvent("order-abc", { fileType: "proofOfPayment" });
    const res = await handler(event);
    const { key } = JSON.parse(res.body);
    expect(key).toMatch(/\.jpg$/);
  });

  it("returns 400 VALIDATION_ERROR when fileType is missing", async () => {
    const event = makeUploadEvent("order-abc", {});
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when fileType is invalid", async () => {
    const event = makeUploadEvent("order-abc", { fileType: "proofOfSomethingElse" });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for invalid JSON body", async () => {
    const event = makeEvent({
      httpMethod: "POST",
      path: "/orders/order-abc/uploads",
      pathParameters: { orderId: "order-abc" },
      body: "not-json",
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("generates a unique key on each call", async () => {
    const event1 = makeUploadEvent("order-abc", { fileType: "proofOfPayment" });
    const event2 = makeUploadEvent("order-abc", { fileType: "proofOfPayment" });
    const res1 = await handler(event1);
    const res2 = await handler(event2);
    expect(JSON.parse(res1.body).key).not.toBe(JSON.parse(res2.body).key);
  });
});
