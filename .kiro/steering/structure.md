# Project Structure

```
/
├── frontend/               # React/TypeScript Vite SPA
│   ├── src/
│   │   ├── components/     # Reusable UI components (SizeChartTable, CartDrawer, etc.)
│   │   ├── pages/          # Route-level pages (CataloguePage, ProductDetailPage, SellerDashboard)
│   │   ├── store/          # Zustand stores (cartStore — localStorage-backed)
│   │   ├── utils/          # Pure utility functions (WhatsApp message generators)
│   │   └── types/          # Shared TypeScript types (re-exported from shared/)
│   └── vite.config.ts
│
├── backend/                # Node.js/TypeScript Lambda functions
│   ├── src/
│   │   ├── product/        # Product Service Lambda handler + business logic
│   │   ├── order/          # Order Service Lambda handler + state machine
│   │   └── shared/         # Shared utilities (error responses, DynamoDB client, etc.)
│   └── tsconfig.json
│
├── shared/                 # Shared TypeScript types used by both workspaces
│   └── types.ts            # StandardSize, Occasion, OrderStatus, Product, Order, CartItem, etc.
│
├── infra/                  # AWS CDK or CloudFormation IaC
│   ├── stacks/
│   │   ├── database.ts     # DynamoDB table + GSIs
│   │   ├── storage.ts      # S3 buckets (images, frontend assets)
│   │   ├── api.ts          # API Gateway + Lambda functions + Cognito Authorizer
│   │   ├── auth.ts         # Cognito User Pool
│   │   └── cdn.ts          # CloudFront distribution
│   └── cdk.json
│
└── .kiro/
    ├── specs/              # Spec-driven development documents
    └── steering/           # AI assistant guidance files
```

## Key Conventions

- **Monorepo**: `frontend/`, `backend/`, `shared/`, `infra/` are separate workspaces under one repo root
- **Single DynamoDB table**: All entities (Products, Orders, Status History) share one table — `baju-kurung-{env}`
  - Keys use prefixes: `PRODUCT#<uuid>`, `ORDER#<uuid>`
  - Sort keys: `METADATA` for main records, `STATUS#<timestamp>` for history items
  - GSI1: `occasion` + `preOrderWindowEnd` (catalogue queries)
  - GSI2: `entityType` + `createdAt` (list all orders)
  - GSI3: `status` + `createdAt` (filter orders by status)
- **Public vs protected routes**: `GET /products*` and `POST /orders` are public; all other write endpoints require Cognito JWT
- **Cart state**: Lives entirely in browser localStorage — no server-side session for customers
- **Error responses**: All Lambda errors return `{ "error": { "code": "...", "message": "..." } }` — no stack traces exposed
- **Property test tags**: `Feature: baju-kurung-ecommerce-mvp, Property {N}: {property_text}`
