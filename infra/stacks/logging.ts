import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface LoggingStackProps extends cdk.StackProps {
  env_name: string;
}

export class LoggingStack extends cdk.Stack {
  public readonly productLogGroup: logs.LogGroup;
  public readonly orderLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: LoggingStackProps) {
    super(scope, id, props);

    const isProd = props.env_name === "production";

    // Retention: 30 days for staging, 90 days for production.
    const retention = isProd
      ? logs.RetentionDays.THREE_MONTHS
      : logs.RetentionDays.ONE_MONTH;

    // ── Product Service Lambda log group ───────────────────────────────────
    // Log group name must match the ARN pattern used in iam.ts so the
    // least-privilege CloudWatch policy grants access to this exact group.
    this.productLogGroup = new logs.LogGroup(
      this,
      "ProductLambdaLogGroup",
      {
        logGroupName: `/aws/lambda/baju-kurung-product-${props.env_name}`,
        retention,
        removalPolicy: isProd
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      }
    );

    // ── Order Service Lambda log group ─────────────────────────────────────
    this.orderLogGroup = new logs.LogGroup(
      this,
      "OrderLambdaLogGroup",
      {
        logGroupName: `/aws/lambda/baju-kurung-order-${props.env_name}`,
        retention,
        removalPolicy: isProd
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      }
    );

    // ── Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "ProductLogGroupName", {
      value: this.productLogGroup.logGroupName,
      exportName: `baju-kurung-product-log-group-name-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "ProductLogGroupArn", {
      value: this.productLogGroup.logGroupArn,
      exportName: `baju-kurung-product-log-group-arn-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "OrderLogGroupName", {
      value: this.orderLogGroup.logGroupName,
      exportName: `baju-kurung-order-log-group-name-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "OrderLogGroupArn", {
      value: this.orderLogGroup.logGroupArn,
      exportName: `baju-kurung-order-log-group-arn-${props.env_name}`,
    });
  }
}
