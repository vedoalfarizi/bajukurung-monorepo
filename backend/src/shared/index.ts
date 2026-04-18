import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

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

// Wraps a Lambda handler in a top-level try/catch.
// On unhandled errors, logs to CloudWatch with requestId, path, and method,
// then returns 500 INTERNAL_ERROR without exposing stack traces.
// context is optional so tests can call handler(event) without a mock context.
export function withErrorHandler(
  fn: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
): (event: APIGatewayProxyEvent, context?: Context) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent, context?: Context): Promise<APIGatewayProxyResult> => {
    try {
      return await fn(event, context as Context);
    } catch (err) {
      console.error("Unhandled Lambda error", {
        requestId: context?.awsRequestId,
        path: event.path,
        method: event.httpMethod,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return errorResponse(500, "INTERNAL_ERROR", "An internal error occurred.");
    }
  };
}
