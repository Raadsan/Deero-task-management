# Full Accounting System Package (Frontend + Backend + Prisma Schema)

Sida aad u codsatay, halkan waxaa ku diyaarsan **Full Accounting System Module** oo dhameystiran. Wuxuu ka kooban yahay:
1. **Prisma Database Schema** (`schema.accounting.prisma`) - dhamaan Noocyada (Models), Shaxda (Tables) iyo Enums-ka Accounting-ka.
2. **Backend Express Modules** (`backend/modules/`) - Dhamaan Wadooyinka (Routes), Maamulayaasha (Controllers), iyo Adeegyada (Services) Accounting-ka.
3. **Frontend Next.js Pages & UI Components** (`frontend/`) - Dhamaan Bogagga (Pages), Visual UI Components, iyo API Client Helpers (Fetch/Axios).

---

## 📁 Qaab-dhismeedka Galka (Directory Structure)

```
accounting-full-export/
├── backend/
│   ├── prisma/
│   │   └── schema.accounting.prisma        # Dhamaan Prisma Models & Enums
│   └── modules/
│       ├── accounting/                      # Wadooyinka & Controllers-ka Accounting-ka
│       │   ├── banking/                    # Bank Accounts & Banks
│       │   ├── catalog/                    # Accounting Products
│       │   ├── configuration/              # Account Types, Currencies, Companies, Payment Methods, Taxes, etc.
│       │   ├── ledger/                     # Chart of Accounts, Fiscal Years/Periods, Journals & Entries
│       │   ├── payables/                   # Vendor Bills & Vendor Payments
│       │   ├── receivables/                # Customer Invoices, Receipts & Credit Notes
│       │   ├── reports/                    # Financial Reports (Trial Balance, P&L, Balance Sheet, Cash Flow)
│       │   ├── services/                   # POS Order integration & Wallet Accounts
│       │   └── shared/                     # Helpers & Constants
│       └── shared/
│           ├── customers/                  # Customer Master Data backend module
│           └── vendors/                    # Vendor Master Data backend module
│
├── frontend/
│   ├── app/
│   │   └── accounting/                     # Next.js App Router Pages
│   │       ├── dashboard/page.tsx          # Accounting Main Dashboard Page
│   │       └── [...section]/page.tsx       # Dynamic Sub-section Routing Page
│   ├── components/
│   │   ├── accounting/                     # Dhamaan 13 UI Components
│   │   │   ├── BankingSetupPage.tsx
│   │   │   ├── CashTransactionsPage.tsx
│   │   │   ├── ChartOfAccountsPage.tsx
│   │   │   ├── ConfigurationCrudPage.tsx
│   │   │   ├── CreditNotesPage.tsx
│   │   │   ├── CustomerInvoicesPage.tsx
│   │   │   ├── CustomerReceiptsPage.tsx
│   │   │   ├── FinancialReportsPage.tsx
│   │   │   ├── FiscalManagementPage.tsx
│   │   │   ├── GeneralLedgerPage.tsx
│   │   │   ├── VendorBillsPage.tsx
│   │   │   └── VendorPaymentsPage.tsx
│   │   └── shared/
│   │       └── PartnerMasterDataPage.tsx   # Customers & Vendors Management UI
│   └── lib/
│       └── api/
│           └── accounting/                 # Dhamaan Axios/Fetch API Clients
│               ├── accountingCrud.ts
│               ├── accountingDashboardApi.ts
│               ├── accountingReportApi.ts
│               ├── banking/
│               ├── catalog/
│               ├── configuration/
│               ├── ledger/
│               ├── payables/
│               └── receivables/
└── README.md
```

---

## 🚀 Sida loogu isticmaalo Mashruuc Kale (How to Use in Another Project)

### 1. Database (Prisma)
- Ku dar koobiga ku jira `backend/prisma/schema.accounting.prisma` feylkaaga `schema.prisma`.
- Kadib dhaliyaha Prisma orod:
  ```bash
  npx prisma generate
  npx prisma db push # ama npx prisma migrate dev
  ```

### 2. Backend Setup (Express.js)
- Nuqul ka bixi galka `backend/modules/accounting` iyo `backend/modules/shared` oo dhig mashruucaaga backend-ka (e.g. `src/modules/`).
- Waddooyinka (Routes) ku xidh `app.js` ama `server.js`:
  ```javascript
  const accountingRoutes = require('./modules/accounting/accounting.routes');
  app.use('/api/accounting', accountingRoutes);
  ```

### 3. Frontend Setup (Next.js / React)
- Nuqul ka bixi galka `frontend/components/accounting` oo dhig `src/components/accounting/`.
- Nuqul ka bixi `frontend/lib/api/accounting` oo dhig `src/lib/api/accounting/`.
- Nuqul ka bixi `frontend/app/accounting` oo dhig `src/app/(dashboard)/accounting/`.
