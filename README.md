# Student Payment Tracker

A full-stack web application designed to manage student enrollments, reference months, and monthly tuition payments for educational institutions, tutors, and small schools.

The system provides complete student record management, monthly payment tracking with automated status calculation (Paid, Pending, Overdue), bulk monthly duplication routines, and real-time financial summaries.

---

## 🎯 Purpose and Objectives

Managing recurrent tuition payments across different months often leads to spreadsheet inconsistencies, duplicate records, or untracked delays.

**Student Payment Tracker** centralizes this process with:
* Strict database constraints preventing duplicate payments for the same student within the same month.
* Automated financial totals (expected, collected, and outstanding amounts) per month.
* Batch duplication of monthly records from previous periods, reducing repetitive manual entry.
* Timezone-aware due date evaluations against the Brazil civil calendar (`America/Sao_Paulo`).

---

## ✨ Implemented Features

### 👨‍🎓 Student Management (`/api/students`)
* **Student Catalog:** Register and manage students with name, guardian name, and guardian email.
* **Activity Status:** Active and inactive student filtering with one-click status toggling (`is_active`).
* **Input Validation:** Strict payload validation with email format checks and string constraints.
* **Referential Integrity:** Deletions are restricted (`ON DELETE RESTRICT`) to prevent orphaned records in monthly rosters.

### 📅 Reference Months (`/api/months`)
* **Chronological Timeline:** Multi-year accordion view organizing months by year and month index (1–12).
* **Unique Periods:** Database-level uniqueness constraints preventing duplicate month registrations for the same year.
* **Batch Month Duplication (`/api/months/copy`):** Replicates all tuition entries from an existing month into a target period within a single atomic database transaction, automatically adjusting due dates and setting initial payment states to unpaid.
* **Full Month Deletion:** Transactional removal of an entire reference month along with its associated records.

### 💳 Tuition & Payment Records (`/api/months/:reference_id/records`)
* **Record Tracking:** Create, edit, and delete individual student tuition entries for a specific month.
* **Dynamic Payment Status:** Automatically computed based on payment flag and civil date:
  * **Paid (`Pago`):** Record marked as settled (`is_paid = true`).
  * **Pending (`Pendente`):** Unpaid record with due date today or in the future.
  * **Overdue (`Atrasado`):** Unpaid record with due date prior to today (evaluated in `America/Sao_Paulo`).
* **Quick Payment Toggle:** Instant payment status update (`PATCH /api/months/records/:id/payment`).
* **Financial Overview:** Real-time summary displaying **Total Expected**, **Total Received**, and **Total Pending** for the selected month.

### 🎨 User Interface & Experience
* **Tab-Based Navigation:** Single-page interface switching seamlessly between Students and Monthly Payments.
* **Theme Support:** Dark mode and Light mode toggle with initial OS preference detection (`prefers-color-scheme`) and `localStorage` persistence.
* **Feedback:** Modals for student creation/editing, confirmation dialogs, and contextual visual badges for payment statuses.

---

## 🛠️ Tech Stack

### Frontend
* **Core:** React 19 (ESM)
* **Build Tool:** Vite 6
* **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`)
* **HTTP Client:** Axios
* **Icons:** Lucide React

### Backend
* **Runtime:** Node.js (ES Modules, `"type": "module"`)
* **Framework:** Express 4
* **Database Driver:** `pg` (node-postgres `Pool` without ORM for explicit, performant SQL queries)
* **Environment & Security:** `dotenv`, `cors` (restricted origin whitelist)

### Database
* **Database Engine:** PostgreSQL (v14+ recommended)
* **Cloud Database:** Neon Serverless PostgreSQL

### Deployment Architecture
* **Frontend:** Vercel (Static Single-Page Application served via Vercel's Global Edge Network)
* **Backend:** Render (Node.js Web Service)
* **Database:** Neon PostgreSQL (Managed cloud instance with enforced TLS/SSL)

---

## 📁 Repository Structure

```
student-payment-tracker/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # PostgreSQL connection pool (Neon SSL & local fallback)
│   │   ├── controllers/
│   │   │   ├── monthlyController.js # Monthly records & references controller
│   │   │   └── studentController.js # Student CRUD controller
│   │   ├── middlewares/
│   │   │   ├── errorHandler.js      # Centralized error handler
│   │   │   └── notFoundHandler.js   # 404 route handler
│   │   ├── models/
│   │   │   ├── monthlyModel.js      # Raw SQL queries for months & tuition records
│   │   │   └── studentModel.js      # Raw SQL queries for students
│   │   ├── routes/
│   │   │   ├── monthlyRoutes.js     # Endpoints under /api/months
│   │   │   └── studentRoutes.js     # Endpoints under /api/students
│   │   ├── services/
│   │   │   ├── monthlyService.js    # Business logic, validations, timezone & dates
│   │   │   └── studentService.js    # Student business rules & input validation
│   │   ├── app.js                   # Express app setup, CORS, and route mounting
│   │   └── index.js                 # Server entrypoint (0.0.0.0 binding)
│   ├── .env.example                 # Template for backend environment variables
│   ├── .gitignore                   # Backend-specific ignore rules
│   ├── package.json                 # Backend dependencies and scripts
│   └── README.md                    # Detailed API documentation (Portuguese)
├── database/
│   └── schema.sql                   # Complete PostgreSQL schema (DDL, constraints, indexes)
├── frontend/
│   ├── public/                      # Static assets and icons
│   ├── src/
│   │   ├── assets/                  # Images and static SVG files
│   │   ├── components/
│   │   │   └── AlunoModal.jsx       # Student creation and editing modal
│   │   ├── pages/
│   │   │   ├── AlunosPage.jsx       # Students management page
│   │   │   └── MensalidadesPage.jsx # Months, records, and financial summary page
│   │   ├── services/
│   │   │   └── api.js               # Axios instance with dynamic VITE_API_URL
│   │   ├── App.css                  # Component-specific styles
│   │   ├── App.jsx                  # Root layout, tab switcher, theme toggler
│   │   ├── index.css                # Global styles and Tailwind configuration
│   │   └── main.jsx                 # Application entrypoint
│   ├── .gitignore                   # Frontend-specific ignore rules
│   ├── index.html                   # HTML entrypoint
│   ├── package.json                 # Frontend dependencies and scripts
│   └── vite.config.js               # Vite config with React, Tailwind, and dev proxy
├── .gitignore                       # Root Git ignore rules (protects .env, node_modules, dist)
└── README.md                        # Main project documentation
```

---

## ⚙️ Prerequisites

To run this project locally, ensure you have installed:
* **Node.js:** v18.0.0 or higher (Node 20+ recommended)
* **npm:** v9.0.0 or higher
* **PostgreSQL:** Local PostgreSQL server (v14+ recommended) OR a cloud instance (e.g., Neon)
* **Git:** For version control

---

## 🚀 Local Installation & Execution

### 1. Clone the Repository

```bash
git clone https://github.com/jrs-neto/student-payment-tracker.git
cd student-payment-tracker
```

---

### 2. Database Setup

Execute the schema file [`database/schema.sql`](database/schema.sql) on your local PostgreSQL server or through the Neon SQL Editor:

#### Option A: Using `psql` (CLI)
```bash
# For a local PostgreSQL instance:
psql -U postgres -d postgres -c "CREATE DATABASE sistema_mensalidades;"
psql -U postgres -d sistema_mensalidades -f database/schema.sql

# For Neon PostgreSQL:
psql "postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require" -f database/schema.sql
```

#### Option B: Using a Graphical Tool (pgAdmin / DBeaver / Neon Console)
Open the SQL query editor in your client, paste the entire content of [`database/schema.sql`](database/schema.sql), and execute the script.

---

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

4. Configure the variables in `backend/.env` according to your environment (see [Environment Variables](#-environment-variables) below).

5. Start the backend server:
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

The backend server will be listening at `http://localhost:3000`.

---

### 4. Frontend Setup

1. Open a new terminal from the project root (or run `cd ../frontend` from the backend directory):
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

The Vite dev server will launch at `http://localhost:5173`.
In local development, all API requests to `/api` are automatically proxied to `http://localhost:3000` via Vite's proxy configuration in [`frontend/vite.config.js`](frontend/vite.config.js).

---

## 🔐 Environment Variables

> [!IMPORTANT]
> Never commit real `.env` files with production credentials to GitHub. Always use dummy placeholders when sharing examples.

### Backend (`backend/.env`)

#### For Local Development (Individual Parameters)
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_local_password
DB_NAME=sistema_mensalidades
DB_SSL=false
FRONTEND_URL=http://localhost:5173
```

#### For Production (Render + Neon)
In the Render dashboard, configure these environment variables under **Environment**:
```env
DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
FRONTEND_URL=https://your-frontend-app.vercel.app
```
*(Note: `PORT` is automatically assigned by Render).*

---

### Frontend (`frontend/.env` - Production Only)

In local development, no `.env` file is required in the frontend (it defaults to `/api`).
In the Vercel dashboard, configure the variable under **Project Settings > Environment Variables**:

```env
VITE_API_URL=https://your-backend-app.onrender.com
```

The Axios service automatically trims any trailing slashes and appends `/api` to build the full base URL.

---

## 🌐 Production Deployment

The project is structured as a unified repository deployed across three specialized services:

```
┌─────────────────────────────────┐         HTTPS / REST          ┌─────────────────────────────────┐
│          Vercel (SPA)           │ ────────────────────────────> │       Render Web Service        │
│   React 19 + Vite 6 Static SPA  │ <──────────────────────────── │      Express 4 + Node.js        │
└─────────────────────────────────┘    CORS Whitelist Protected   └────────────────┬────────────────┘
                                                                                   │
                                                                                   │ TLS / SSL
                                                                                   v
                                                                        ┌───────────────────────────┐
                                                                        │      Neon PostgreSQL      │
                                                                        │   Serverless DB Cluster   │
                                                                        └───────────────────────────┘
```

### 1. Database: Neon PostgreSQL
* Create a free serverless project at [Neon](https://neon.tech).
* Run the [`database/schema.sql`](database/schema.sql) file via Neon's **SQL Editor**.
* Copy the connection string containing `sslmode=require`.

### 2. Backend: Render
* Create a new **Web Service** on Render connected to this repository.
* Configure the service settings:
  * **Root Directory:** `backend`
  * **Environment:** `Node`
  * **Build Command:** `npm install`
  * **Start Command:** `npm start`
* Add Environment Variables:
  * `DATABASE_URL`: Your Neon connection string.
  * `FRONTEND_URL`: The URL of your Vercel deployment (e.g., `https://your-app.vercel.app`).

### 3. Frontend: Vercel
* Import the repository in [Vercel](https://vercel.com).
* Configure the project settings:
  * **Root Directory:** `frontend`
  * **Framework Preset:** `Vite`
  * **Build Command:** `npm run build`
  * **Output Directory:** `dist`
* Add Environment Variable:
  * `VITE_API_URL`: The public URL of your Render backend (e.g., `https://your-app.onrender.com`).

---

## 📖 Additional Documentation

* **Backend API Reference:** For an exhaustive list of all API endpoints, request payloads, response bodies, and HTTP status codes, see [`backend/README.md`](backend/README.md).

---

## 📄 License

This repository does not currently include an open-source license file. All rights are reserved.