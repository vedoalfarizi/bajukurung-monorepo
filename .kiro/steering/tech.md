# Tech Stack

## Architecture

Serverless AWS — all backend compute runs in Lambda, no servers to manage.

## Frontend

- **Framework**: React (TypeScript) — Vite SPA
- **State Management**: Zustand (cart store, backed by localStorage)
- **Language**: TypeScript
- **Testing**: Vitest + fast-check (property-based testing)
- **Linting**: ESLint

## Backend

- **Runtime**: Node.js / TypeScript — AWS Lambda functions
- **API**: Amazon API Gateway (REST)
- **Database**: Amazon DynamoDB (single-table design)
- **Storage**: Amazon S3 (product images, proof photos, frontend assets)
- **Auth**: Amazon Cognito (Seller-only — Cognito Authorizer on protected routes)
- **CDN**: Amazon CloudFront (frontend + product images)
- **Logging**: Amazon CloudWatch Logs
- **IaC**: AWS CDK or CloudFormation

## Testing Libraries

- **fast-check**: Property-based testing (PBT) — minimum 100 iterations per property test
- **Vitest**: Unit and integration tests

## Common Commands

```bash
# Install dependencies (run from repo root)
npm install

# Run all tests (frontend)
cd frontend && npx vitest run

# Run all tests (backend)
cd backend && npx vitest run

# Build frontend
cd frontend && npm run build

# Deploy infrastructure (CDK)
cd infra && npx cdk deploy --all

# Deploy to staging
cd infra && npx cdk deploy --all --context env=staging

# Deploy to production
cd infra && npx cdk deploy --all --context env=production
```

## Environments

- Two environments: `staging` and `production`
- Implemented as separate AWS accounts or CloudFormation stack namespaces
- DynamoDB table name pattern: `baju-kurung-{env}`
