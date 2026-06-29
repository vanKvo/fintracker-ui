# FinTracker UI

The primary web interface for FinTracker, providing users with a comprehensive financial dashboard, transaction management, and real-time insights. Built with Angular and Tailwind CSS, it connects to the microservices ecosystem via a centralized API Gateway.


## Key Features & Impacts
* **Interactive Financial Dashboard:** Provides a 360-degree view of user finances, including "Safe to Spend" metrics, rolling balances, and upcoming bill tracking.
* **Real-time Push Notifications:** Leverages WebSockets to instantly update the UI when background data processing or AI analysis completes, eliminating the need for polling.
* **Seamless Document Ingestion:** Provides an intuitive interface for uploading PDF bank statements, featuring a computer-vision powered "Table Detection" signal for early validation.
* **Responsive Budget Management:** Enables users to set, monitor, and adjust monthly budgets with visual pacing indicators across all devices and screen sizes.

## Architecture
The frontend is a Single-Page Application (SPA) built on Angular 21, following a strictly modular, feature-based architecture.

```text
src/app/
├── core/            # Singleton services (Auth, HTTP Interceptors, Guards)
├── shared/          # Reusable UI components, pipes, and directives
└── features/        # Business modules (Dashboard, Budgets, Transactions, etc.)
```

## Tech Stack
* **Frontend:** Angular, TypeScript, Tailwind CSS
* **Backend:** Consumes Python/Java Microservices via API Gateway
* **Cloud:** AWS (S3/CloudFront for hosting, Cognito for Auth)
* **DevOps:** GitHub Actions, Docker (Local Dev)
* **Testing:** Vitest, Playwright

## Modules
| Module | Description |
|---|---|
| **Dashboard** | Primary financial overview featuring aggregations, cash flow charts, and bill schedules. |
| **Transactions** | Comprehensive ledger view with multi-select filtering, split-transaction logic, and approval workflows. |
| **Budgets** | Interactive monthly budget configuration with category-specific progress bars and historical templates. |
| **Statements** | Secure upload portal for bank statements with real-time ingestion status tracking. |
| **Reports** | Analytical visualization of spending habits and AI-generated anomaly/insight cards. |
| **Auth** | Secure identity orchestration using AWS Cognito and Google Identity Federation. |

## Core Workflows
* **Dashboard Bootstrapping:** Upon authentication, the application orchestrates parallel calls to the Analytics and Ledger services to populate the user's financial state instantly.
* **Asynchronous Ingestion:** When a statement is uploaded, the UI maintains a WebSocket connection to the User Profile service to receive a "Processing Complete" signal from the backend pipeline.
* **Multi-Tenant Scoping:** The application attaches Cognito JWT tokens to every outgoing request, which are then used by the backend to enforce strict data isolation.

## Quick Start
<details>
<summary>Click to expand setup instructions</summary>

### Prerequisites
* Node.js (v20+)
* Angular CLI

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/vanKvo/fintracker-ui.git
    cd fintracker-ui
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the development server:**
    ```bash
    ng serve
    ```
4.  **Access:**
    The application will be available at `http://localhost:4200`.

</details>
