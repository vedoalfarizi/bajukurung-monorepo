import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import type { Occasion, StandardSize } from "@baju-kurung/shared";
import { ddbClient, TABLE_NAME, errorResponse, successResponse } from "../shared/index";

const VALID_OCCASIONS: Occasion[] = ["Raya", "Wedding", "Casual"];
const VALID_SIZES: StandardSize[] = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];

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

// ── Lambda handler (router) ───────────────────────────────────────────────────

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  try {
    // POST /products
    if (httpMethod === "POST" && path === "/products") {
      return await createProduct(event);
    }

    return errorResponse(404, "NOT_FOUND", `Route ${httpMethod} ${path} not found.`);
  } catch (err) {
    console.error("Unhandled error", { requestId: event.requestContext?.requestId, path, httpMethod, err });
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  }
}
