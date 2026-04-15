# Implementation Plan: Baju Kurung E-Commerce MVP

## Overview

Incremental implementation of a serverless AWS e-commerce platform for Malaysian Baju Kurung pre-orders. Tasks are ordered to build foundational infrastructure first, then backend services, then the React frontend, wiring everything together at the end.

## Tasks

- [x] 1. Project scaffolding and shared types
  - Initialise a monorepo with two workspaces: `backend/` (Node.js/TypeScript Lambda) and `frontend/` (React/TypeScript Vite SPA)
  - Define shared TypeScript types: `StandardSize`, `Occasion`, `OrderStatus`, `Product`, `Order`, `CartItem`, `Cart`, `LineItem`, `SizeChart`
  - Configure TypeScript, ESLint, and Vitest in both workspaces
  - _Requirements: 2.1, 6.1_

- [ ] 2. AWS infrastructure — DynamoDB, S3, IAM, CloudWatch
  - [x] 2.1 Define DynamoDB single table with GSI1 (occasion + preOrderWindowEnd), GSI2 (entityType + createdAt), GSI3 (status + createdAt)
    - Use AWS CDK or CloudFormation; parameterise table name as `baju-kurung-{env}`
    - _Requirements: 6.3_
  - [ ] 2.2 Define S3 buckets for product images and frontend assets; configure CORS and bucket policies
    - _Requirements: 6.4, 0.3_
  - [ ] 2.3 Define IAM roles with least-privilege policies for Product Lambda and Order Lambda
    - _Requirements: 6.8_
  - [ ] 2.4 Configure CloudWatch log groups for both Lambda functions
    - _Requirements: 6.7_

- [ ] 3. AWS infrastructure — API Gateway, Cognito, CloudFront
  - [ ] 3.1 Define Amazon Cognito User Pool for Seller authentication; configure hosted UI
    - _Requirements: 6.6_
  - [ ] 3.2 Define REST API Gateway with Cognito Authorizer; wire public and protected routes
    - _Requirements: 6.2, 6.6_
  - [ ] 3.3 Define CloudFront distribution serving frontend S3 bucket and product images S3 bucket
    - _Requirements: 6.5_
  - [ ] 3.4 Add staging and production stack namespaces (separate environments)
    - _Requirements: 6.9_

- [ ] 4. Product Service Lambda — core CRUD
  - [ ] 4.1 Implement `POST /products` handler: validate required fields, write Product item to DynamoDB, return `productId`
    - Validate: name, occasion, description, fabricType, colours, availableSizes, sizeChart (bust/waist/hip per size), priceIDR, imageKeys, preOrderWindowStart, preOrderWindowEnd
    - Return `400 VALIDATION_ERROR` for missing fields; `400 INCOMPLETE_SIZE_CHART` if sizeChart missing entry for any availableSize
    - Require Cognito JWT (enforced by API Gateway Authorizer)
    - _Requirements: 0.1, 0.2, 0.4, 0.5_
  - [ ]* 4.2 Write property test for product creation round-trip (Property 5b)
    - **Property 5b: Product creation round-trip preserves all fields**
    - **Validates: Requirements 0.2, 0.4**
  - [ ] 4.3 Implement `GET /products` handler: query GSI1 by occasion, filter by open Pre-Order Window (start ≤ today ≤ end), support optional `?size=` filter
    - Return only products with open Pre-Order Window
    - _Requirements: 1.2, 1.3, 1.5, 0.6_
  - [ ]* 4.4 Write property test for catalogue occasion + window filter (Property 1)
    - **Property 1: Catalogue filters by occasion and open Pre-Order Window**
    - **Validates: Requirements 1.2, 1.3**
  - [ ]* 4.5 Write property test for catalogue response field completeness (Property 2)
    - **Property 2: Catalogue response contains all required fields**
    - **Validates: Requirements 1.4**
  - [ ]* 4.6 Write property test for size filter correctness (Property 3)
    - **Property 3: Size filter returns only matching products**
    - **Validates: Requirements 1.5**
  - [ ] 4.7 Implement `GET /products/{productId}` handler: fetch product by PK, return full detail including sizeChart
    - Return `404 PRODUCT_NOT_FOUND` if not found
    - _Requirements: 1.6, 2.2, 2.3_
  - [ ]* 4.8 Write property test for product detail field completeness (Property 4)
    - **Property 4: Product detail response contains all required fields**
    - **Validates: Requirements 1.6, 2.2**
  - [ ]* 4.9 Write property test for per-product size chart completeness (Property 5)
    - **Property 5: Per-product size chart covers all available sizes**
    - **Validates: Requirements 2.2, 2.3, 0.4**
  - [ ]* 4.10 Write unit tests for Product Service Lambda
    - Test validation errors for missing required fields
    - Test `INCOMPLETE_SIZE_CHART` error
    - Test Pre-Order Window open/closed boundary conditions
    - _Requirements: 0.5, 1.2_

- [ ] 5. Checkpoint — Product Service
  - Ensure all Product Service tests pass, ask the user if questions arise.

- [ ] 6. Order Service Lambda — order creation and retrieval
  - [ ] 6.1 Implement `POST /orders` handler (public, no auth): validate customerName, customerWhatsApp, and non-empty lineItems; write Order item to DynamoDB with status `PENDING`; return `orderId`
    - _Requirements: 3.4, 4.5, 4.9, 4.10_
  - [ ]* 6.2 Write property test for checkout order round-trip (Property 8)
    - **Property 8: Checkout creates an order that preserves cart contents**
    - **Validates: Requirements 3.4, 4.5, 4.9, 4.10**
  - [ ] 6.3 Implement `GET /orders` handler (Seller JWT): query GSI2 for all orders sorted by createdAt; support optional `?status=` filter via GSI3
    - _Requirements: 5.2, 5.3_
  - [ ]* 6.4 Write property test for order list field completeness (Property 13)
    - **Property 13: Order list response contains all required fields for every order**
    - **Validates: Requirements 5.2**
  - [ ]* 6.5 Write property test for order status filter (Property 14)
    - **Property 14: Order status filter returns only matching orders**
    - **Validates: Requirements 5.3**
  - [ ] 6.6 Implement `GET /orders/{orderId}` handler (Seller JWT): fetch order by PK, return full detail
    - _Requirements: 5.11_
  - [ ]* 6.7 Write property test for order detail field completeness (Property 15)
    - **Property 15: Order detail response contains all required fields**
    - **Validates: Requirements 5.7**

- [ ] 7. Order Service Lambda — status transitions
  - [ ] 7.1 Implement order status state machine: define valid transitions and required fields per transition; reject invalid transitions with `400 INVALID_STATUS_TRANSITION`
    - Valid transitions: PENDING→PAYMENT_PENDING, PAYMENT_PENDING→PACKAGED, PACKAGED→READY_TO_SHIP, READY_TO_SHIP→SHIPPED, SHIPPED→DELIVERED, PENDING→CANCELLED, PAYMENT_PENDING→CANCELLED, PACKAGED→REFUND, SHIPPED→REFUND, DELIVERED→REFUND
    - _Requirements: 3.5, 5.10_
  - [ ]* 7.2 Write property test for valid status transitions (Property 9)
    - **Property 9: Valid order status transitions succeed and update status**
    - **Validates: Requirements 3.5**
  - [ ]* 7.3 Write property test for invalid status transitions rejected (Property 9b)
    - **Property 9b: Invalid order status transitions are rejected**
    - **Validates: Requirements 5.10**
  - [ ]* 7.4 Write property test for missing required fields rejected (Property 9c)
    - **Property 9c: Status transitions with missing required fields are rejected**
    - **Validates: Requirements 5.5, 5.6, 5.8**
  - [ ] 7.5 Implement `PATCH /orders/{orderId}` handler (Seller JWT): apply state machine, write updated Order item and a STATUS# history item to DynamoDB; return updated order and copyable WhatsApp message where applicable
    - On PAYMENT_PENDING: allow line item edits, generate order summary copyable message
    - On SHIPPED: require trackingLink, generate tracking copyable message
    - On PACKAGED: require proofOfPaymentKey
    - On REFUND: require refundAmountIDR and proofOfRefundKey
    - _Requirements: 3.5, 3.6, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_
  - [ ]* 7.6 Write property test for status history timestamp (Property 10)
    - **Property 10: Every status update produces a timestamped history record**
    - **Validates: Requirements 3.6, 5.9**
  - [ ] 7.7 Implement `POST /orders/{orderId}/uploads` handler (Seller JWT): generate and return a pre-signed S3 URL for proof photo upload
    - _Requirements: 5.5, 5.7, 5.8_

- [ ] 8. Checkpoint — Order Service
  - Ensure all Order Service tests pass, ask the user if questions arise.

- [ ] 9. WhatsApp message generators (frontend utilities)
  - [ ] 9.1 Implement `generateOrderIntentLink(cart, customerName, orderId, sellerPhone): string`
    - Returns `https://wa.me/{sellerPhone}?text={urlEncodedMessage}` with Bahasa Indonesia message body
    - _Requirements: 4.5, 4.6_
  - [ ]* 9.2 Write property test for customer order intent message (Property 12)
    - **Property 12: Customer order intent message contains all required information**
    - **Validates: Requirements 4.5, 4.6**
  - [ ] 9.3 Implement `generateOrderSummaryMessage(order): string`
    - Returns Bahasa Indonesia copyable text for PAYMENT_PENDING transition
    - _Requirements: 5.4_
  - [ ]* 9.4 Write property test for order summary copyable message (Property 12b)
    - **Property 12b: Order summary copyable message contains all required fields**
    - **Validates: Requirements 5.4**
  - [ ] 9.5 Implement `generateTrackingMessage(order): string`
    - Returns Bahasa Indonesia copyable text for SHIPPED transition
    - _Requirements: 5.6_
  - [ ]* 9.6 Write property test for tracking link copyable message (Property 12c)
    - **Property 12c: Tracking link copyable message contains all required fields**
    - **Validates: Requirements 5.6**

- [ ] 10. Frontend — cart store
  - [ ] 10.1 Implement `cartStore` using Zustand backed by localStorage: add item (with size validation and Pre-Order Window guard), remove item, update quantity, clear cart
    - Guard: reject add if preOrderWindowEnd < today (display toast)
    - Guard: reject add if size not in product's availableSizes
    - Guard: reject checkout if cart is empty
    - _Requirements: 2.4, 2.6, 3.2, 3.3, 4.1, 4.4, 4.8_
  - [ ]* 10.2 Write property test for cart subtotal invariant (Property 11)
    - **Property 11: Cart subtotal equals sum of all line item totals**
    - **Validates: Requirements 4.2, 4.3, 4.4**
  - [ ]* 10.3 Write property test for open window add-to-cart (Property 7)
    - **Property 7: Products with open Pre-Order Windows can be added to cart**
    - **Validates: Requirements 3.2, 4.1**
  - [ ]* 10.4 Write unit tests for cart store
    - Test add/remove/update, subtotal recalculation, expired window guard, missing size guard, empty cart guard
    - _Requirements: 2.6, 3.3, 4.8_

- [ ] 11. Frontend — product browsing pages
  - [ ] 11.1 Implement `CataloguePage`: fetch `GET /products?occasion=`, render product cards (name, primary image, price in IDR, available sizes, Pre-Order Window dates); support occasion tabs and size filter; show "no results" message when empty
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.7_
  - [ ]* 11.2 Write property test for available sizes constraint in size selector (Property 6)
    - **Property 6: Only available sizes are selectable for a product**
    - **Validates: Requirements 2.4**
  - [ ] 11.3 Implement `ProductDetailPage`: fetch `GET /products/{productId}`, render all images, full description, fabric, colours, `SizeChartTable`, price, Pre-Order Window; wire add-to-cart with size selection validation
    - Display AllSize note when applicable; auto-select AllSize for AllSize-only products
    - _Requirements: 1.6, 2.3, 2.4, 2.5, 2.6_
  - [ ] 11.4 Implement `SizeChartTable`: render bust/waist/hip ranges per Standard Size from product's sizeChart; include AllSize descriptive note
    - _Requirements: 2.3_

- [ ] 12. Frontend — cart and checkout
  - [ ] 12.1 Implement `CartDrawer`: display line items (name, size, quantity, unit price, line total), cart subtotal in IDR, remove item action
    - _Requirements: 4.2, 4.3, 4.4_
  - [ ] 12.2 Implement `CheckoutModal`: collect customerName and customerWhatsApp; validate non-empty; call `POST /orders`; on success call `generateOrderIntentLink()` and open WhatsApp deep link; handle API errors with toast + retry
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9_

- [ ] 13. Frontend — Seller dashboard
  - [ ] 13.1 Implement Cognito-gated login flow: redirect unauthenticated users to Cognito hosted UI; store JWT; attach `Authorization: Bearer {jwt}` to all dashboard API calls
    - _Requirements: 0.1, 5.1, 6.6_
  - [ ] 13.2 Implement `SellerDashboard` order list: fetch `GET /orders`, display orderId, status, customerName, customerWhatsApp, line items, totalPriceIDR, createdAt; support status filter tabs
    - _Requirements: 5.2, 5.3_
  - [ ] 13.3 Implement order detail view and status transition UI: render current status, all order fields, proof photos, tracking link, refund amount; render action button for each valid next status; collect required fields per transition (proof photo upload via pre-signed URL, tracking link input, refund amount input); display copyable WhatsApp message blocks for PAYMENT_PENDING and SHIPPED transitions; show error on invalid transition attempt
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8, 5.10, 5.11_
  - [ ] 13.4 Implement `AddProductForm`: all required fields (name, occasion, description, fabricType, colours, availableSizes, per-size sizeChart inputs, priceIDR, image upload to S3 via pre-signed URL, preOrderWindowStart, preOrderWindowEnd); client-side validation; call `POST /products` with Seller JWT
    - _Requirements: 0.1, 0.2, 0.3, 0.4, 0.5_

- [ ] 14. Lambda error handling and CloudWatch logging
  - Wrap all Lambda handlers in a top-level try/catch; log unhandled errors to CloudWatch with requestId, path, and method; return `500 INTERNAL_ERROR` without exposing stack traces
  - _Requirements: 6.7_

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all unit, property, and integration tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations each
- Tag format for property tests: `Feature: baju-kurung-ecommerce-mvp, Property {N}: {property_text}`
- Unit tests and property tests are complementary — both should be present where marked
- Checkpoints ensure incremental validation before moving to the next phase
