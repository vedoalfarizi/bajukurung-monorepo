# Baju Kurung E-Commerce MVP

A serverless e-commerce platform for selling Malaysian Baju Kurung (traditional Malay attire) to Indonesian customers via a pre-order workflow.

Customers browse products by occasion (Raya, Wedding, Casual), select a size, and add items to a client-side cart. No account or login required — checkout generates a pre-filled WhatsApp message sent directly to the Seller. The Seller manages orders through a Cognito-authenticated dashboard.

## Tech Stack

- **Frontend**: React + TypeScript (Vite SPA), Zustand for cart state
- **Backend**: Node.js/TypeScript AWS Lambda functions
- **Database**: Amazon DynamoDB (single-table design)
- **Storage**: Amazon S3 (product images, proof photos)
- **Auth**: Amazon Cognito (Seller-only)
- **CDN**: Amazon CloudFront
- **IaC**: AWS CDK

## Project Structure

```
├── frontend/   # React/Vite SPA
├── backend/    # Lambda functions (Product Service, Order Service)
├── shared/     # Shared TypeScript types
└── infra/      # AWS CDK stacks
```

## Getting Started

### Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI: `npm install -g aws-cdk`

### Install dependencies

```bash
npm install
```

### Run the frontend locally

```bash
cd frontend && npm run dev
```

The app will be available at `http://localhost:5173`. You'll need the backend deployed (or a local mock) for API calls to work.

### Run tests

```bash
# Backend tests
npm run test:backend

# Frontend tests
npm run test:frontend
```

### Build the frontend

```bash
npm run build:frontend
```

## Deployment

### Deploy to staging

```bash
cd infra && npx cdk deploy --all --context env=staging
```

### Deploy to production

```bash
cd infra && npx cdk deploy --all --context env=production
```

This provisions all AWS resources: DynamoDB table, S3 buckets, Lambda functions, API Gateway, Cognito User Pool, and CloudFront distribution.

## Environment Variables

The frontend reads from a `.env` file. Copy the example and fill in your deployed values:

```bash
cp frontend/.env.example frontend/.env
```

Key variables:

| Variable | Description |
|---|---|
| `VITE_API_URL` | API Gateway base URL |
| `VITE_COGNITO_*` | Cognito User Pool config for Seller login |
| `VITE_SELLER_WHATSAPP` | Seller's WhatsApp number for order messages |

## Request Flow Example: Browsing the Catalogue

Here's how a `GET /products?occasion=Raya` request travels through the system end-to-end.

```
Browser (React SPA)
  │
  │  1. User selects "Raya" tab on CataloguePage
  │     → fetch("https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/prod/products?occasion=Raya")
  │
  ▼
Amazon CloudFront
  │  (API calls pass through; static assets are served directly from S3)
  │
  ▼
Amazon API Gateway (REST)
  │  2. Matches GET /products route (public — no Cognito Authorizer)
  │     → forwards event to Product Service Lambda
  │
  ▼
Product Service Lambda (backend/src/product/index.ts)
  │  3. Reads occasion="Raya" from queryStringParameters
  │  4. Queries DynamoDB GSI1 (PK=occasion, SK=preOrderWindowEnd >= today)
  │  5. Filters results where preOrderWindowStart <= today (window open)
  │  6. Shapes response — returns only catalogue fields:
  │     productId, name, occasion, availableSizes, priceIDR,
  │     primaryImageKey, preOrderWindowStart, preOrderWindowEnd
  │
  ▼
Amazon DynamoDB
  │  7. Returns matching Product items from the baju-kurung-{env} table
  │
  ▼
Product Service Lambda
  │  8. Returns HTTP 200 with JSON array of products
  │     On unhandled error → logs to CloudWatch, returns 500 INTERNAL_ERROR
  │
  ▼
API Gateway → Browser (React SPA)
     9. CataloguePage renders product cards from the response
```

**Error cases handled along the way:**
- Invalid `occasion` value → Lambda returns `400 VALIDATION_ERROR` before hitting DynamoDB
- No matching products → Lambda returns `200` with an empty array; UI shows "no results" message
- Unhandled Lambda exception → logged to CloudWatch with `requestId`, `path`, and `method`; client receives `500 INTERNAL_ERROR` (no stack trace exposed)
