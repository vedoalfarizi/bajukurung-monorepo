# Product: Baju Kurung E-Commerce MVP

A serverless e-commerce platform for selling Malaysian Baju Kurung (traditional Malay attire) to Indonesian customers via a pre-order workflow.

## Core Concept

- Customers browse products by occasion (Raya/Eid, Wedding, Casual), select a size, and add items to a client-side cart
- No customer registration or login — checkout generates a pre-filled WhatsApp message sent directly to the Seller
- The Seller manages orders through an authenticated dashboard (Cognito-gated)
- Payment is handled manually by the Seller outside the platform

## Key Domain Concepts

- **Pre-Order Window**: Products are only purchasable within a defined date range set by the Seller
- **Standard Sizes**: XS, S, M, L, XL, XXL, AllSize — each product defines its own size chart (bust/waist/hip in cm)
- **Occasions**: Raya, Wedding, Casual — every product belongs to exactly one occasion
- **Order Statuses**: `PENDING` → `PAYMENT_PENDING` → `PACKAGED` → `READY_TO_SHIP` → `SHIPPED` → `DELIVERED` (with `CANCELLED` and `REFUND` branches)
- **WhatsApp Messages**: Three message types — customer order intent (checkout), order summary (PAYMENT_PENDING), tracking link (SHIPPED)

## Target Users

- **Customers**: Indonesian buyers — UI in Bahasa Indonesia, prices in IDR (Indonesian Rupiah)
- **Seller**: Malaysian business owner managing products and orders via dashboard
