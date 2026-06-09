This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Features & Documentation

### 1. Automatic Re-FollowUp
An automated patient re-engagement task runs every 30 minutes in the background, sending WhatsApp templates if a lead ignores our message for more than a configured limit (default 24 hours).
* Detail documentation is in [AUTOMATION.md](file:///e:/webhaus/infra/clients/husada-crm/docs/AUTOMATION.md)

### 2. Agent Response Speed KPI Leaderboard
Tracks individual agent performance by measuring the elapsed time between a patient's incoming message and the agent's human reply.
* Detail documentation is in [KPI.md](file:///e:/webhaus/infra/clients/husada-crm/docs/KPI.md)

### 3. WhatsApp Inbound Messages Webhook & AI Chatbot
Routes incoming patient messages from the WAHA engine to the CRM backend, mapping contacts, generating conversations, managing the automated 3-question onboarding chatbot, and triggering real-time Socket.io UI updates.
* Detail documentation is in [WEBHOOK.md](file:///e:/webhaus/infra/clients/husada-crm/docs/WEBHOOK.md)

### 4. Features Expansion
Covers Assign Notification, My Leads filtering, Product Management CRUD Settings, and Leads Import/Export.
* Detail documentation is in [FEATURES_EXPANSION.md](file:///e:/webhaus/infra/clients/husada-crm/docs/FEATURES_EXPANSION.md)

