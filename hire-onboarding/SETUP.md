# Hire Onboarding Automation - Setup Guide

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Outlook 365  │────▶│  Email Poller │────▶│  Classifier  │
│  (Graph API)  │     │  (BullMQ)    │     │  (Claude LLM)│
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌──────────────┐     ┌───────▼──────┐
                     │  Dashboard   │◀───▶│   Workflow    │
                     │  (React)     │     │   Manager    │
                     └──────────────┘     └───────┬──────┘
                                                  │
                     ┌──────────────┐     ┌───────▼──────┐
                     │  SharePoint  │◀────│  Contract    │
                     │  (Graph API) │     │  Generator   │
                     └──────────────┘     └──────────────┘
```

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- LibreOffice (for DOCX-to-PDF conversion)
- Azure AD App Registration (for Microsoft Graph API)
- Anthropic API key

## Quick Start (Local Development)

### 1. Start Infrastructure

```bash
# Start PostgreSQL and Redis using Docker
cd hire-onboarding
docker compose up -d postgres redis
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your actual values (see Environment Variables below)
```

### 3. Install Dependencies

```bash
# Backend
cd hire-onboarding/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Run Database Migrations

```bash
cd backend
npx tsx src/infrastructure/database/seed.ts
# This runs migrations AND inserts sample data
```

### 5. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

The dashboard will be available at `http://localhost:3001`.
Default login: `admin` / `admin` (development only).

## Environment Variables

### Required for Core Functionality

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://hire_user:hire_pass@localhost:5432/hire_onboarding` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SESSION_SECRET` | Session encryption key (min 16 chars) | `my-super-secret-key-change-me` |

### Required for Email Integration

| Variable | Description |
|---|---|
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Azure AD app client ID |
| `AZURE_CLIENT_SECRET` | Azure AD app client secret |
| `AUTOMATION_INBOX_EMAIL` | Email address of the automation inbox |

### Required for SharePoint Integration

| Variable | Description |
|---|---|
| `SHAREPOINT_SITE_ID` | SharePoint site ID |
| `SHAREPOINT_DRIVE_ID` | SharePoint document library drive ID |

### Required for LLM Extraction

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

### Beta Mode (Recommended for Initial Deployment)

| Variable | Default | Description |
|---|---|---|
| `BETA_MODE` | `true` | Only process emails from allowed domains |
| `BETA_ALLOWED_DOMAINS` | `balcpa.com` | Comma-separated list of allowed sender domains |

## Azure AD Setup

1. Go to Azure Portal > Azure Active Directory > App Registrations
2. Create a new registration:
   - Name: "Hire Onboarding Automation"
   - Account type: Single tenant
3. Under API Permissions, add:
   - `Mail.Read` (Application)
   - `Mail.ReadWrite` (Application)
   - `Sites.ReadWrite.All` (Application)
   - `Files.ReadWrite.All` (Application)
4. Grant admin consent for the permissions
5. Create a client secret under Certificates & Secrets
6. Note the Tenant ID, Client ID, and Client Secret

## Testing with Sample Emails

The system includes sample email fixtures in `backend/tests/fixtures/sampleEmails.ts`. The seed script also creates a sample workflow in READY_FOR_REVIEW state so you can immediately test the dashboard.

To test the full flow:
1. Forward a hiring email to your automation inbox
2. Click "Poll Inbox Now" in the dashboard
3. Review the extracted fields
4. Edit any incorrect fields
5. Approve and generate the contract

## Beta Mode Operation

In beta mode:
- Only emails from `@balcpa.com` (configurable) are processed
- All other emails are logged but skipped
- No emails are sent automatically (Phase 1 is human-in-the-loop)
- Dashboard shows beta mode indicator

## Contract Templates

See `backend/templates/README.md` for template setup instructions.

**Phase 1 Template Strategy:**
1. Convert your existing PDF contracts to DOCX format
2. Replace variable fields with `{{placeholder}}` syntax
3. Place DOCX files in `backend/templates/`
4. The system generates DOCX, then converts to PDF via LibreOffice

## Running Tests

```bash
cd backend
npm test           # Run all tests
npm run test:watch # Watch mode
```

## Production Deployment

### Using Docker Compose

```bash
cd hire-onboarding

# Create .env file with production values
cp backend/.env.example .env
# Edit .env with production values

# Build and start all services
docker compose up -d --build
```

### Manual Deployment

1. Build the backend: `cd backend && npm run build`
2. Build the frontend: `cd frontend && npm run build`
3. Run migrations: `cd backend && npm run migrate`
4. Start the server: `cd backend && npm start`

## Workflow States

```
RECEIVED → CLASSIFIED → READY_FOR_REVIEW → READY_TO_GENERATE → GENERATED
                ↓                                                    ↓
         NEEDS_MORE_INFO                                    APPROVED / REVISION_REQUESTED
                                                               ↓              ↓
                                                   WAITING_FOR_SIGNATURE   (back to review)
                                                               ↓
                                                         SIGNED_MARKED
                                                               ↓
                                                      FILED_TO_SHAREPOINT
```

Any state can transition to FAILED. FAILED can retry back to RECEIVED.

## Next Steps (Phase 2)

- [ ] DocuSign integration for e-signatures
- [ ] Automated reminder emails (currently dashboard-only)
- [ ] Multi-user dashboard with role-based access
- [ ] Onboarding checklist tracking beyond contracts
- [ ] Email auto-response drafting
- [ ] Template versioning and history
- [ ] Bulk operations
- [ ] Reporting and analytics
