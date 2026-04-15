import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface StorageStackProps extends cdk.StackProps {
  env_name: string;
}

export class StorageStack extends cdk.Stack {
  public readonly imagesBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  public readonly cloudfrontOAI: cloudfront.OriginAccessIdentity;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const isProd = props.env_name === "production";

    // CloudFront Origin Access Identity — shared by both buckets
    this.cloudfrontOAI = new cloudfront.OriginAccessIdentity(
      this,
      "CloudFrontOAI",
      {
        comment: `baju-kurung-${props.env_name} OAI`,
      }
    );

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
            "https://localhost:5173", // local dev
            `https://baju-kurung-${props.env_name}.example.com`, // replace with real domain
          ],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3600,
        },
      ],
    });

    // Grant CloudFront OAI read access to the images bucket
    this.imagesBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontOAIRead",
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.CanonicalUserPrincipal(
            this.cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
        actions: ["s3:GetObject"],
        resources: [`${this.imagesBucket.bucketArn}/*`],
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

    // Grant CloudFront OAI read access to the frontend bucket
    this.frontendBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontOAIRead",
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.CanonicalUserPrincipal(
            this.cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
        actions: ["s3:GetObject"],
        resources: [`${this.frontendBucket.bucketArn}/*`],
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

    new cdk.CfnOutput(this, "CloudFrontOAIId", {
      value: this.cloudfrontOAI.originAccessIdentityId,
      exportName: `baju-kurung-cloudfront-oai-id-${props.env_name}`,
    });
  }
}
