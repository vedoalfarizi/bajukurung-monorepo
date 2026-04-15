import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface IamStackProps extends cdk.StackProps {
  env_name: string;
  tableArn: string;
  imagesBucketArn: string;
}

export class IamStack extends cdk.Stack {
  public readonly productLambdaRole: iam.Role;
  public readonly orderLambdaRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    // ── Product Lambda Role ────────────────────────────────────────────────
    // Permissions:
    //   DynamoDB: GetItem, PutItem, Query on main table + GSIs
    //   S3:       PutObject, GetObject on product images bucket (pre-signed URLs)
    //   CloudWatch Logs: CreateLogGroup, CreateLogStream, PutLogEvents
    this.productLambdaRole = new iam.Role(this, "ProductLambdaRole", {
      roleName: `baju-kurung-product-lambda-role-${props.env_name}`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: `Least-privilege role for Product Service Lambda (${props.env_name})`,
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowProductDynamoDB",
              effect: iam.Effect.ALLOW,
              actions: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Query",
              ],
              resources: [
                props.tableArn,
                `${props.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowProductImagesS3",
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:PutObject",
                "s3:GetObject",
              ],
              resources: [`${props.imagesBucketArn}/*`],
            }),
          ],
        }),
        CloudWatchLogsAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowProductLambdaLogs",
              effect: iam.Effect.ALLOW,
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/baju-kurung-product-${props.env_name}:*`,
              ],
            }),
          ],
        }),
      },
    });

    // ── Order Lambda Role ──────────────────────────────────────────────────
    // Permissions:
    //   DynamoDB: GetItem, PutItem, UpdateItem, Query on main table + GSIs
    //   S3:       PutObject on product images bucket (proof photo pre-signed URLs)
    //   CloudWatch Logs: CreateLogGroup, CreateLogStream, PutLogEvents
    this.orderLambdaRole = new iam.Role(this, "OrderLambdaRole", {
      roleName: `baju-kurung-order-lambda-role-${props.env_name}`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: `Least-privilege role for Order Service Lambda (${props.env_name})`,
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowOrderDynamoDB",
              effect: iam.Effect.ALLOW,
              actions: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:Query",
              ],
              resources: [
                props.tableArn,
                `${props.tableArn}/index/*`,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowOrderProofPhotosS3",
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:PutObject",
              ],
              resources: [`${props.imagesBucketArn}/*`],
            }),
          ],
        }),
        CloudWatchLogsAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowOrderLambdaLogs",
              effect: iam.Effect.ALLOW,
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/baju-kurung-order-${props.env_name}:*`,
              ],
            }),
          ],
        }),
      },
    });

    // ── Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "ProductLambdaRoleArn", {
      value: this.productLambdaRole.roleArn,
      exportName: `baju-kurung-product-lambda-role-arn-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "ProductLambdaRoleName", {
      value: this.productLambdaRole.roleName,
      exportName: `baju-kurung-product-lambda-role-name-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "OrderLambdaRoleArn", {
      value: this.orderLambdaRole.roleArn,
      exportName: `baju-kurung-order-lambda-role-arn-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "OrderLambdaRoleName", {
      value: this.orderLambdaRole.roleName,
      exportName: `baju-kurung-order-lambda-role-name-${props.env_name}`,
    });
  }
}
