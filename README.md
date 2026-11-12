# Student Payment Tracker

A full-stack web application designed to manage student enrollments, reference months, and monthly tuition payments for educational institutions, tutors, and small schools.

The system provides student record management, monthly payment tracking with automated status calculation (Paid, Pending, Overdue), bulk monthly duplication, financial summaries, and an AI-powered assistant for querying financial and student data using natural language.

---

## 🎯 Purpose and Objectives

Managing recurring tuition payments across different months often leads to spreadsheet inconsistencies, duplicate records, or untracked delays.

**Student Payment Tracker** centralizes this process with:

- Database constraints preventing duplicate payments for the same student within the same month.
- Automated financial totals (expected, collected, and outstanding amounts) per month.
- Batch duplication of monthly records from previous periods, reducing repetitive manual entry.
- Timezone-aware due date evaluations against the Brazil civil calendar (`America/Sao_Paulo`).
- An AI assistant that interprets natural language questions and retrieves information through controlled backend tools.

---

## ✨ Implemented Features

### 👨‍🎓 Student Management (`/api/students`)

- **Student Catalog:** Register and manage students with name, guardian name, and guardian email.
- **Activity Status:** Active and inactive student filtering with one-click status toggling (`is_active`).
- **Input Validation:** Payload validation with email format checks and string constraints.
- **Referential Integrity:** Deletions are restricted (`ON DELETE RESTRICT`) to prevent orphaned records in monthly rosters.

### 📅 Reference Months (`/api/months`)

- **Chronological Timeline:** Multi-year accordion view organizing months by year and month index (1–12).
- **Unique Periods:** Database-level uniqueness constraints preventing duplicate month registrations for the same year.
- **Batch Month Duplication (`/api/months/copy`):** Replicates tuition entries from an existing month into a target period within a single atomic database transaction, adjusting due dates and setting initial payment states to unpaid.
- **Full Month Deletion:** Transactional removal of an entire reference month along with its associated records.

### 💳 Tuition & Payment Records (`/api/months/:reference_id/records`)

- **Record Tracking:** Create, edit, and delete individual student tuition entries for a specific month.
- **Dynamic Payment Status:** Automatically computed based on payment flag and civil date:
  - **Paid (`Pago`):** Record marked as settled (`is_paid = true`).
  - **Pending (`Pendente`):** Unpaid record with due date today or in the future.
  - **Overdue (`Atrasado`):** Unpaid record with due date prior to today, evaluated in `America/Sao_Paulo`.
- **Quick Payment Toggle:** Instant payment status update (`PATCH /api/months/records/:id/payment`).
- **Financial Overview:** Real-time summary displaying total expected, total received, and total pending amounts for the selected month.

### 🤖 AI Assistant

An AI-powered conversational assistant integrated into the application to answer questions about student registrations and tuition payments.

**Examples of supported questions:**

- How many students are registered?
- How much money is expected this month?
- How much has been received this month?
- How many payments are overdue?
- Which students have pending payments?

**Technical implementation:**

- **LLM Integration:** Google Gemini API using the official `@google/genai` SDK.
- **Model:** Gemini 3.5 Flash-Lite.
- **API:** Google Interactions API.
- **Function Calling:** The model can request specific backend tools to retrieve information from PostgreSQL.
- **Tool Registry:** A centralized registry controls which functions the AI assistant is allowed to execute.
- **Backend Architecture:** Separation between assistant engine, provider, services, and tool execution.
- **Conversation Context:** Maintains temporary conversation history in server memory.

**Available AI tools:**

| Tool | Description |
|---|---|
| `getStudentCount` | Retrieves the total number of registered students, including active and inactive records. |
| `getMonthlyFinancialSummary` | Retrieves expected, received, and pending amounts for a reference month. |
| `getMonthlyPaymentsByStatus` | Retrieves tuition records filtered by payment status. |

**Assistant endpoint:**

`POST /api/assistant/message`

**Conversation and request protections:**

- Maximum message length of 4,000 characters.
- Rate limiting of 10 requests per minute per IP address.
- Temporary conversation expiration after 30 minutes of inactivity.
- Maximum of 20 stored messages per conversation.
- Controlled tool execution: the AI cannot execute arbitrary SQL queries or unrestricted database operations.
- Standardized error handling for AI service failures and timeouts.

> [!IMPORTANT]
> Conversation history is currently stored in application memory. It is temporary and is lost when the backend restarts or is suspended. Conversations are not permanently stored in PostgreSQL.

### 🎨 User Interface & Experience

- **Tab-Based Navigation:** Single-page interface switching between Students, Monthly Payments, and the AI Assistant.
- **Theme Support:** Dark mode and Light mode toggle with initial OS preference detection (`prefers-color-scheme`) and `localStorage` persistence.
- **Feedback:** Modals for student creation and editing, confirmation dialogs, and contextual visual badges for payment statuses.
- **AI Chat Interface:** Conversational interface with message history, loading indicators, error feedback, and Markdown response rendering.

---

## 🛠️ Tech Stack

### Frontend

- **Core:** React 19 (ESM)
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **HTTP Client:** Axios
- **Icons:** Lucide React
- **Markdown Rendering:** React Markdown and Remark GFM

### Backend

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express 4
- **Database Driver:** `pg` (node-postgres Pool, without ORM)
- **AI Integration:** Google Gemini API (`@google/genai`)
- **Request Protection:** `express-rate-limit`
- **Environment & Middleware:** `dotenv`, `cors`

### Database

- **Database Engine:** PostgreSQL (v14+ recommended)
- **Cloud Database:** Neon Serverless PostgreSQL

### AI Architecture

The AI assistant follows a controlled tool-calling architecture:

1. The user submits a natural language question through the frontend.
2. The backend receives the request and retrieves the conversation context.
3. The assistant engine sends the prompt and available tool declarations to Gemini.
4. Gemini determines whether a database query is necessary and requests an authorized tool when appropriate.
5. The backend executes the requested tool using existing application models and services.
6. The result is returned to Gemini for interpretation.
7. The assistant generates a natural language response and returns it to the frontend.

The AI model does not receive direct database access. Database operations are performed exclusively through explicitly registered backend functions.

### Deployment Architecture

- **Frontend:** Vercel (Static Single-Page Application).
- **Backend:** Render (Node.js Web Service).
- **Database:** Neon PostgreSQL (Managed cloud database with TLS/SSL).

---

## 📁 Repository Structure

```text
student-payment-tracker/
├── backend/
│   ├── src/
│   │   ├── ai/
│   │   │   ├── providers/
│   │   │   │   └── geminiProvider.js
│   │   │   ├── tools/
│   │   │   │   ├── paymentTools.js
│   │   │   │   ├── studentTools.js
│   │   │   │   └── toolRegistry.js
│   │   │   ├── assistantEngine.js
│   │   │   ├── conversationStore.js
│   │   │   ├── geminiService.js
│   │   │   └── index.js
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   ├── assistantController.js
│   │   │   ├── monthlyController.js
│   │   │   └── studentController.js
│   │   ├── middlewares/
│   │   │   ├── assistantRateLimiter.js
│   │   │   ├── errorHandler.js
│   │   │   └── notFoundHandler.js
│   │   ├── models/
│   │   │   ├── monthlyModel.js
│   │   │   └── studentModel.js
│   │   ├── routes/
│   │   │   ├── assistantRoutes.js
│   │   │   ├── monthlyRoutes.js
│   │   │   └── studentRoutes.js
│   │   ├── services/
│   │   │   ├── assistantService.js
│   │   │   ├── monthlyService.js
│   │   │   └── studentService.js
│   │   ├── app.js
│   │   └── index.js
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md
├── database/
│   └── schema.sql
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   └── AlunoModal.jsx
│   │   ├── pages/
│   │   │   ├── AssistantPage.jsx
│   │   │   ├── AlunosPage.jsx
│   │   │   └── MensalidadesPage.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## ⚙️ Prerequisites

To run this project locally, ensure you have installed:

- **Node.js:** v22.0.0 or higher.
- **npm:** Included with Node.js.
- **PostgreSQL:** Local PostgreSQL server (v14+ recommended) or a cloud instance such as Neon.
- **Git:** For version control.
- **Google Gemini API Key:** Required to use the AI Assistant.

---

## 🚀 Local Installation & Execution

### 1. Clone the Repository

```bash
git clone https://github.com/jrs-neto/student-payment-tracker.git
cd student-payment-tracker
```

### 2. Database Setup

Execute `database/schema.sql` on your local PostgreSQL server or through the Neon SQL Editor.

#### Option A: Using `psql`

```bash
# Create a local database
psql -U postgres -d postgres -c "CREATE DATABASE sistema_mensalidades;"

# Apply the database schema
psql -U postgres -d sistema_mensalidades -f database/schema.sql
```

For Neon PostgreSQL:

```bash
psql "postgresql://user:password@host/database?sslmode=require" -f database/schema.sql
```

#### Option B: Using a Graphical Tool

Open the SQL query editor in pgAdmin, DBeaver, or Neon Console, paste the content of `database/schema.sql`, and execute the script.

### 3. Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the environment file:

   ```bash
   cp .env.example .env
   ```

4. Configure the variables in `backend/.env` according to your environment.

5. Start the backend server:

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

The backend server will listen on `http://localhost:3000`.

### 4. Frontend Setup

1. Open another terminal from the project root:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

The Vite development server will launch at `http://localhost:5173`.

In local development, API requests to `/api` are automatically proxied to the backend through the Vite configuration in `frontend/vite.config.js`.

---

## 🔐 Environment Variables

> [!IMPORTANT]
> Never commit real `.env` files or production credentials to GitHub. Use placeholder values in documentation and keep API keys private.

### Backend (`backend/.env`)

#### Local Development

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_local_password
DB_NAME=sistema_mensalidades
DB_SSL=false

DATABASE_URL=

GEMINI_API_KEY=your_gemini_api_key

FRONTEND_URL=http://localhost:5173
```

#### Production (Render + Neon)

Configure the following environment variables in the Render dashboard:

```env
DATABASE_URL=your_neon_connection_string
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=https://your-frontend-app.vercel.app
```

`PORT` is automatically assigned by Render.

For production database connections, use the Neon connection string with TLS/SSL enabled.

### Frontend (`frontend/.env`)

In local development, no frontend environment file is required because the application defaults to `/api`.

In the Vercel dashboard, configure the following variable under **Project Settings > Environment Variables**:

```env
VITE_API_URL=https://your-backend-app.onrender.com
```

The Axios service automatically removes trailing slashes and appends `/api` to build the API base URL.

---

## 🌐 Production Deployment

The project is structured as a unified repository deployed across three specialized services:

```text
┌─────────────────────────────────┐
│         Vercel (SPA)            │
│    React 19 + Vite 6            │
└───────────────┬─────────────────┘
                │ HTTPS / REST
                ▼
┌─────────────────────────────────┐
│      Render Web Service         │
│      Express 4 + Node.js        │
└───────────────┬─────────────────┘
                │ TLS / SSL
                ▼
┌─────────────────────────────────┐
│       Neon PostgreSQL           │
│       Managed Database          │
└─────────────────────────────────┘
```

### 1. Database: Neon PostgreSQL

- Create a project through [Neon](https://neon.tech/).
- Execute `database/schema.sql` using the SQL Editor.
- Copy the database connection string with SSL enabled.

### 2. Backend: Render

Create a new Web Service connected to this repository.

Configure:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Environment | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |

Add the required environment variables:

- `DATABASE_URL`: Neon connection string.
- `GEMINI_API_KEY`: Google Gemini API key.
- `FRONTEND_URL`: Public URL of the Vercel frontend.

### 3. Frontend: Vercel

Import the repository into [Vercel](https://vercel.com/).

Configure:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Add the environment variable:

- `VITE_API_URL`: Public URL of the Render backend.

After configuring the environment variables, redeploy the application.

---

## 🔒 Security & Current Limitations

The application includes several protections:

- Environment variables for sensitive configuration.
- CORS origin restrictions.
- Centralized backend error handling.
- Input validation in application services.
- Rate limiting on the AI assistant endpoint.
- Controlled AI tool execution through an explicit registry.

**Current limitations:**

- User authentication and authorization have not yet been implemented.
- Conversation history is temporary and stored in application memory.
- The AI assistant currently provides read-only database queries through its registered tools.
- The application should be treated as a demonstration environment until authentication and authorization are implemented.

> [!WARNING]
> Do not use real student information or expose sensitive personal data in the publicly deployed demonstration while authentication is unavailable. Use fictional or anonymized records.

---

## 📖 Additional Documentation

- **Backend API Reference:** See `backend/README.md` for detailed API endpoints, request payloads, response bodies, and HTTP status codes.

---

## 📄 License

This repository does not currently include an open-source license file. All rights are reserved.