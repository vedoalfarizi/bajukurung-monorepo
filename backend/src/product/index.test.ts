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
    path: "/products",
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

const validPayload = {
  name: "Baju Kurung Moden Raya",
  occasion: "Raya",
  description: "A beautiful Raya outfit",
  fabricType: "Cotton Silk",
  colours: ["Dusty Rose", "Sage Green"],
  availableSizes: ["XS", "S", "M"],
  sizeChart: {
    XS: { bust: "76–80", waist: "60–64", hip: "84–88" },
    S: { bust: "81–85", waist: "65–69", hip: "89–93" },
    M: { bust: "86–90", waist: "70–74", hip: "94–98" },
  },
  priceIDR: 450000,
  imageKeys: ["products/abc/1.jpg", "products/abc/2.jpg"],
  preOrderWindowStart: "2025-01-01",
  preOrderWindowEnd: "2025-03-31",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /products", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 with productId on valid payload", async () => {
    const event = makeEvent({ body: JSON.stringify(validPayload) });
    const res = await handler(event);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(typeof body.productId).toBe("string");
    expect(body.productId.length).toBeGreaterThan(0);
  });

  it("returns 400 VALIDATION_ERROR for invalid JSON body", async () => {
    const event = makeEvent({ body: "not-json" });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when name is missing", async () => {
    const { name: _n, ...rest } = validPayload;
    const event = makeEvent({ body: JSON.stringify(rest) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when occasion is missing", async () => {
    const { occasion: _o, ...rest } = validPayload;
    const event = makeEvent({ body: JSON.stringify(rest) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for invalid occasion value", async () => {
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, occasion: "Birthday" }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for invalid size in availableSizes", async () => {
    const event = makeEvent({
      body: JSON.stringify({
        ...validPayload,
        availableSizes: ["XS", "XXXL"],
        sizeChart: {
          XS: { bust: "76–80", waist: "60–64", hip: "84–88" },
          XXXL: { bust: "100–110", waist: "90–100", hip: "110–120" },
        },
      }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when priceIDR is not a positive number", async () => {
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, priceIDR: -100 }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when imageKeys is empty", async () => {
    const event = makeEvent({ body: JSON.stringify({ ...validPayload, imageKeys: [] }) });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 INCOMPLETE_SIZE_CHART when sizeChart is missing an entry for an availableSize", async () => {
    const event = makeEvent({
      body: JSON.stringify({
        ...validPayload,
        availableSizes: ["XS", "S", "M", "L"],
        // L is missing from sizeChart
        sizeChart: {
          XS: { bust: "76–80", waist: "60–64", hip: "84–88" },
          S: { bust: "81–85", waist: "65–69", hip: "89–93" },
          M: { bust: "86–90", waist: "70–74", hip: "94–98" },
        },
      }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INCOMPLETE_SIZE_CHART");
  });

  it("returns 400 INCOMPLETE_SIZE_CHART when a sizeChart entry is missing bust", async () => {
    const event = makeEvent({
      body: JSON.stringify({
        ...validPayload,
        sizeChart: {
          ...validPayload.sizeChart,
          XS: { bust: "", waist: "60–64", hip: "84–88" },
        },
      }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INCOMPLETE_SIZE_CHART");
  });

  it("returns 400 INCOMPLETE_SIZE_CHART when a sizeChart entry is missing waist", async () => {
    const event = makeEvent({
      body: JSON.stringify({
        ...validPayload,
        sizeChart: {
          ...validPayload.sizeChart,
          S: { bust: "81–85", waist: "", hip: "89–93" },
        },
      }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INCOMPLETE_SIZE_CHART");
  });

  it("returns 400 INCOMPLETE_SIZE_CHART when a sizeChart entry is missing hip", async () => {
    const event = makeEvent({
      body: JSON.stringify({
        ...validPayload,
        sizeChart: {
          ...validPayload.sizeChart,
          M: { bust: "86–90", waist: "70–74", hip: "" },
        },
      }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("INCOMPLETE_SIZE_CHART");
  });

  it("accepts AllSize as a valid size", async () => {
    const event = makeEvent({
      body: JSON.stringify({
        ...validPayload,
        availableSizes: ["AllSize"],
        sizeChart: {
          AllSize: { bust: "86–96", waist: "70–80", hip: "94–104" },
        },
      }),
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(201);
  });

  it("returns 404 for unknown routes", async () => {
    const event = makeEvent({ httpMethod: "DELETE", path: "/products" });
    const res = await handler(event);
    expect(res.statusCode).toBe(404);
  });
});
