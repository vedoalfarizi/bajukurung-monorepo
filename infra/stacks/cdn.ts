import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface CdnStackProps extends cdk.StackProps {
  env_name: string;
  frontendBucket: s3.Bucket;
  imagesBucket: s3.Bucket;
}

export class CdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    // ── Cache Policies ─────────────────────────────────────────────────────

    // HTML: short TTL (5 min) — ensures customers get fresh index.html after deploys
    const htmlCachePolicy = new cloudfront.CachePolicy(this, "HtmlCachePolicy", {
      cachePolicyName: `baju-kurung-html-${props.env_name}`,
      comment: "Short TTL for HTML — SPA index.html",
      defaultTtl: cdk.Duration.minutes(5),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.minutes(10),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Static assets (JS/CSS/fonts): long TTL — cache-busting via content hash in filenames
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, "StaticAssetsCachePolicy", {
      cachePolicyName: `baju-kurung-static-${props.env_name}`,
      comment: "Long TTL for hashed JS/CSS/font assets",
      defaultTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Product images: long TTL — images are immutable once uploaded
    const imagesCachePolicy = new cloudfront.CachePolicy(this, "ImagesCachePolicy", {
      cachePolicyName: `baju-kurung-images-${props.env_name}`,
      comment: "Long TTL for product images",
      defaultTtl: cdk.Duration.days(30),
      minTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // ── S3 Origins ─────────────────────────────────────────────────────────
    // originAccessLevels: [] disables CDK's automatic bucket policy injection,
    // preventing a cross-stack dependency cycle. Bucket policies granting
    // CloudFront OAC read access are already defined in storage.ts.
    const frontendOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      props.frontendBucket,
      { originAccessLevels: [] },
    );

    const imagesOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      props.imagesBucket,
      { originAccessLevels: [] },
    );

    // ── CloudFront Distribution ────────────────────────────────────────────
    // Default origin: frontend S3 bucket (SPA)
    // /images/* origin: product images S3 bucket
    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `Baju Kurung CDN (${props.env_name})`,
      // Default behaviour — frontend SPA (HTML with short TTL)
      defaultBehavior: {
        origin: frontendOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: htmlCachePolicy,
        compress: true,
      },
      additionalBehaviors: {
        // Hashed static assets — long TTL (cache-busting via content hash filenames)
        "*.js": {
          origin: frontendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: true,
        },
        "*.css": {
          origin: frontendOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: staticAssetsCachePolicy,
          compress: true,
        },
        // Product images — served from images bucket under /images/*
        "images/*": {
          origin: imagesOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: imagesCachePolicy,
          compress: true,
        },
      },
      // SPA routing: 403/404 from S3 → serve index.html with 200
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
      // Optimise for Asia Pacific (Indonesian customers)
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // ── Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: this.distribution.distributionDomainName,
      exportName: `baju-kurung-cdn-domain-${props.env_name}`,
      description: "CloudFront distribution domain name",
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
      exportName: `baju-kurung-cdn-distribution-id-${props.env_name}`,
      description: "CloudFront distribution ID",
    });

    new cdk.CfnOutput(this, "FrontendUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
      exportName: `baju-kurung-frontend-url-${props.env_name}`,
      description: "Frontend SPA URL via CloudFront",
    });
  }
}
