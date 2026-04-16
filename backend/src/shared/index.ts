import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// DynamoDB client singleton
const raw = new DynamoDBClient({});
export const ddbClient = DynamoDBDocumentClient.from(raw);

export const TABLE_NAME = process.env.TABLE_NAME ?? "baju-kurung-local";

// Standard error response helper
export function errorResponse(statusCode: number, code: string, message: string) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: { code, message } }),
  };
}

// Success response helper
export function successResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
