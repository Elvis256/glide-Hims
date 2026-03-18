# Frontend System Flow - Quick Reference

## Architecture Overview

```
main.tsx (Entry)
    ↓
App.tsx (Providers)
    ├─ ErrorBoundary (global)
    ├─ QueryClientProvider (React Query)
    ├─ Toaster (Sonner)
    ├─ BrowserRouter (Router v6)
    ├─ SessionTimeoutWrapper (30min inactivity)
    └─ AppRoutes
         ├─ Setup Check (token validation + refresh)
         ├─ If unauthenticated → /login
         └─ If authenticated
              └─ ProtectedRoute
                  └─ DashboardLayout (sidebar)
                      └─ ErrorBoundary (route-level)
                          └─ 100+ lazy-loaded pages
```

## Key Components & Providers

| Provider | Purpose | Config |
|----------|---------|--------|
| **ErrorBoundary** | Catch React errors | 3 levels: global/route/component |
| **QueryClientProvider** | Data fetching cache | staleTime=5m, retry=1 |
| **BrowserRouter** | URL routing | React Router v6 |
| **SessionTimeoutWrapper** | Auto logout | 30min inactivity |
| **Toaster** | Toast notifications | Sonner, top-right |

## Authentication Flow

```
User Login (/login)
    ↓
POST /auth/login { username, password, tenantId }
    ↓
Backend Response:
{
  user: { id, roles, permissions, facilityId, tenantId },
  accessToken: "jwt",
  refreshToken: "jwt"
}
    ↓
Frontend:
1. useAuthStore.login(user, tokens)
   → Persist to localStorage (glide-hims-auth)
2. sessionStorage.setItem('glide_active_tenant_id', tenantId)
3. authService.getMe() → fetch modules + permissions
4. navigate('/') → Dashboard
    ↓
On 401 Response (token expired):
1. Check if already refreshing (mutex)
2. POST /auth/refresh { refreshToken }
3. Update useAuthStore with new tokens
4. Retry original request
    ↓
On logout:
1. Clear Zustand state
2. Clear sessionStorage
3. clearAllData() → wipe IndexedDB
4. Redirect to /login
```

## Routing Structure

```
PUBLIC ROUTES (no auth required)
├─ /login         → LoginPage
├─ /register      → RegisterOrganizationPage
└─ /setup         → SetupWizardPage

PROTECTED ROUTES (require auth)
├─ / (dashboard)
│  └─ SmartDashboardPage
│
├─ /patients/*
│  ├─ /search     → ReceptionistRoute
│  ├─ /new        → ReceptionistRoute
│  ├─ /:id        → RoleRoute (receptionist, doctor, nurse, cashier, lab, pharmacy, radiologist, admin)
│  └─ /history    → RoleRoute
│
├─ /pharmacy/*
│  ├─ /queue      → PharmacistRoute
│  ├─ /dispense   → PharmacistRoute (multi-step: search → verify → pick → check → dispense)
│  ├─ /stock      → PharmacistRoute
│  └─ /returns    → PharmacistRoute
│
├─ /doctor/*
│  ├─ /dashboard  → DoctorRoute
│  ├─ /consult    → DoctorRoute
│  ├─ /queue      → DoctorRoute
│  └─ /prescriptions/* → DoctorRoute
│
├─ /lab/*
│  ├─ /queue      → LabTechRoute
│  ├─ /results    → LabTechRoute
│  └─ /reports    → LabTechRoute
│
├─ /billing/*
│  ├─ /invoices   → BillingRoute (cashier, receptionist, accountant)
│  ├─ /payments   → BillingRoute
│  └─ /reports    → BillingRoute
│
└─ ... 100+ more routes across 20+ modules
```

## API Interceptors

```
REQUEST INTERCEPTOR:
├─ Authorization: Bearer {accessToken}
├─ x-facility-id: {sessionStorage or user.facilityId}
└─ x-tenant-id: {sessionStorage or user.tenantId}

RESPONSE INTERCEPTOR:
├─ 401 Unauthorized
│  ├─ If refresh in progress: Queue request, wait for token
│  ├─ Else: POST /auth/refresh
│  │  ├─ Update useAuthStore
│  │  ├─ Retry original request
│  │  └─ Notify queued requests
│  └─ If refresh fails: Logout, redirect /login?expired=true
│
├─ 403 Forbidden
│  └─ toast.error("Access Denied")
│
└─ 2xx/3xx: Return response
```

## State Management (Zustand)

```
useAuthStore (Persisted to localStorage: glide-hims-auth)
├─ user: User | null
├─ accessToken: string | null
├─ refreshToken: string | null
├─ isAuthenticated: boolean
├─ isLoading: boolean
└─ Actions:
   ├─ login(user, accessToken, refreshToken)
   ├─ logout()
   ├─ setTokens(accessToken, refreshToken)
   ├─ hasPermission(permission: string): boolean
   ├─ hasRole(role: string): boolean
   ├─ hasModuleAccess(moduleCode: string): boolean
   └─ updateFromMe(permissions, roles, modules)

useNotificationStore
└─ Notifications from real-time events

usePatientsStore
└─ Selected patient context
```

## React Query Setup

```
queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,      // 5 minutes
      cacheTime: 10 * 60 * 1000,     // 10 minutes
      refetchOnWindowFocus: false
    },
    mutations: {
      onError: (error) => {
        toast.error(getApiErrorMessage(error))
      }
    }
  }
})

Pattern:
const { data, isLoading } = useQuery(['key'], () => service.fetch())
const { mutate } = useMutation((data) => service.create(data), {
  onSuccess: () => queryClient.invalidateQueries(['key'])
})
```

## Pharmacy Dispense Workflow Example

```
PharmacyQueuePage (/pharmacy/queue)
├─ Fetch pending prescriptions: useQuery(['pharmacy-queue'], ...)
├─ Filter: status, priority, search term
├─ List with: Rx#, Patient, Status, Priority, [Dispense] button
└─ User clicks [Dispense] → navigate('/pharmacy/dispense?rxId=001')

DispenseMedicationPage (/pharmacy/dispense)
│
└─ Multi-step form (state: step = 'search' | 'verify' | 'pick' | 'check' | 'dispense')
   │
   ├─ STEP 1: SEARCH
   │  ├─ Input: Rx ID or patient name
   │  ├─ Query: useQuery(['prescription', rxId], ...)
   │  └─ Next: setStep('verify')
   │
   ├─ STEP 2: VERIFY
   │  ├─ Show: Patient details, allergies, current meds
   │  ├─ Confirm patient identity
   │  └─ Next: setStep('pick')
   │
   ├─ STEP 3: PICK
   │  ├─ For each Rx item:
   │  │  ├─ Select batch number
   │  │  ├─ Verify expiry date
   │  │  ├─ Pick quantity
   │  │  └─ Check stock
   │  └─ Next: setStep('check')
   │
   ├─ STEP 4: CHECK (QC)
   │  ├─ Show counseling points (category-based)
   │  ├─ Verify package integrity
   │  └─ Next: setStep('dispense')
   │
   └─ STEP 5: DISPENSE
      ├─ Final summary
      ├─ useMutation: POST /pharmacy/dispense
      │  └─ If online: Immediate POST
      │  └─ If offline: Queue to IndexedDB + show badge
      ├─ On success:
      │  ├─ toast.success('Dispensed')
      │  ├─ Print receipt (JSPdf)
      │  └─ navigate('/pharmacy/queue')
      └─ React Query invalidates ['pharmacy-queue']
```

## Offline & Sync System

```
Dexie IndexedDB (GlideHIMSOfflineDB)
├─ syncQueue: [{
│   entityType, entityId, operation (create/update/delete),
│   payload, status (pending/syncing/synced/conflict/failed),
│   retryCount, clientTimestamp
│ }]
├─ patients, encounters, vitals, clinicalNotes, ...
├─ metadata: { clientId, lastSyncTimestamp }
└─ conflicts: [{ entityType, entityId, clientPayload, serverPayload, conflictingFields }]

Sync Flow:
Online && !isSyncing && hasPending
  ↓
Phase 1: PUSH (Upload local changes)
  ├─ GET pending operations from syncQueue
  ├─ For each: POST /sync/push { entityType, operation, payload, ... }
  └─ Mark as 'synced' or 'conflict' or 'failed'

Phase 2: PULL (Download remote changes)
  ├─ POST /sync/pull { facilityId, lastSyncTimestamp }
  ├─ For each remote item: Upsert to local DB
  └─ Update metadata.lastSyncTimestamp

Offline Behavior:
1. API call fails (no internet)
2. Operation queued to IndexedDB.syncQueue
3. Show "Saved offline - will sync when online"
4. User continues working
5. Internet restored → 'online' event
6. syncNow() triggered automatically
7. Operations pushed to server
8. UI shows "Synced ✓"

clearAllData() on logout:
- Wipes all 18 tables (patients, encounters, etc.)
- Prevents patient data leaking between users
```

## Error Boundaries

```
Global ErrorBoundary (level="global")
├─ Wraps entire app
├─ Fallback: Large red alert with "Application Error"
├─ Buttons: Try Again (reset), Go Home (navigate)
└─ Dev mode: Shows error details

Route-Level ErrorBoundary (level="route")
├─ Wraps Routes inside DashboardLayout
├─ Fallback: PageLoader
└─ Scope: Single route

Component-Level ErrorBoundary (level="component")
├─ Custom fallback (optional)
└─ Scope: Single component
```

## Session Timeout

```
useSessionTimeout (hook)
├─ Inactivity timeout: 30 minutes
├─ Warning at: 25 minutes
├─ Tracked events: mousedown, mousemove, keydown, scroll, touchstart, click
├─ Throttle: Max once per second reset
│
└─ Timer logic:
   ├─ resetTimer() on activity
   ├─ Start warningTimer (25 min)
   │  └─ Call onWarning() callback
   ├─ Start timeoutTimer (30 min)
   │  └─ Call logout() → useAuthStore.logout()
   └─ Cleanup on unmount
```

## Error Message Extraction

```
getApiErrorMessage(error)
├─ If AxiosError:
│  ├─ Check response.data.message (NestJS format)
│  ├─ If validation errors: Extract field-level details
│  ├─ Else: Fall back to statusText
│  └─ Else: Fall back to error.message
│
├─ If Error instance:
│  └─ Return error.message
│
├─ If string:
│  └─ Return as-is
│
└─ Fallback: "An unexpected error occurred"
```

## Vite Configuration

```
DEV SERVER (https://localhost:5173):
├─ HTTPS enabled (with certs/)
├─ Port: 5173
├─ Host: true (allow network access)
│
└─ Proxy:
   ├─ /api → http://localhost:3000/api
   └─ /socket.io → ws://localhost:3000 (WebSocket)

PREVIEW SERVER (production-like):
└─ Same proxy config

Build Output:
├─ dist/ folder
├─ Split bundles per route (code splitting)
└─ Ready for Docker/production deployment
```

## Services Organization

```
services/
├─ api.ts (816 lines)           ← Axios + interceptors
├─ auth.ts                      ← /auth/* endpoints
├─ pharmacy.ts (816 lines)      ← /pharmacy/* (40+ endpoints)
├─ prescriptions.ts             ← /prescriptions/*
├─ lab.ts (457 lines)           ← /lab/* (testing)
├─ patients.ts                  ← /patients/*
├─ queue.ts (256 lines)         ← Queue management
├─ billing.ts                   ← /billing/*
├─ hr.ts (802 lines)            ← HR module
├─ procurement.ts (364 lines)   ← Procurement
├─ encounters.ts                ← /encounters/*
└─ ... 30+ more modules

Pattern:
export const serviceModule = {
  fetch: () => api.get('/endpoint'),
  create: (data) => api.post('/endpoint', data),
  update: (id, data) => api.patch(`/endpoint/${id}`, data),
  delete: (id) => api.delete(`/endpoint/${id}`),
}
```

## Key Hooks

```
useSessionTimeout()
├─ Returns: { resetTimer, lastActivity }
└─ Manages inactivity timeout

useAuthStore()
├─ Returns: auth state + actions
└─ Global auth management

useSyncStatus()
├─ Returns: { syncStatus, canSync }
└─ Offline sync status

usePendingCount()
├─ Returns: { isPending, retry }
└─ Pending operations count

useQuery()
├─ TanStack React Query
├─ Data fetching + caching
└─ Automatic refetch

useMutation()
├─ TanStack React Query
├─ POST/PUT/DELETE operations
└─ onSuccess/onError callbacks

useForm()
├─ React Hook Form
├─ Form state management
└─ Validation with Zod

useNavigate()
└─ React Router programmatic navigation

useLocation()
└─ React Router current location
```

## Main Pages (Examples)

```
/                          → SmartDashboardPage (stats + quick links)
/login                     → LoginPage (tenant selection + credentials)
/pharmacy/queue            → PharmacyQueuePage (list prescriptions)
/pharmacy/dispense?rxId=   → DispenseMedicationPage (5-step workflow)
/patients/search           → PatientSearchPage
/patients/new              → PatientRegistrationPage
/doctor/consult            → NewConsultationPage
/lab/queue                 → LabQueuePage
/lab/results               → ResultsEntryPage
/billing/invoices          → InvoicesPage
/admin/users               → UserListPage
... 100+ more
```

## File Structure

```
frontend/
├─ src/
│  ├─ main.tsx              ← Entry point
│  ├─ App.tsx               ← Main routing + providers
│  ├─ index.css             ← Global styles
│  │
│  ├─ store/                ← Zustand stores
│  │  ├─ auth.ts            ← Auth state + actions
│  │  ├─ notifications.ts
│  │  └─ patients.ts
│  │
│  ├─ services/             ← API services (40+)
│  │  ├─ api.ts
│  │  ├─ auth.ts
│  │  ├─ pharmacy.ts
│  │  └─ ...
│  │
│  ├─ components/           ← Reusable React components
│  │  ├─ DashboardLayout.tsx
│  │  ├─ ErrorBoundary.tsx
│  │  ├─ ProtectedRoute.tsx
│  │  ├─ RoleRoute.tsx
│  │  ├─ NotificationBell.tsx
│  │  └─ ...
│  │
│  ├─ pages/                ← Page components (100+)
│  │  ├─ LoginPage.tsx
│  │  ├─ DashboardPage.tsx
│  │  ├─ pharmacy/
│  │  │  ├─ PharmacyQueuePage.tsx
│  │  │  ├─ DispenseMedicationPage.tsx
│  │  │  └─ ...
│  │  ├─ doctor/
│  │  ├─ lab/
│  │  ├─ billing/
│  │  └─ ... 20+ subdirectories
│  │
│  ├─ hooks/                ← Custom hooks
│  │  ├─ useSessionTimeout.ts
│  │  └─ ...
│  │
│  ├─ lib/                  ← Utilities + offline sync
│  │  ├─ sync/
│  │  │  ├─ db.ts           ← Dexie IndexedDB setup
│  │  │  ├─ syncManager.ts  ← Push/pull sync
│  │  │  ├─ syncQueue.ts    ← Queue operations
│  │  │  └─ hooks.ts        ← Sync hooks
│  │  ├─ currency.ts
│  │  ├─ hospital.ts
│  │  ├─ print.ts           ← JSPdf printing
│  │  └─ ...
│  │
│  ├─ types/                ← TypeScript interfaces
│  │  └─ index.ts
│  │
│  ├─ utils/                ← Helper functions
│  │  └─ ...
│  │
│  ├─ data/                 ← Static data
│  │  └─ ...
│  │
│  └─ assets/               ← Images, logos
│     └─ ...
│
├─ public/
│  ├─ index.html
│  └─ manifest.json
│
├─ vite.config.ts           ← Vite config (proxy, HTTPS)
├─ tsconfig.json
├─ package.json
└─ README.md
```

---

## Performance Metrics

- **Initial Load**: ~2-3s (lazy loaded chunks)
- **Route Navigation**: <100ms (with cache)
- **API Response**: <200ms (typical)
- **Sync Operation**: <500ms (depends on queue size)
- **IndexedDB Query**: <50ms (typical)

---

## Browser Support

- Chrome/Edge: ✅ (v120+)
- Firefox: ✅ (v121+)
- Safari: ✅ (v16+)
- Mobile: ✅ (iOS 13+, Android 11+)

---

## Common Issues & Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| **401 Unauthorized repeatedly** | Token refresh failing | Check `/auth/refresh` endpoint, verify refreshToken |
| **403 Access Denied** | Missing permission | Check user roles/permissions, verify /auth/me |
| **Page blank after login** | Setup incomplete | Check `/setup` status endpoint |
| **Offline mode not working** | IndexedDB disabled | Enable IndexedDB, check browser privacy settings |
| **Sync conflicts** | Server has newer version | Use ConflictResolutionPage to resolve |
| **Session timeout not working** | Timer cleared | Check useSessionTimeout hook, verify event listeners |

