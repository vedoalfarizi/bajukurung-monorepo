import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

// Note: CDK does not yet have an L2 construct for OAC — we use the L1 CfnOriginAccessControl.
// The OAC ID is exported so cdn.ts can attach it to the CloudFront distribution origins.
// Bucket policies use a CloudFront service principal scoped to this AWS account;
// once cdn.ts is created, tighten the condition to the specific distribution ARN.

export interface StorageStackProps extends cdk.StackProps {
  env_name: string;
}

export class StorageStack extends cdk.Stack {
  public readonly imagesBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  public readonly oacId: string;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const isProd = props.env_name === "production";

    // ── Origin Access Control (OAC) ────────────────────────────────────────
    // Replaces the legacy OAI. Attached to CloudFront origins in cdn.ts.
    // Signing behaviour: always sign (SigV4); no override allowed.
    const oac = new cloudfront.CfnOriginAccessControl(this, "OAC", {
      originAccessControlConfig: {
        name: `baju-kurung-oac-${props.env_name}`,
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
        description: `OAC for baju-kurung-${props.env_name}`,
      },
    });
    this.oacId = oac.attrId;

    // ── Product Images Bucket ──────────────────────────────────────────────
    // Stores product photos and proof photos uploaded by the Seller.
    // Not publicly accessible — served exclusively via CloudFront.
    // Pre-signed PUT URLs are used for Seller uploads from the frontend.
    this.imagesBucket = new s3.Bucket(this, "ImagesBucket", {
      bucketName: `baju-kurung-images-${props.env_name}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: isProd, // versioning in production for accidental-delete recovery
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [
        {
          // Allow browsers to GET images via CloudFront (and direct CDN paths)
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
        {
          // Allow the frontend origin to PUT via pre-signed URLs (Seller uploads)
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [
            "http://localhost:5173", // local dev
            `https://baju-kurung-${props.env_name}.example.com`, // replace with real domain
          ],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3600,
        },
      ],
    });

    // Grant CloudFront service principal read access via OAC.
    // Condition scoped to this AWS account; tighten to distribution ARN in cdn.ts
    // by calling imagesBucket.addToResourcePolicy() with the distribution ARN condition.
    this.imagesBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontOACRead",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [`${this.imagesBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            "AWS:SourceAccount": this.account,
          },
        },
      })
    );

    // ── Frontend Assets Bucket ─────────────────────────────────────────────
    // Hosts the React SPA static files.
    // Served exclusively via CloudFront — no direct S3 access.
    // No CORS needed: CloudFront handles all origin concerns.
    this.frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `baju-kurung-frontend-${props.env_name}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // Grant CloudFront service principal read access via OAC.
    this.frontendBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontOACRead",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [`${this.frontendBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            "AWS:SourceAccount": this.account,
          },
        },
      })
    );

    // ── Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "ImagesBucketName", {
      value: this.imagesBucket.bucketName,
      exportName: `baju-kurung-images-bucket-name-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "ImagesBucketArn", {
      value: this.imagesBucket.bucketArn,
      exportName: `baju-kurung-images-bucket-arn-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "FrontendBucketName", {
      value: this.frontendBucket.bucketName,
      exportName: `baju-kurung-frontend-bucket-name-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "FrontendBucketArn", {
      value: this.frontendBucket.bucketArn,
      exportName: `baju-kurung-frontend-bucket-arn-${props.env_name}`,
    });

    new cdk.CfnOutput(this, "OACId", {
      value: this.oacId,
      exportName: `baju-kurung-oac-id-${props.env_name}`,
      description: "OAC ID — attach to S3 origins in the CloudFront distribution (cdn.ts)",
    });
  }
}
