# Hierarchical Products Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Products and Sub-products (parent-child hierarchy) in the database, Settings panel, and expand the onboarding Chatbot to dynamically guide patients through categories and sub-products.

**Architecture:** We will modify the `Product` Prisma model to support a self-relation (`parentId` pointing to another `Product`). The settings panel will be updated to allow assigning a parent category to a product, and the Chatbot flow will be expanded to support nested selection steps.

**Tech Stack:** Next.js 15, Prisma (PostgreSQL), Tailwind CSS, TypeScript.

---

### Task 1: Database Schema Expansion

**Files:**
* Modify: [schema.prisma](file:///e:/webhaus/infra/clients/husada-crm/prisma/schema.prisma)

**Step 1: Add self-relation to Product model**
Edit the `Product` model in `schema.prisma` to add:
```prisma
model Product {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String    @db.VarChar(255)
  description String?   @db.Text
  category    String?   @db.VarChar(100)
  isActive    Boolean   @default(true) @map("is_active")
  sortOrder   Int       @default(0) @map("sort_order")
  parentId    String?   @map("parent_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamp()
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamp()

  // Self relation for parent-child products
  parent      Product?   @relation("ProductHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  subProducts Product[]  @relation("ProductHierarchy")
  contacts    Contact[]

  @@map("products")
}
```

**Step 2: Generate Prisma Client & Run Migration**
Run: `npx prisma db push`
Expected: Database schema updated successfully.

---

### Task 2: Backend API Updates

**Files:**
* Modify: [route.ts](file:///e:/webhaus/infra/clients/husada-crm/src/app/api/products/route.ts)
* Modify: [[id]/route.ts](file:///e:/webhaus/infra/clients/husada-crm/src/app/api/products/%5Bid%5D/route.ts)

**Step 1: Update GET /api/products**
* Retrieve products including their parent relationship or sub-products:
```typescript
const products = await prisma.product.findMany({
  where: { isActive: true },
  include: { subProducts: true, parent: true },
  orderBy: { sortOrder: 'asc' }
});
```

**Step 2: Update POST /api/products & PATCH /api/products/[id]**
* Handle incoming `parentId` from the request body to link child products to parent categories.

---

### Task 3: Chatbot Interactive Sub-Product Flow

**Files:**
* Modify: [chatbot.ts](file:///e:/webhaus/infra/clients/husada-crm/src/lib/chatbot.ts)

**Step 1: Update Onboarding State Machine**
Expand `chatbotState` options:
* `ask_product_parent`: Lists only parent products/categories (e.g., "1. Skincare", "2. Konsultasi Dokter").
* `ask_product_child`: If a parent category has sub-products, lists them (e.g., "1. Facial Wash", "2. Sunscreen SPF 50").
* `ask_name`: Gathers patient's name.

**Step 2: Implement dynamic listing logic**
* Greet the user with a list of main categories (parent products).
* When the user selects a category, check if it has sub-products:
  * If YES: Transition state to `ask_product_child` and send the sub-products menu list.
  * If NO: Link product directly, transition to `ask_name`.

---

### Task 4: Settings UI - Product & Category Panel

**Files:**
* Modify: [products-panel.tsx](file:///e:/webhaus/infra/clients/husada-crm/src/components/settings/products-panel.tsx)

**Step 1: Add Parent selector to Add/Edit Product Modal**
* Render a dropdown selector listing all active products that do not have a parent (potential parent categories).
* Send `parentId` when saving a new product or category.

**Step 2: Render Nested Categories in Products List**
* Display child products indented underneath their parent categories with visual guidelines.
