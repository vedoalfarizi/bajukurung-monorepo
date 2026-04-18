import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import type { Occasion, StandardSize } from "@baju-kurung/shared";
import { ddbClient, TABLE_NAME, errorResponse, successResponse, withErrorHandler } from "../shared/index";

const VALID_OCCASIONS: Occasion[] = ["Raya", "Wedding", "Casual"];
const VALID_SIZES: StandardSize[] = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];

// ── GET /products ─────────────────────────────────────────────────────────────

export async function listProducts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const occasion = event.queryStringParameters?.occasion;
  const size = event.queryStringParameters?.size;

  // Validate optional occasion param
  if (occasion !== undefined && !VALID_OCCASIONS.includes(occasion as Occasion)) {
    return errorResponse(400, "VALIDATION_ERROR", `occasion must be one of: ${VALID_OCCASIONS.join(", ")}.`);
  }

  // Validate optional size param
  if (size !== undefined && !VALID_SIZES.includes(size as StandardSize)) {
    return errorResponse(400, "VALIDATION_ERROR", `size must be one of: ${VALID_SIZES.join(", ")}.`);
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let items: Record<string, unknown>[] = [];

  if (occasion) {
    // Query GSI1: PK = occasion, SK = preOrderWindowEnd
    // Use SK condition to pre-filter: preOrderWindowEnd >= today (window hasn't ended yet)
    const result = await ddbClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "occasion = :occ AND preOrderWindowEnd >= :today",
        ExpressionAttributeValues: {
          ":occ": occasion,
          ":today": today,
        },
      })
    );
    items = (result.Items ?? []) as Record<string, unknown>[];
  } else {
    // No occasion filter — scan all products
    const result = await ddbClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "entityType = :et AND preOrderWindowEnd >= :today",
        ExpressionAttributeValues: {
          ":et": "PRODUCT",
          ":today": today,
        },
      })
    );
    items = (result.Items ?? []) as Record<string, unknown>[];
  }

  // Filter server-side: preOrderWindowStart <= today (window has started)
  let products = items.filter((item) => {
    const start = item.preOrderWindowStart as string | undefined;
    return start !== undefined && start <= today;
  });

  // Optional size filter
  if (size) {
    products = products.filter((item) => {
      const availableSizes = item.availableSizes as string[] | undefined;
      return Array.isArray(availableSizes) && availableSizes.includes(size);
    });
  }

  // Shape the response — return only the fields needed for catalogue listing
  const response = products.map((item) => ({
    productId: item.productId,
    name: item.name,
    occasion: item.occasion,
    availableSizes: item.availableSizes,
    priceIDR: item.priceIDR,
    primaryImageKey: item.primaryImageKey,
    preOrderWindowStart: item.preOrderWindowStart,
    preOrderWindowEnd: item.preOrderWindowEnd,
  }));

  return successResponse(200, response);
}

// ── POST /products ────────────────────────────────────────────────────────────

async function createProduct(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }

  const {
    name,
    occasion,
    description,
    fabricType,
    colours,
    availableSizes,
    sizeChart,
    priceIDR,
    imageKeys,
    preOrderWindowStart,
    preOrderWindowEnd,
  } = body;

  // ── Required field presence checks ──────────────────────────────────────────
  const missing: string[] = [];
  if (!name || typeof name !== "string" || name.trim() === "") missing.push("name");
  if (!occasion) missing.push("occasion");
  if (!description || typeof description !== "string" || description.trim() === "") missing.push("description");
  if (!fabricType || typeof fabricType !== "string" || fabricType.trim() === "") missing.push("fabricType");
  if (!colours || !Array.isArray(colours) || colours.length === 0) missing.push("colours");
  if (!availableSizes || !Array.isArray(availableSizes) || availableSizes.length === 0) missing.push("availableSizes");
  if (!sizeChart || typeof sizeChart !== "object" || Array.isArray(sizeChart)) missing.push("sizeChart");
  if (priceIDR === undefined || priceIDR === null) missing.push("priceIDR");
  if (!imageKeys || !Array.isArray(imageKeys) || imageKeys.length === 0) missing.push("imageKeys");
  if (!preOrderWindowStart || typeof preOrderWindowStart !== "string") missing.push("preOrderWindowStart");
  if (!preOrderWindowEnd || typeof preOrderWindowEnd !== "string") missing.push("preOrderWindowEnd");

  if (missing.length > 0) {
    return errorResponse(400, "VALIDATION_ERROR", `Missing or invalid required fields: ${missing.join(", ")}.`);
  }

  // ── Type / value validation ──────────────────────────────────────────────────
  if (!VALID_OCCASIONS.includes(occasion as Occasion)) {
    return errorResponse(400, "VALIDATION_ERROR", `occasion must be one of: ${VALID_OCCASIONS.join(", ")}.`);
  }

  if (typeof priceIDR !== "number" || priceIDR <= 0) {
    return errorResponse(400, "VALIDATION_ERROR", "priceIDR must be a positive number.");
  }

  const sizes = availableSizes as string[];
  for (const size of sizes) {
    if (!VALID_SIZES.includes(size as StandardSize)) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        `Invalid size "${size}". Must be one of: ${VALID_SIZES.join(", ")}.`
      );
    }
  }

  // ── sizeChart completeness check ─────────────────────────────────────────────
  const chart = sizeChart as Record<string, unknown>;
  for (const size of sizes) {
    const entry = chart[size];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return errorResponse(
        400,
        "INCOMPLETE_SIZE_CHART",
        `sizeChart is missing an entry for size "${size}".`
      );
    }
    const { bust, waist, hip } = entry as Record<string, unknown>;
    if (!bust || typeof bust !== "string" || bust.trim() === "") {
      return errorResponse(400, "INCOMPLETE_SIZE_CHART", `sizeChart entry for "${size}" is missing a non-empty bust value.`);
    }
    if (!waist || typeof waist !== "string" || waist.trim() === "") {
      return errorResponse(400, "INCOMPLETE_SIZE_CHART", `sizeChart entry for "${size}" is missing a non-empty waist value.`);
    }
    if (!hip || typeof hip !== "string" || hip.trim() === "") {
      return errorResponse(400, "INCOMPLETE_SIZE_CHART", `sizeChart entry for "${size}" is missing a non-empty hip value.`);
    }
  }

  // ── Build and persist the Product item ───────────────────────────────────────
  const productId = randomUUID();
  const now = new Date().toISOString();
  const primaryImageKey = (imageKeys as string[])[0];

  const item = {
    PK: `PRODUCT#${productId}`,
    SK: "METADATA",
    entityType: "PRODUCT",
    // GSI1 keys
    occasion: occasion as Occasion,
    preOrderWindowEnd: preOrderWindowEnd as string,
    // Product fields
    productId,
    name: (name as string).trim(),
    description: (description as string).trim(),
    fabricType: (fabricType as string).trim(),
    colours: colours as string[],
    availableSizes: sizes as StandardSize[],
    sizeChart: chart,
    priceIDR: priceIDR as number,
    primaryImageKey,
    imageKeys: imageKeys as string[],
    preOrderWindowStart: preOrderWindowStart as string,
    createdAt: now,
    updatedAt: now,
  };

  await ddbClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return successResponse(201, { productId });
}

// ── GET /products/{productId} ─────────────────────────────────────────────────

async function getProduct(productId: string): Promise<APIGatewayProxyResult> {
  const result = await ddbClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PRODUCT#${productId}`,
        SK: "METADATA",
      },
    })
  );

  if (!result.Item) {
    return errorResponse(404, "PRODUCT_NOT_FOUND", "The requested product does not exist.");
  }

  const item = result.Item as Record<string, unknown>;

  const product = {
    productId: item.productId,
    name: item.name,
    occasion: item.occasion,
    description: item.description,
    fabricType: item.fabricType,
    colours: item.colours,
    availableSizes: item.availableSizes,
    sizeChart: item.sizeChart,
    priceIDR: item.priceIDR,
    primaryImageKey: item.primaryImageKey,
    imageKeys: item.imageKeys,
    preOrderWindowStart: item.preOrderWindowStart,
    preOrderWindowEnd: item.preOrderWindowEnd,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  return successResponse(200, product);
}

// ── Lambda handler (router) ───────────────────────────────────────────────────

async function productHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  // GET /products
  if (httpMethod === "GET" && path === "/products") {
    return await listProducts(event);
  }

  // GET /products/{productId}
  if (httpMethod === "GET" && event.pathParameters?.productId) {
    return await getProduct(event.pathParameters.productId);
  }

  // POST /products
  if (httpMethod === "POST" && path === "/products") {
    return await createProduct(event);
  }

  return errorResponse(404, "NOT_FOUND", `Route ${httpMethod} ${path} not found.`);
}

export const handler = withErrorHandler(productHandler);
