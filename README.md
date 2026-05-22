# Sindh Smart Citizen Portal

Sindh Smart Citizen Portal is a full-stack complaint management system for citizens and administrators of Sindh. Citizens can register, log in, file complaints against utility departments (KE, SSGC, Water Board), track progress, and manage their profile. Administrators can review complaints, assign officers, update statuses, manage departments, and monitor activity.


## 🌐 Live Demo
https://sindh-smart-citizen-portal-sscp.vercel.app/

## Features

### Citizen Portal
- User registration and login via Supabase Auth
- Citizen dashboard with complaint stats and chart
- Complaint submission with document upload
- Department-wise complaint view
- Profile management and login activity

### Admin Panel
- Admin login and protected routes
- Complaint monitoring, filtering, and status management
- Officer assignment per complaint
- Department management
- Officer management
- Dashboard overview of complaint counts

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- Recharts

### Backend
- Node.js
- Express
- MySQL (hosted on Railway)
- `mysql2`

### Auth & Cloud
- Supabase Auth (JWT-based authentication)
- Railway (MySQL cloud database)
- Vercel (frontend + backend deployment)

## Project Structure

```text
.
├── src/                   # React frontend
├── oracle-backend/        # Express + MySQL backend
│   ├── server.js          # Main Express server
│   ├── middleware/
│   │   └── auth.js        # Supabase auth middleware
│   └── .env               # Backend environment variables
├── images/                # App screenshots
├── vercel.json            # Vercel deployment config
└── README.md
```

## Getting Started

### Prerequisites
- Node.js and npm
- MySQL database (local or Railway)
- Supabase project

### 1. Install frontend dependencies
```bash
npm install
```

### 2. Install backend dependencies
```bash
cd oracle-backend
npm install
```

### 3. Configure environment variables

Create `oracle-backend/.env`:
```env
DATABASE_URL=mysql://root:password@host:port/railway
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=5000
```

Create `.env` in root (frontend):
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=/api
```

### 4. Initialize the MySQL schema

Run the SQL schema on your Railway MySQL database (via Railway Database tab or MySQL Workbench):
```sql
-- Create tables: users, login_logs, departments, officers, complaints, complaint_documents
-- See schema.sql for full script
```

### 5. Start the backend
```bash
cd oracle-backend
node server.js
```

### 6. Start the frontend
```bash
npm run dev
```

Frontend runs at:
http://localhost:5173

Backend API runs at:
http://localhost:5000

## Deployment

This project is deployed on **Vercel** with the following setup:
- Frontend (React/Vite) served as static build
- Backend (Express) served as Vercel serverless function
- Database hosted on **Railway MySQL**
- Auth handled by **Supabase**

Environment variables are configured in Vercel project settings.

## Key Routes

### Public / Citizen
- `/` — Landing page
- `/register` — Citizen registration
- `/login?role=citizen` — Citizen login
- `/dashboard` — Citizen dashboard
- `/complaint` — Submit and track complaints
- `/profile` — Profile management
- `/departments` — Department overview

### Admin
- `/login?role=admin` — Admin login
- `/admin/dashboard` — Admin dashboard
- `/admin/complaints` — Complaint management
- `/admin/officers` — Officer management
- `/admin/departments` — Department management

## Screenshots

### Landing Page
<img width="1835" height="836" alt="image" src="https://github.com/user-attachments/assets/2f2fc593-96ad-46b8-aa9c-287eede63ae8" />

### Citizen Login
<img width="982" height="729" alt="image" src="https://github.com/user-attachments/assets/51b356be-1083-47bd-b3eb-60a688649655" />

### Admin Login
<img width="983" height="719" alt="image" src="https://github.com/user-attachments/assets/16669608-bf84-4426-9e80-193b510cde0e" />

### Citizen Dashboard
<img width="1903" height="813" alt="image" src="https://github.com/user-attachments/assets/c7577d6e-7214-43ae-bdc9-60659167b609" />

### Complaint Management
<img width="1905" height="785" alt="image" src="https://github.com/user-attachments/assets/677bf01c-77fe-4a5e-a441-354fd741d7f7" />

### Citizen Profile
<img width="1912" height="732" alt="image" src="https://github.com/user-attachments/assets/db99227b-8490-46b2-8698-9644cae7379f" />

### Departments Page
<img width="1904" height="542" alt="image" src="https://github.com/user-attachments/assets/8dca0ede-f7cd-47bf-b267-2c0f5b093ae4" />

### Admin Dashboard
<img width="1912" height="646" alt="image" src="https://github.com/user-attachments/assets/903cb6a8-dcd2-49e7-a0ba-4fcbcb08c47a" />

### Admin Complaints Panel
<img width="1880" height="809" alt="image" src="https://github.com/user-attachments/assets/35b86887-10c5-409a-ab22-5f4614db7cc9" />

### Admin Officers Panel
<img width="1897" height="648" alt="image" src="https://github.com/user-attachments/assets/2776ede1-a4a3-478f-83d7-4264b2fca586" />

### Admin Departments Panel
<img width="1904" height="579" alt="image" src="https://github.com/user-attachments/assets/e9cc5946-fb66-4889-bc00-2579879b76d6" />


## Notes
- Frontend proxies `/api` requests to the Express backend via Vercel routing
- `oracle-backend/.env` is intentionally ignored by Git
- Supabase handles all authentication — no passwords stored in MySQL
- MySQL stores all app data linked via `supabase_uid`
