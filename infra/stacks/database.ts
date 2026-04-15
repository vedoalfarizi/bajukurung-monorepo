import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface DatabaseStackProps extends cdk.StackProps {
  env_name: string;
}

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const isProd = props.env_name === "production";

    this.table = new dynamodb.Table(this, "MainTable", {
      tableName: `baju-kurung-${props.env_name}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI1: Query products by occasion, filter by open pre-order window
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "occasion", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "preOrderWindowEnd", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: List all orders sorted by creation date
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: { name: "entityType", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3: Filter orders by status
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI3",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, "TableName", {
      value: this.table.tableName,
      exportName: `baju-kurung-table-name-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "TableArn", {
      value: this.table.tableArn,
      exportName: `baju-kurung-table-arn-${props.env_name}`,
    });
  }
}
