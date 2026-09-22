# Product Requirements Document — {{PROJECT_NAME}}

**Product:** {{PROJECT_NAME}}
**Version:** 1.0
**Last Updated:** YYYY-MM-DD
**Status:** Active Development

---

## 1. Product Overview

<!-- Describe what this product does, who it serves, and its core value proposition. -->

### 1.1 Target Users

- **User Type 1** — Description of this user type.
- **User Type 2** — Description of this user type.

### 1.2 Core Value Proposition

- Value point 1.
- Value point 2.

### 1.3 Language & Locale

- **Primary UI Language:** Persian (Farsi) — RTL layout throughout.
- **Locale:** `fa-IR`, Timezone: `Asia/Tehran`.
- Persian numerals and date formatting are used across the interface.

---

## 2. System Architecture Summary

| Layer         | Technology                                      |
|---------------|------------------------------------------------|
| Frontend      | Next.js 16 (App Router), React 19, Tailwind 4 |
| Backend       | Next.js Server Actions + API Routes            |
| Database      | PostgreSQL via Prisma ORM                       |
| Deployment    | Docker (standalone Next.js output)              |

---

## 3. Domain Terminology

| Term        | Meaning                                         |
|-------------|------------------------------------------------|
| **Term 1**  | Definition of term 1.                           |
| **Term 2**  | Definition of term 2.                           |

---

## 4. Modules & Features

### 4.1 Module Name

**Purpose:** Describe the module purpose.

**Features:**
- Feature 1.
- Feature 2.

---

## 5. User Flows

### 5.1 Flow Name

```
User navigates to /path
  |
  +-- Step 1
  +-- Step 2
  +-- Step 3
```

---

## 6. Data Model

### 6.1 Entity Relationship Diagram

```
+------------+       +------------+
|   Entity1  |--1:N--|   Entity2  |
+------------+       +------------+
```

### 6.2 Key Relationships

- Describe relationships between entities.

---

## 7. API Endpoints

### 7.1 REST API Routes

| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| GET    | `/api/example`        | Example endpoint         |

### 7.2 Server Actions (RPC)

| Action              | Module  | Description              |
|---------------------|---------|--------------------------|
| `exampleAction()`   | Example | Example action           |

---

## 8. UI Component System

### 8.1 Design Tokens

| Token          | Value                          |
|----------------|--------------------------------|
| Brand Color    | `#4ADE80` (Parto green)        |
| Font Family    | Yekan Bakh (Persian typeface)  |
| Theme          | Dark mode (default)            |
| Layout         | RTL                            |
| Framework      | Tailwind CSS v4 + CVA variants |

---

## 9. Non-Functional Requirements

- **Performance:** Describe performance targets.
- **Reliability:** Describe reliability expectations.
- **Scalability:** Describe scalability approach.
- **Security:** Describe security measures.

---

## 10. Roadmap

| Feature          | Priority | Notes                    |
|------------------|----------|--------------------------|
| Feature 1        | High     | Description              |
| Feature 2        | Medium   | Description              |
