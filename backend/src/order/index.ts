import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import type { LineItem, StandardSize } from "@baju-kurung/shared";
import { ddbClient, TABLE_NAME, errorResponse, successResponse } from "../shared/index";

const VALID_SIZES: StandardSize[] = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];

// ── POST /orders ──────────────────────────────────────────────────────────────

async function createOrder(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }

  const { customerName, customerWhatsApp, lineItems } = body;

  // ── Required field validation ─────────────────────────────────────────────
  if (!customerName || typeof customerName !== "string" || customerName.trim() === "") {
    return errorResponse(400, "VALIDATION_ERROR", "customerName is required and must be a non-empty string.");
  }

  if (!customerWhatsApp || typeof customerWhatsApp !== "string" || customerWhatsApp.trim() === "") {
    return errorResponse(400, "VALIDATION_ERROR", "customerWhatsApp is required and must be a non-empty string.");
  }

  if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    return errorResponse(400, "VALIDATION_ERROR", "lineItems is required and must be a non-empty array.");
  }

  // ── Line item validation ──────────────────────────────────────────────────
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i] as Record<string, unknown>;

    if (!item.productId || typeof item.productId !== "string" || item.productId.trim() === "") {
      return errorResponse(400, "VALIDATION_ERROR", `lineItems[${i}].productId is required.`);
    }
    if (!item.productName || typeof item.productName !== "string" || item.productName.trim() === "") {
      return errorResponse(400, "VALIDATION_ERROR", `lineItems[${i}].productName is required.`);
    }
    if (!item.size || !VALID_SIZES.includes(item.size as StandardSize)) {
      return errorResponse(400, "VALIDATION_ERROR", `lineItems[${i}].size must be one of: ${VALID_SIZES.join(", ")}.`);
    }
    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return errorResponse(400, "VALIDATION_ERROR", `lineItems[${i}].quantity must be a positive integer.`);
    }
    if (typeof item.unitPriceIDR !== "number" || item.unitPriceIDR <= 0) {
      return errorResponse(400, "VALIDATION_ERROR", `lineItems[${i}].unitPriceIDR must be a positive number.`);
    }
  }

  // ── Build order ───────────────────────────────────────────────────────────
  const orderId = randomUUID();
  const now = new Date().toISOString();

  const validatedLineItems: LineItem[] = (lineItems as Record<string, unknown>[]).map((item) => ({
    productId: item.productId as string,
    productName: item.productName as string,
    size: item.size as StandardSize,
    quantity: item.quantity as number,
    unitPriceIDR: item.unitPriceIDR as number,
  }));

  const totalPriceIDR = validatedLineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceIDR,
    0
  );

  const orderItem = {
    PK: `ORDER#${orderId}`,
    SK: "METADATA",
    entityType: "ORDER",
    orderId,
    customerName: (customerName as string).trim(),
    customerWhatsApp: (customerWhatsApp as string).trim(),
    lineItems: validatedLineItems,
    totalPriceIDR,
    status: "PENDING",
    trackingLink: null,
    proofOfPaymentKey: null,
    proofOfReceiptKey: null,
    refundAmountIDR: null,
    proofOfRefundKey: null,
    createdAt: now,
    updatedAt: now,
  };

  await ddbClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: orderItem,
    })
  );

  return successResponse(201, { orderId });
}

// ── Lambda handler (router) ───────────────────────────────────────────────────

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  try {
    // POST /orders
    if (httpMethod === "POST" && path === "/orders") {
      return await createOrder(event);
    }

    return errorResponse(404, "NOT_FOUND", `Route ${httpMethod} ${path} not found.`);
  } catch (err) {
    console.error("Unhandled error", { requestId: event.requestContext?.requestId, path, httpMethod, err });
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  }
}
