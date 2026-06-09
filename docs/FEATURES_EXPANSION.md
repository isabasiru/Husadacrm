# Husada CRM — Features Expansion Documentation

This document describes the design, implementation, and usage of the newly added features in Husada CRM.

---

## 1. 🔔 Assign Notification (via WAHA)
When an agent or admin is assigned to a contact, an automated notification is sent to their registered WhatsApp number using the WAHA engine.

### Implementation Details:
* **User Schema**: Added `whatsappNumber` field (`whatsapp_number` column in DB) to store agent WhatsApp numbers.
* **Notification Flow**:
  1. Triggered on POST request to `/api/contacts/[id]/assign`.
  2. The server updates the assigned agent ID.
  3. A background task constructs a WhatsApp notification template:
     `🔔 Anda ditugaskan oleh [Assigner] untuk handle chat dengan [Patient Name]. Silakan cek CRM untuk detail.`
  4. The notification is sent via `sendWahaMessage(to, message)` to the agent's WhatsApp number.

### How to Use:
1. Go to **Settings** → **Users**.
2. Edit or add a user, and fill in the **Nomor WhatsApp** field in international format (e.g., `628123456789`).
3. When another admin assigns a lead to this user, they will receive a WhatsApp notification automatically.

---

## 2. 👥 My Leads View
Agents can filter leads to show only the ones they are assigned to, keeping their workflow focused.

### Implementation Details:
* **Query Parameters**: Added support for `myLeads=true` in `/api/contacts` API.
* **Dashboard Filter**: Added a toggle switch in the Leads view: **Semua Leads** vs **My Leads**.
* **Role Enforcement**:
  * `AGENT` users only see their own assigned leads.
  * `ADMIN` and `SUPER_ADMIN` users can toggle between all leads and their own leads.
* **UI Summary Cards**: Shows leads breakdown by stage (Baru, Prospect, Deal, Closed) dynamically matching the active filter.

---

## 3. 📦 Product Management
Enables the administration of medical products/services available at Husada.

### Features:
* **Product Schema**: Added the `Product` model with fields: `id`, `name`, `description`, `category`, `isActive`, `sortOrder`.
* **Contact Association**: Each contact can be associated with an `interestedProductId` (`Product` relation).
* **Settings Management Panel**: Added a dedicated **Products** tab under Settings where admins can Create, Read, Update, and Delete (soft delete via `isActive = false`) products.

---

## 4. 📥 Import & Export Leads
Allows uploading bulk leads and exporting current databases to Excel worksheets.

### Import Leads:
* **Endpoint**: `/api/contacts/import`
* **Format**: Supports `.xlsx` and `.csv` files.
* **Data Cleansing**: Cleans and normalizes phone numbers (converts to `62xxx` format), validates duplicates, and skips invalid records.
* **Chatbot Bypass**: Seeded/imported contacts automatically have `chatbotState = 'done'` to avoid triggering the automated chatbot flow.
* **Initial Seed**: Loaded 50 initial leads from `Copy of REZUM TALCO.xlsx`.

### Export Leads:
* **Endpoint**: `/api/contacts/export`
* **Features**: Exports the list of contacts to a downloadable Excel sheet, matching current search, stage, or assignment filters in real-time.
