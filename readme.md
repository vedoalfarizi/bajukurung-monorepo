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
