import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ApiStackProps extends cdk.StackProps {
  env_name: string;
  userPool: cognito.UserPool;
  productLambdaRole: iam.Role;
  orderLambdaRole: iam.Role;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly productLambda: lambda.Function;
  public readonly orderLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // ── Placeholder Lambda functions ───────────────────────────────────────
    // Actual handler code is implemented in tasks 4 and 6.
    // Inline handlers serve as placeholders so the API Gateway routes can be
    // wired and the stack can be synthesised/deployed before Lambda code exists.

    this.productLambda = new lambda.Function(this, "ProductLambda", {
      functionName: `baju-kurung-product-${props.env_name}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      role: props.productLambdaRole,
      code: lambda.Code.fromInline(`
exports.handler = async (event) => {
  return {
    statusCode: 501,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: { code: "NOT_IMPLEMENTED", message: "Product service not yet implemented." } }),
  };
};
      `.trim()),
      description: `Product Service Lambda — placeholder (${props.env_name})`,
    });

    this.orderLambda = new lambda.Function(this, "OrderLambda", {
      functionName: `baju-kurung-order-${props.env_name}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      role: props.orderLambdaRole,
      code: lambda.Code.fromInline(`
exports.handler = async (event) => {
  return {
    statusCode: 501,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: { code: "NOT_IMPLEMENTED", message: "Order service not yet implemented." } }),
  };
};
      `.trim()),
      description: `Order Service Lambda — placeholder (${props.env_name})`,
    });

    // ── REST API Gateway ───────────────────────────────────────────────────
    this.api = new apigateway.RestApi(this, "RestApi", {
      restApiName: `baju-kurung-api-${props.env_name}`,
      description: `Baju Kurung REST API (${props.env_name})`,
      deployOptions: {
        stageName: props.env_name,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    // ── Cognito Authorizer ─────────────────────────────────────────────────
    // Validates Seller JWT on protected routes.
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "SellerAuthorizer",
      {
        cognitoUserPools: [props.userPool],
        authorizerName: `baju-kurung-seller-authorizer-${props.env_name}`,
        identitySource: "method.request.header.Authorization",
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    // ── Lambda integrations ────────────────────────────────────────────────
    const productIntegration = new apigateway.LambdaIntegration(
      this.productLambda,
      { proxy: true }
    );
    const orderIntegration = new apigateway.LambdaIntegration(
      this.orderLambda,
      { proxy: true }
    );

    // ── /products routes ───────────────────────────────────────────────────
    const products = this.api.root.addResource("products");

    // GET /products — public
    products.addMethod("GET", productIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // POST /products — protected (Seller JWT)
    products.addMethod("POST", productIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
    });

    // /products/{productId}
    const productById = products.addResource("{productId}");

    // GET /products/{productId} — public
    productById.addMethod("GET", productIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // ── /orders routes ─────────────────────────────────────────────────────
    const orders = this.api.root.addResource("orders");

    // POST /orders — public (customer checkout, no auth)
    orders.addMethod("POST", orderIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // GET /orders — protected (Seller JWT)
    orders.addMethod("GET", orderIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
    });

    // /orders/{orderId}
    const orderById = orders.addResource("{orderId}");

    // GET /orders/{orderId} — protected (Seller JWT)
    orderById.addMethod("GET", orderIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
    });

    // PATCH /orders/{orderId} — protected (Seller JWT)
    orderById.addMethod("PATCH", orderIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
    });

    // /orders/{orderId}/uploads
    const orderUploads = orderById.addResource("uploads");

    // POST /orders/{orderId}/uploads — protected (Seller JWT)
    orderUploads.addMethod("POST", orderIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: cognitoAuthorizer,
    });

    // ── Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      exportName: `baju-kurung-api-url-${props.env_name}`,
      description: "REST API Gateway base URL",
    });

    new cdk.CfnOutput(this, "ApiId", {
      value: this.api.restApiId,
      exportName: `baju-kurung-api-id-${props.env_name}`,
      description: "REST API Gateway ID",
    });

    new cdk.CfnOutput(this, "ProductLambdaArn", {
      value: this.productLambda.functionArn,
      exportName: `baju-kurung-product-lambda-arn-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "OrderLambdaArn", {
      value: this.orderLambda.functionArn,
      exportName: `baju-kurung-order-lambda-arn-${props.env_name}`,
    });
  }
}
