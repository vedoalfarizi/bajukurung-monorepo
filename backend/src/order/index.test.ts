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
}));

import { handler } from "./index";

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
    const event = makeEvent({ httpMethod: "GET", path: "/orders" });
    const res = await handler(event);
    expect(res.statusCode).toBe(404);
  });
});
