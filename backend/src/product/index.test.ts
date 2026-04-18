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

import { handler } from "./index";
import { ddbClient } from "../shared/index";

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

// ── GET /products tests ───────────────────────────────────────────────────────

// Helper to build a product DDB item with configurable window dates
function makeProductItem(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  // Default: window open (started yesterday, ends tomorrow)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return {
    PK: "PRODUCT#test-id",
    SK: "METADATA",
    entityType: "PRODUCT",
    productId: "test-id",
    name: "Baju Kurung Moden Raya",
    occasion: "Raya",
    availableSizes: ["S", "M", "L"],
    priceIDR: 450000,
    primaryImageKey: "products/test-id/primary.jpg",
    preOrderWindowStart: yesterday,
    preOrderWindowEnd: tomorrow,
    createdAt: today,
    updatedAt: today,
    ...overrides,
  };
}

describe("GET /products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ddbClient.send).mockResolvedValue({} as never);
  });

  it("returns 200 with empty array when no products match", async () => {
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [] } as never);
    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: null });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it("returns only products with open Pre-Order Window (start <= today <= end)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const lastYear = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

    const openProduct = makeProductItem({ productId: "open", preOrderWindowStart: yesterday, preOrderWindowEnd: tomorrow });
    // Window not yet started (starts tomorrow)
    const futureProduct = makeProductItem({ productId: "future", preOrderWindowStart: tomorrow, preOrderWindowEnd: tomorrow });

    // GSI1 query already filters preOrderWindowEnd >= today, so only openProduct is returned
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [openProduct] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: { occasion: "Raya" } });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<{ productId: string }>;
    expect(body.map((p) => p.productId)).toContain("open");
    expect(body.map((p) => p.productId)).not.toContain("future");
  });

  it("filters out products whose window has not started yet (preOrderWindowStart > today)", async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    // DDB returns this item (preOrderWindowEnd >= today), but start is in the future
    const notStarted = makeProductItem({ productId: "not-started", preOrderWindowStart: tomorrow, preOrderWindowEnd: dayAfter });
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [notStarted] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: { occasion: "Raya" } });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<{ productId: string }>;
    expect(body).toHaveLength(0);
  });

  it("filters by occasion using GSI1 when ?occasion= is provided", async () => {
    const rayaProduct = makeProductItem({ productId: "raya-1", occasion: "Raya" });
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [rayaProduct] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: { occasion: "Raya" } });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<{ occasion: string }>;
    expect(body.every((p) => p.occasion === "Raya")).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for invalid occasion param", async () => {
    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: { occasion: "Birthday" } });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("filters by size when ?size= is provided", async () => {
    const withM = makeProductItem({ productId: "has-m", availableSizes: ["S", "M", "L"] });
    const withoutM = makeProductItem({ productId: "no-m", availableSizes: ["XL", "XXL"] });
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [withM, withoutM] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: { occasion: "Raya", size: "M" } });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<{ productId: string; availableSizes: string[] }>;
    expect(body.every((p) => p.availableSizes.includes("M"))).toBe(true);
    expect(body.map((p) => p.productId)).not.toContain("no-m");
  });

  it("returns 400 VALIDATION_ERROR for invalid size param", async () => {
    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: { size: "XXXL" } });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns empty array when size filter matches no products", async () => {
    const noXXL = makeProductItem({ productId: "no-xxl", availableSizes: ["S", "M"] });
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [noXXL] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: { size: "XXL" } });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it("response includes required catalogue fields for each product", async () => {
    const product = makeProductItem();
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [product] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: null });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    const p = body[0];
    expect(p).toHaveProperty("productId");
    expect(p).toHaveProperty("name");
    expect(p).toHaveProperty("occasion");
    expect(p).toHaveProperty("availableSizes");
    expect(p).toHaveProperty("priceIDR");
    expect(p).toHaveProperty("primaryImageKey");
    expect(p).toHaveProperty("preOrderWindowStart");
    expect(p).toHaveProperty("preOrderWindowEnd");
  });

  it("works without any query params (returns all open products via scan)", async () => {
    const product = makeProductItem();
    vi.mocked(ddbClient.send).mockResolvedValue({ Items: [product] } as never);

    const event = makeEvent({ httpMethod: "GET", path: "/products", queryStringParameters: null });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveLength(1);
  });
});

// ── GET /products/{productId} tests ──────────────────────────────────────────

function makeDetailProductItem(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return {
    PK: "PRODUCT#detail-id",
    SK: "METADATA",
    entityType: "PRODUCT",
    productId: "detail-id",
    name: "Baju Kurung Moden Raya",
    occasion: "Raya",
    description: "A beautiful Raya outfit",
    fabricType: "Cotton Silk",
    colours: ["Dusty Rose", "Sage Green"],
    availableSizes: ["S", "M", "L"],
    sizeChart: {
      S: { bust: "81–85", waist: "65–69", hip: "89–93" },
      M: { bust: "86–90", waist: "70–74", hip: "94–98" },
      L: { bust: "91–96", waist: "75–80", hip: "99–104" },
    },
    priceIDR: 450000,
    primaryImageKey: "products/detail-id/primary.jpg",
    imageKeys: ["products/detail-id/1.jpg", "products/detail-id/2.jpg"],
    preOrderWindowStart: yesterday,
    preOrderWindowEnd: tomorrow,
    createdAt: today,
    updatedAt: today,
    ...overrides,
  };
}

describe("GET /products/{productId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with full product detail when product exists", async () => {
    const item = makeDetailProductItem();
    vi.mocked(ddbClient.send).mockResolvedValue({ Item: item } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/products/detail-id",
      pathParameters: { productId: "detail-id" },
    });
    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;

    // All required detail fields must be present
    expect(body).toHaveProperty("productId", "detail-id");
    expect(body).toHaveProperty("name", "Baju Kurung Moden Raya");
    expect(body).toHaveProperty("occasion", "Raya");
    expect(body).toHaveProperty("description", "A beautiful Raya outfit");
    expect(body).toHaveProperty("fabricType", "Cotton Silk");
    expect(body).toHaveProperty("colours");
    expect(body).toHaveProperty("availableSizes");
    expect(body).toHaveProperty("sizeChart");
    expect(body).toHaveProperty("priceIDR", 450000);
    expect(body).toHaveProperty("primaryImageKey");
    expect(body).toHaveProperty("imageKeys");
    expect(body).toHaveProperty("preOrderWindowStart");
    expect(body).toHaveProperty("preOrderWindowEnd");
    expect(body).toHaveProperty("createdAt");
    expect(body).toHaveProperty("updatedAt");
  });

  it("returns sizeChart with entries for all available sizes", async () => {
    const item = makeDetailProductItem();
    vi.mocked(ddbClient.send).mockResolvedValue({ Item: item } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/products/detail-id",
      pathParameters: { productId: "detail-id" },
    });
    const res = await handler(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const sizeChart = body.sizeChart as Record<string, { bust: string; waist: string; hip: string }>;
    const availableSizes = body.availableSizes as string[];

    for (const size of availableSizes) {
      expect(sizeChart).toHaveProperty(size);
      expect(sizeChart[size].bust).toBeTruthy();
      expect(sizeChart[size].waist).toBeTruthy();
      expect(sizeChart[size].hip).toBeTruthy();
    }
  });

  it("returns 404 PRODUCT_NOT_FOUND when product does not exist", async () => {
    vi.mocked(ddbClient.send).mockResolvedValue({ Item: undefined } as never);

    const event = makeEvent({
      httpMethod: "GET",
      path: "/products/nonexistent-id",
      pathParameters: { productId: "nonexistent-id" },
    });
    const res = await handler(event);

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("PRODUCT_NOT_FOUND");
    expect(body.error.message).toBe("The requested product does not exist.");
  });
});
