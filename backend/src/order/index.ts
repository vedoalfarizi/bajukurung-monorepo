import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import type { LineItem, OrderStatus, StandardSize } from "@baju-kurung/shared";
import { ddbClient, TABLE_NAME, errorResponse, successResponse } from "../shared/index";
import { validateTransition } from "./stateMachine";

const VALID_ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAYMENT_PENDING",
  "PACKAGED",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUND",
];

const VALID_SIZES: StandardSize[] = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];

// ── GET /orders ───────────────────────────────────────────────────────────────

async function listOrders(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const statusFilter = event.queryStringParameters?.status;

  // Validate status filter if provided
  if (statusFilter !== undefined && !VALID_ORDER_STATUSES.includes(statusFilter as OrderStatus)) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      `Invalid status value. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}.`
    );
  }

  let orders: Record<string, unknown>[];

  if (statusFilter) {
    // Use GSI3 (status + createdAt) to filter by status
    const result = await ddbClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI3",
        KeyConditionExpression: "#status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": statusFilter },
        ScanIndexForward: true, // ascending by createdAt
      })
    );
    orders = (result.Items ?? []) as Record<string, unknown>[];
  } else {
    // Use GSI2 (entityType + createdAt) to list all orders sorted by createdAt
    const result = await ddbClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "entityType = :entityType",
        ExpressionAttributeValues: { ":entityType": "ORDER" },
        ScanIndexForward: true, // ascending by createdAt
      })
    );
    orders = (result.Items ?? []) as Record<string, unknown>[];
  }

  return successResponse(200, { orders });
}

// ── GET /orders/{orderId} ─────────────────────────────────────────────────────

async function getOrder(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const orderId = event.pathParameters?.orderId;

  if (!orderId || orderId.trim() === "") {
    return errorResponse(400, "VALIDATION_ERROR", "orderId path parameter is required.");
  }

  const result = await ddbClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: "METADATA" },
    })
  );

  if (!result.Item) {
    return errorResponse(404, "ORDER_NOT_FOUND", `Order with id '${orderId}' was not found.`);
  }

  return successResponse(200, { order: result.Item });
}

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

// ── WhatsApp message generators ───────────────────────────────────────────────

function generateOrderSummaryMessage(order: Record<string, unknown>): string {
  const customerName = order.customerName as string;
  const orderId = order.orderId as string;
  const lineItems = (order.lineItems as LineItem[]) ?? [];
  const totalPriceIDR = order.totalPriceIDR as number;

  const itemLines = lineItems
    .map((item, i) => {
      const lineTotal = item.quantity * item.unitPriceIDR;
      return `${i + 1}. ${item.productName} - Ukuran ${item.size} x${item.quantity} = Rp ${lineTotal.toLocaleString("id-ID")}`;
    })
    .join("\n");

  return `Halo ${customerName}, berikut ringkasan pesanan Anda:

No. Pesanan: ${orderId}

${itemLines}

Total: Rp ${totalPriceIDR.toLocaleString("id-ID")}

Silakan lakukan pembayaran dan konfirmasi kepada kami.
Terima kasih!`;
}

function generateTrackingMessage(order: Record<string, unknown>): string {
  const customerName = order.customerName as string;
  const orderId = order.orderId as string;
  const trackingLink = order.trackingLink as string;

  return `Halo ${customerName}, pesanan Anda sudah dikirim!

No. Pesanan: ${orderId}
Link Tracking: ${trackingLink}

Terima kasih sudah berbelanja!`;
}

// ── PATCH /orders/{orderId} ───────────────────────────────────────────────────

async function updateOrderStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const orderId = event.pathParameters?.orderId;

  if (!orderId || orderId.trim() === "") {
    return errorResponse(400, "VALIDATION_ERROR", "orderId path parameter is required.");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }

  const { status: newStatus, lineItems: rawLineItems, ...fields } = body;

  if (!newStatus || typeof newStatus !== "string") {
    return errorResponse(400, "VALIDATION_ERROR", "status is required.");
  }

  if (!VALID_ORDER_STATUSES.includes(newStatus as OrderStatus)) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      `Invalid status value. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}.`
    );
  }

  // Fetch current order
  const getResult = await ddbClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: "METADATA" },
    })
  );

  if (!getResult.Item) {
    return errorResponse(404, "ORDER_NOT_FOUND", `Order with id '${orderId}' was not found.`);
  }

  const currentStatus = getResult.Item.status as OrderStatus;

  // Validate the transition
  const transitionError = validateTransition(currentStatus, newStatus as OrderStatus, fields);
  if (transitionError) {
    return errorResponse(400, transitionError.code, transitionError.message);
  }

  // Build update expression for the allowed optional fields
  const now = new Date().toISOString();
  const allowedFields: (keyof typeof fields)[] = [
    "trackingLink",
    "proofOfPaymentKey",
    "proofOfReceiptKey",
    "refundAmountIDR",
    "proofOfRefundKey",
  ];

  const updateParts: string[] = ["#status = :status", "updatedAt = :updatedAt"];
  const expressionAttributeNames: Record<string, string> = { "#status": "status" };
  const expressionAttributeValues: Record<string, unknown> = {
    ":status": newStatus,
    ":updatedAt": now,
  };

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      updateParts.push(`${field} = :${field}`);
      expressionAttributeValues[`:${field}`] = fields[field];
    }
  }

  // Handle line item edits on PAYMENT_PENDING transition
  let validatedLineItems: LineItem[] | undefined;
  if (newStatus === "PAYMENT_PENDING" && rawLineItems !== undefined) {
    if (!Array.isArray(rawLineItems) || rawLineItems.length === 0) {
      return errorResponse(400, "VALIDATION_ERROR", "lineItems must be a non-empty array.");
    }
    const items = rawLineItems as Record<string, unknown>[];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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
    validatedLineItems = items.map((item) => ({
      productId: item.productId as string,
      productName: item.productName as string,
      size: item.size as StandardSize,
      quantity: item.quantity as number,
      unitPriceIDR: item.unitPriceIDR as number,
    }));
    const newTotal = validatedLineItems.reduce((sum, item) => sum + item.quantity * item.unitPriceIDR, 0);
    updateParts.push("lineItems = :lineItems", "totalPriceIDR = :totalPriceIDR");
    expressionAttributeValues[":lineItems"] = validatedLineItems;
    expressionAttributeValues[":totalPriceIDR"] = newTotal;
  }

  await ddbClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: "METADATA" },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );

  // Write STATUS# history item
  await ddbClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `ORDER#${orderId}`,
        SK: `STATUS#${now}`,
        entityType: "ORDER_STATUS",
        status: newStatus,
        changedAt: now,
      },
    })
  );

  // Return updated order
  const updatedResult = await ddbClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `ORDER#${orderId}`, SK: "METADATA" },
    })
  );

  const updatedOrder = updatedResult.Item as Record<string, unknown>;

  // Generate copyable WhatsApp message where applicable
  let copyableMessage: string | null = null;
  if (newStatus === "PAYMENT_PENDING") {
    copyableMessage = generateOrderSummaryMessage(updatedOrder);
  } else if (newStatus === "SHIPPED") {
    copyableMessage = generateTrackingMessage(updatedOrder);
  }

  return successResponse(200, { order: updatedOrder, copyableMessage });
}

// ── Lambda handler (router) ───────────────────────────────────────────────────

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  try {
    // GET /orders
    if (httpMethod === "GET" && path === "/orders") {
      return await listOrders(event);
    }

    // GET /orders/{orderId}
    if (httpMethod === "GET" && event.pathParameters?.orderId) {
      return await getOrder(event);
    }

    // PATCH /orders/{orderId}
    if (httpMethod === "PATCH" && event.pathParameters?.orderId) {
      return await updateOrderStatus(event);
    }

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
