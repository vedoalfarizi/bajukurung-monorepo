import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface AuthStackProps extends cdk.StackProps {
  env_name: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly hostedUiUrl: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const isProd = props.env_name === "production";

    // ── Cognito User Pool ──────────────────────────────────────────────────
    // Seller-only: self sign-up is disabled.
    // Email is the sign-in alias; the Seller account is created by the admin.
    this.userPool = new cognito.UserPool(this, "SellerUserPool", {
      userPoolName: `baju-kurung-seller-${props.env_name}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // ── Hosted UI Domain ───────────────────────────────────────────────────
    // Domain prefix: baju-kurung-seller-{env}
    // Full URL: https://baju-kurung-seller-{env}.auth.{region}.amazoncognito.com
    const domain = this.userPool.addDomain("HostedUiDomain", {
      cognitoDomain: {
        domainPrefix: `baju-kurung-seller-${props.env_name}`,
      },
    });

    // ── User Pool Client ───────────────────────────────────────────────────
    // Configured for the hosted UI with OAuth 2.0 authorization_code and
    // implicit flows. Callback/logout URLs use placeholder values until
    // CloudFront is set up in task 3.3.
    this.userPoolClient = new cognito.UserPoolClient(
      this,
      "SellerUserPoolClient",
      {
        userPool: this.userPool,
        userPoolClientName: `baju-kurung-seller-client-${props.env_name}`,
        generateSecret: false, // SPA — no client secret
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
            implicitCodeGrant: true,
          },
          scopes: [
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.PROFILE,
          ],
          // Placeholder URLs — update with real CloudFront domain after task 3.3
          callbackUrls: [
            "https://example.com/callback",
            "http://localhost:5173/callback", // local dev
          ],
          logoutUrls: [
            "https://example.com/logout",
            "http://localhost:5173/logout", // local dev
          ],
        },
        supportedIdentityProviders: [
          cognito.UserPoolClientIdentityProvider.COGNITO,
        ],
        authFlows: {
          userSrp: true,
        },
        accessTokenValidity: cdk.Duration.hours(1),
        idTokenValidity: cdk.Duration.hours(1),
        refreshTokenValidity: cdk.Duration.days(30),
      }
    );

    // Construct the hosted UI base URL for outputs
    this.hostedUiUrl = `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`;

    // ── Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      exportName: `baju-kurung-user-pool-id-${props.env_name}`,
      description: "Cognito User Pool ID for Seller authentication",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      exportName: `baju-kurung-user-pool-client-id-${props.env_name}`,
      description: "Cognito User Pool Client ID for the hosted UI",
    });

    new cdk.CfnOutput(this, "HostedUiUrl", {
      value: this.hostedUiUrl,
      exportName: `baju-kurung-hosted-ui-url-${props.env_name}`,
      description: "Cognito hosted UI base URL — append /login?client_id=...&response_type=code&redirect_uri=... to use",
    });

    new cdk.CfnOutput(this, "HostedUiLoginUrl", {
      value: domain.signInUrl(this.userPoolClient, {
        redirectUri: "https://example.com/callback",
      }),
      exportName: `baju-kurung-hosted-ui-login-url-${props.env_name}`,
      description: "Direct login URL (placeholder redirect — update after task 3.3)",
    });
  }
}
