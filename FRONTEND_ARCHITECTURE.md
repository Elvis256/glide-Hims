# Glide-HIMS Frontend System Architecture & Flow

## Executive Summary
**Stack**: React 19 + TypeScript + Vite (HTTPS dev server with proxy)  
**State Management**: Zustand (with localStorage persistence)  
**API Layer**: Axios with interceptors (auto token-refresh, facility/tenant headers)  
**Offline Support**: Dexie.js (IndexedDB) with sync queue  
**Routing**: React Router v6 with lazy-loaded pages + role-based guards  
**UI Framework**: Tailwind CSS + Lucide React icons + Sonner toasts  
**Data Fetching**: TanStack React Query (v5)  

---

## 1. APP ENTRY POINT & BOOTSTRAP

### `main.tsx` (Minimal Entry)
```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
- **StrictMode**: Dev-only double-render for detecting side effects

### `App.tsx` (Provider Wrapper)
```
ErrorBoundary (global, level="global")
  ↓
QueryClientProvider (TanStack React Query)
  ↓
Toaster (Sonner notifications)
  ↓
BrowserRouter (React Router v6)
  ↓
SessionTimeoutWrapper (inactivity monitor: 30min)
  ↓
AppRoutes (main routing logic)
```

**Key Setup (AppRoutes)**:
1. **Setup Check** (useEffect on mount):
   - If `isAuthenticated && accessToken && refreshToken` → Validate token via `/auth/profile`
   - If invalid → Try refresh via `/auth/refresh`
   - If valid → Fetch user permissions via `/auth/me`
   - If setup incomplete → Redirect to `/setup`

2. **Conditional Routing**:
   - **Unauthenticated**: `/login`, `/register`, `/setup`
   - **Authenticated**: ProtectedRoute wrapper → DashboardLayout + ErrorBoundary + 100+ lazy-loaded pages

---

## 2. ROUTING & CODE SPLITTING

### Lazy Loading Strategy
```typescript
// In App.tsx: 100+ lazy routes with React.lazy + Suspense
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PharmacyPage = lazy(() => import('./pages/pharmacy/DispenseMedicationPage'));
// ... more pages

// Route tree:
<Suspense fallback={<PageLoader />}>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/*" element={
      <ProtectedRoute>
        <DashboardLayout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* 100+ nested routes */}
            </Routes>
          </Suspense>
        </DashboardLayout>
      </ProtectedRoute>
    } />
  </Routes>
</Suspense>
```

### Route Guards (Multi-Level)

**Level 1: ProtectedRoute Component**
```typescript
- Checks: isAuthenticated
- If not: Redirect to /login
- If yes + Super Admin/Administrator: bypass all checks
- Else: Check requiredRoles[] and requiredPermissions[]
```

**Level 2: RoleRoute Component** (convenience wrappers)
```typescript
ROLES = {
  DOCTOR, NURSE, PHARMACIST, LAB_TECHNICIAN,
  RECEPTIONIST, CASHIER, STORE_KEEPER, ACCOUNTANT,
  ADMIN, SUPER_ADMIN, HR_MANAGER
}

Convenience routes:
- DoctorRoute, NurseRoute, PharmacistRoute, etc.
- All wrap ProtectedRoute with role checks
```

**Example Route**:
```typescript
<Route 
  path="/pharmacy/dispense" 
  element={
    <PharmacistRoute>
      <DispenseMedicationPage />
    </PharmacistRoute>
  } 
/>
```

---

## 3. AUTH FLOW & TOKEN MANAGEMENT

### **Login Flow** (`/login` → `/`)

1. **User submits credentials**:
   ```typescript
   authService.login({ username, password, tenantId })
   ```

2. **Backend response** (`/auth/login`):
   ```typescript
   {
     user: { id, email, roles, permissions, accessibleModules, facilityId, tenantId },
     accessToken: "jwt_short_lived",
     refreshToken: "jwt_long_lived"
   }
   ```

3. **Store tokens in Zustand** (persisted to localStorage):
   ```typescript
   useAuthStore.login(user, accessToken, refreshToken)
   // Stored as: glide-hims-auth = { user, accessToken, refreshToken, isAuthenticated }
   ```

4. **Persist tenant context** (sessionStorage):
   ```typescript
   sessionStorage.setItem('glide_active_tenant_id', selectedTenantId);
   ```

5. **Fetch accessible modules** (non-blocking):
   ```typescript
   authService.getMe() → { accessibleModules, permissions, roles }
   ```

6. **Redirect to dashboard**: `navigate('/')`

### **API Interceptors** (`src/services/api.ts`)

**Request Interceptor**:
- Adds `Authorization: Bearer {accessToken}` header
- Adds `x-facility-id` from sessionStorage (or user.facilityId)
- Adds `x-tenant-id` from sessionStorage (or user.tenantId)
- Enables multi-tenant + multi-facility isolation

**Response Interceptor (Token Refresh)**:
```
If 401 response:
  1. Check if already refreshing (mutex pattern)
  2. If yes: Queue request, wait for new token
  3. If no: Acquire lock, call POST /auth/refresh
  4. Update store: useAuthStore.setTokens(newAccessToken, newRefreshToken)
  5. Retry original request with new token
  6. Notify queued requests
  7. Release lock

If refresh fails:
  - Clear auth store
  - Dispatch SESSION_EXPIRED_EVENT
  - Redirect to /login?expired=true
```

**403 Forbidden Handler**:
- Toast error: "Access Denied: {message}"

### **Logout** (`store/auth.ts`)
```typescript
logout() {
  - Clear Zustand state
  - Clear sessionStorage
  - Call clearAllData() → clear IndexedDB
  - Redirect to /login (via ProtectedRoute)
}
```

### **Session Timeout** (`hooks/useSessionTimeout.ts`)
- **Inactivity Timeout**: 30 minutes
- **Warning Before**: 5 minutes before timeout
- **Tracked Events**: mousemove, keydown, click, scroll, touchstart
- **Throttle**: Max once/second reset
- **Cleanup**: Timers + event listeners on unmount

---

## 4. STATE MANAGEMENT (Zustand)

### Auth Store (`store/auth.ts`)
```typescript
interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthActions {
  setUser, setTokens, login, logout
  setLoading
  hasPermission(permission)
  hasRole(role)
  hasModuleAccess(moduleCode)
  setAccessibleModules(modules[])
  updateFromMe(data)
}

Persistence:
- name: 'glide-hims-auth'
- Partialize: only persist { user, accessToken, refreshToken, isAuthenticated }
- Storage: localStorage (browser default)
```

### Patients Store (`store/patients.ts`)
- Track selected patient for multi-page workflows

### Notifications Store (`store/notifications.ts`)
- Real-time notification updates

---

## 5. API LAYER

### Structure
```
src/services/
├── api.ts                 # Axios instance + interceptors
├── auth.ts                # /auth/* endpoints
├── patients.ts            # /patients/* 
├── pharmacy.ts            # /pharmacy/* (816 LOC)
├── prescriptions.ts       # /prescriptions/*
├── lab.ts                 # /lab/* (457 LOC)
├── encounters.ts          # /encounters/*
├── billing.ts             # /billing/*
├── queue.ts               # /queue/* (256 LOC)
├── hr.ts                  # /hr/* (802 LOC)
├── procurement.ts         # /procurement/* (364 LOC)
└── ... (40+ more services)
```

### Vite Proxy (`vite.config.ts`)
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true
    },
    '/socket.io': {
      target: 'http://localhost:3000',
      ws: true  // WebSocket support
    }
  }
}
```
- **Dev Server**: Proxies `/api/*` → `http://localhost:3000/api/*`
- **Prod**: Uses `VITE_API_URL` env var (default `/api/v1`)

### Service Pattern
```typescript
// Example: pharmacy.ts
export const pharmacyService = {
  getSales: async (facilityId: string) => {
    const response = await api.get(`/pharmacy/sales?facilityId=${facilityId}`);
    return response.data;
  },
  
  createSale: async (sale: CreatePharmacySaleDto) => {
    const response = await api.post('/pharmacy/sales', sale);
    return response.data;
  },
  
  // ... ~30 more methods
}
```

### Error Handling
```typescript
// Global error handler (getApiErrorMessage)
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Try response.data.message (NestJS format)
    // Handle validation errors with field-level details
    // Fall back to statusText or error.message
  }
  return fallback
}

// Mutation-level error:
mutations: {
  onError: (error) => {
    toast.error(getApiErrorMessage(error))
  }
}
```

---

## 6. ERROR BOUNDARIES

### Global ErrorBoundary (`components/ErrorBoundary.tsx`)
```typescript
<ErrorBoundary level="global">
  {/* Wraps entire app */}
</ErrorBoundary>

Fallback UI (on error):
- Red alert icon
- "Application Error" message
- Try Again button → resets state
- Go Home button
- Error details (dev mode)
```

### Route-Level ErrorBoundary
```typescript
<ErrorBoundary level="route">
  <Suspense fallback={<PageLoader />}>
    <Routes>{...}</Routes>
  </Suspense>
</ErrorBoundary>
```

### Component-Level ErrorBoundary
```typescript
<ErrorBoundary fallback={<CustomFallback />}>
  <MyComponent />
</ErrorBoundary>
```

---

## 7. KEY PAGES & WORKFLOWS

### Dashboard (`SmartDashboardPage`)
- Quick links (All Patients, Register, New Visit, Lab Queue, Pharmacy, Billing, etc.)
- Stats cards (patient counts, encounters, lab pending, pharmacy dispensed, revenue)
- Role-based visibility (filters by user permissions)

### Pharmacy Queue → Dispense Workflow

**PharmacyQueuePage** (`pages/pharmacy/PharmacyQueuePage.tsx`, 39KB)
```
┌─────────────────────────────────────────────────┐
│ Pharmacy Queue                                  │
├─────────────────────────────────────────────────┤
│ [Search] [Filter by Status] [Filter by Priority]│
│                                                  │
│ Prescriptions:                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Rx #  Patient  Status  Priority  Actions   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ 001   John    pending  High     [Dispense] │ │
│ │ 002   Jane    dispensing Normal [Continue] │ │
│ │ 003   Bob     ready    Low     [Collect]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Call Next Patient] [View Details]              │
└─────────────────────────────────────────────────┘
```

**Flow**:
1. Fetch prescriptions: `prescriptionsService.getByStatus('pending')`
2. Filter by search term, status, priority
3. Click "Dispense" → Navigate to `DispenseMedicationPage`

**DispenseMedicationPage** (`pages/pharmacy/DispenseMedicationPage.tsx`, 51KB)
```
Multi-step workflow:
┌──────────┬────────┬──────┬────────┬──────────┐
│ Search   │ Verify │ Pick │ Check  │ Dispense │
└──────────┴────────┴──────┴────────┴──────────┘
     ↓
     
Step 1: SEARCH
- Input: prescription ID or patient name
- Output: Load Rx details, verify patient, check drug allergies

Step 2: VERIFY
- Show: Patient name, DOB, Allergies, Current meds
- Action: Confirm patient identity

Step 3: PICK (Item Selection)
- For each Rx item:
  - Select batch number
  - Verify expiry date
  - Pick quantity
  - Check remaining stock
  
Step 4: CHECK (QC)
- Patient counseling points (category-based: antibiotic, analgesic, etc.)
- Verify package integrity
- Check labels

Step 5: DISPENSE
- Mark as dispensed
- Print receipt/label
- Update inventory
- Record in sync queue (if offline)
```

**State Management in Dispense**:
```typescript
const [step, setStep] = useState<DispenseStep>('search')
const [prescription, setPrescription] = useState<Prescription | null>(null)
const [selectedItems, setSelectedItems] = useState<DispenseItem[]>([])
const [counsel, setCounsel] = useState<string[]>([]) // Counseling points

// React Query:
const { data: rx } = useQuery(['prescription', rxId], () => 
  prescriptionsService.getPrescription(rxId)
)
const dispenseMutation = useMutation(
  (data) => pharmacyService.dispensePrescription(data),
  { onSuccess: () => { navigate('/pharmacy/queue') } }
)
```

### Lab Queue → Results Entry

**LabQueuePage**: List pending lab orders
**ResultsEntryPage**: Enter test results (numeric/qualitative)
**LabReportsPage**: Generate lab reports

### Billing Flow

**NewOPDBillPage**: Create new bill from encounter
**CollectPaymentPage**: Cash/card/mobile money payment
**PrintReceiptPage**: Generate receipt

---

## 8. OFFLINE & SYNC SYSTEM

### IndexedDB Structure (`lib/sync/db.ts`)

Using **Dexie.js** (IndexedDB wrapper):

```typescript
class GlideOfflineDB extends Dexie {
  syncQueue!: Table<SyncQueueItem>           // Queue of pending operations
  patients!: Table<CachedEntity>             // Cached patient data
  encounters!: Table<CachedEntity>
  vitals!: Table<CachedEntity>
  clinicalNotes!: Table<CachedEntity>
  prescriptions!: Table<CachedEntity>
  labOrders, labResults, imaging, admissions, invoices, payments
  antenatalVisits, postnatalVisits, immunizations
  metadata!: Table<SyncMetadata>             // lastSyncTimestamp, clientId
  conflicts!: Table<SyncConflictLocal>       // Conflict resolution
}

// Initialize DB:
db.version(1).stores({
  syncQueue: '++id, entityType, entityId, status, createdAt',
  patients: 'id, entityType, lastSyncedAt',
  encounters: 'id, entityType, lastSyncedAt, [data.patientId+data.createdAt]',
  // ... composite indexes for queries
})
```

### Sync Flow (`lib/sync/syncManager.ts`)

**Phase 1: Push (Upload Local Changes)**
```
getPendingOperations() from syncQueue
  ↓
For each pending operation:
  POST /sync/push {
    entityType, entityId, operation, payload,
    clientVersion, clientTimestamp, clientId
  }
  ↓
If conflict (server has newer version):
  Mark as 'conflict' → Show conflict resolution UI
  ↓
If success:
  Mark as 'synced' → Move to archive
  ↓
If error:
  Mark as 'failed', increment retryCount
```

**Phase 2: Pull (Download Remote Changes)**
```
POST /sync/pull {
  facilityId, lastSyncTimestamp, clientId
}
  ↓
Server returns:
  [
    { entityType, entityId, data, version, serverTimestamp }
  ]
  ↓
For each item:
  - Check local version vs server version
  - If local newer: Flag conflict
  - Else: Upsert to local DB
  ↓
Update metadata.lastSyncTimestamp
```

**Conflict Resolution**:
```typescript
interface SyncConflictLocal {
  entityType, entityId
  clientPayload (local version)
  serverPayload (remote version)
  conflictingFields: string[]
}

// User can:
- Keep local version
- Accept server version
- Manual merge
```

### Sync Hooks (`lib/sync/hooks.ts`)

```typescript
const { syncStatus, canSync } = useSyncStatus()
// syncStatus = { isOnline, isSyncing, pendingCount, conflictCount, lastSyncAt }

const { isPending, retry } = usePendingCount()

const syncNow = useSync()

const conflicts = useSyncConflicts()
```

### clearAllData() Function
```typescript
// Called on logout
clearAllData() {
  Clear all tables: syncQueue, patients, encounters, vitals,
    clinicalNotes, prescriptions, labOrders, labResults,
    imagingOrders, admissions, invoices, payments,
    antenatalVisits, postnatalVisits, immunizations,
    metadata, conflicts
}
```

**Prevents patient data leaking between users** ✅

---

## 9. COMPREHENSIVE USER FLOW: Login → Dashboard → Pharmacy Dispense

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER FLOW DIAGRAM                          │
└─────────────────────────────────────────────────────────────────┘

[1] LANDING PAGE
    User navigates to https://localhost:5173
    ↓
    App.tsx → AppRoutes.checkSetup()
    ↓
    Is setup complete? → No → Redirect to /setup
                      → Yes → Continue
    ↓
    Is authenticated? → Yes → Redirect to /
                      → No → Redirect to /login

[2] LOGIN PAGE (/login)
    ┌─────────────────────────────────┐
    │ Login Form                      │
    ├─────────────────────────────────┤
    │ [Select Organization] ▼         │
    │ [Username] ________________     │
    │ [Password] ________________     │
    │              [Show/Hide Eye]    │
    │ [Login Button]                  │
    └─────────────────────────────────┘
    
    User selects tenant, enters credentials
    ↓
    authService.login({
      username, password, tenantId
    })
    ↓
    Backend: POST /auth/login
    ↓
    Backend returns:
    {
      user: { id, email, roles, permissions, facilityId, tenantId },
      accessToken, refreshToken
    }
    ↓
    Frontend:
    1. useAuthStore.login(user, accessToken, refreshToken)
       → Persist to localStorage (glide-hims-auth)
    2. sessionStorage.setItem('glide_active_tenant_id', tenantId)
    3. authService.getMe()
       → Fetch { permissions, roles, accessibleModules }
    4. navigate('/')

[3] DASHBOARD (/  → SmartDashboardPage)
    ┌─────────────────────────────────────────────────┐
    │ Welcome, John (Pharmacist)                      │
    ├─────────────────────────────────────────────────┤
    │                                                 │
    │ QUICK STATS:                                    │
    │ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
    │ │ Patients │ │ Encounters│ │Lab Orders│        │
    │ │   245    │ │    12     │ │    8     │        │
    │ └──────────┘ └──────────┘ └──────────┘        │
    │                                                 │
    │ QUICK LINKS:                                    │
    │ [All Patients] [Register] [Lab Queue]          │
    │ [Pharmacy]     [Billing]  [Reports]            │
    │                                                 │
    │ NAVIGATION SIDEBAR (DashboardLayout):          │
    │ ├─ Patients                                     │
    │ ├─ Encounters                                   │
    │ ├─ Pharmacy                                     │
    │ │  ├─ Queue      ← USER CLICKS HERE            │
    │ │  ├─ Stock      ↓                              │
    │ │  └─ Reports                                   │
    │ ├─ Lab                                          │
    │ ├─ Billing                                      │
    │ └─ Reports                                      │
    └─────────────────────────────────────────────────┘

[4] PHARMACY QUEUE (/pharmacy/queue → PharmacyQueuePage)
    ┌─────────────────────────────────────────────────┐
    │ Pharmacy Queue                                  │
    ├─────────────────────────────────────────────────┤
    │ [Search...] [Status ▼] [Priority ▼] [Refresh]  │
    │                                                 │
    │ PENDING PRESCRIPTIONS:                          │
    │ ┌─────────────────────────────────────────────┐ │
    │ │ Rx # │ Patient  │ Status   │ Pri │ Action   │ │
    │ ├─────────────────────────────────────────────┤ │
    │ │ 001  │ John Doe │ pending  │ H   │[Dispense]│ │
    │ │ 002  │ Jane S.  │ ready    │ N   │[Collect] │ │
    │ │ 003  │ Bob M.   │ dispensed│ L   │ - Closed │ │
    │ └─────────────────────────────────────────────┘ │
    │                                                 │
    │ [Call Next Patient] [View Details]              │
    └─────────────────────────────────────────────────┘
    
    React Query:
    - useQuery(['pharmacy-queue'], 
        () => prescriptionsService.getByStatus('pending'))
    - Refetch every 5 seconds
    
    User clicks [Dispense] on Rx 001
    ↓
    navigate('/pharmacy/dispense?rxId=001')

[5] DISPENSE MEDICATION (/pharmacy/dispense → DispenseMedicationPage)
    
    STEP 1: SEARCH (Current)
    ┌─────────────────────────────────┐
    │ Step 1: Search                  │
    ├─────────────────────────────────┤
    │ [Enter Rx ID or Patient Name]  │
    │ ________________               │
    │                [Search]         │
    │                                 │
    │ Results:                        │
    │ Rx #001 - John Doe              │
    │           DOB: 1980-05-15       │
    │           Age: 44               │
    │                                 │
    │              [Continue →]       │
    └─────────────────────────────────┘
    
    React Query:
    - useQuery(['prescription', rxId],
        () => prescriptionsService.getPrescription(rxId))
    - Loads prescription + patient details
    
    User clicks [Continue →]
    ↓
    Step changes: 'search' → 'verify'

    STEP 2: VERIFY
    ┌─────────────────────────────────┐
    │ Step 2: Verify Patient          │
    ├─────────────────────────────────┤
    │ Patient: John Doe               │
    │ MRN: MRN-001-2024              │
    │ DOB: 1980-05-15                 │
    │ Age: 44 years                   │
    │                                 │
    │ ALLERGIES: ⚠️                   │
    │ • Penicillin (anaphylaxis)      │
    │ • Aspirin (rash)                │
    │                                 │
    │ CURRENT MEDICATIONS:             │
    │ • Metformin 500mg               │
    │ • Lisinopril 10mg               │
    │                                 │
    │ [← Back] [Confirm & Continue →] │
    └─────────────────────────────────┘
    
    User confirms: setStep('pick')

    STEP 3: PICK
    ┌─────────────────────────────────────────┐
    │ Step 3: Pick Items                      │
    ├─────────────────────────────────────────┤
    │ PRESCRIPTION ITEMS:                     │
    │                                         │
    │ Item 1: Amoxicillin 500mg Capsules      │
    │ Quantity: 30                            │
    │                                         │
    │ [Batch Number]    ▼ [Batch-2024-001]   │
    │ [Expiry Date]         2026-06-30        │
    │ [Pick Qty]        [30]                  │
    │ Stock Available: 150                    │
    │                                         │
    │ ✓ Item picked                           │
    │                                         │
    │ [← Back] [Continue →]                   │
    └─────────────────────────────────────────┘
    
    State update: selectedItems = [{ itemId, batchNumber, expiry, qty }]
    useMutation triggers: POST /inventory/reserve (holds stock)
    
    User picks all items, clicks [Continue →]
    ↓
    setStep('check')

    STEP 4: CHECK (QC)
    ┌─────────────────────────────────────────┐
    │ Step 4: Quality Check                   │
    ├─────────────────────────────────────────┤
    │ COUNSELING POINTS (Antibiotic):         │
    │ ☐ Complete full course                  │
    │ ☐ Take at even intervals                │
    │ ☐ Take with food if stomach upset       │
    │ ☐ Avoid alcohol                         │
    │                                         │
    │ PACKAGE INTEGRITY:                      │
    │ ☐ Blister intact, no breaks             │
    │ ☐ Labels legible                        │
    │ ☐ No signs of tampering                 │
    │                                         │
    │ [← Back] [Continue →]                   │
    └─────────────────────────────────────────┘
    
    User checks boxes, clicks [Continue →]
    ↓
    setStep('dispense')

    STEP 5: DISPENSE
    ┌─────────────────────────────────────────┐
    │ Step 5: Complete Dispense               │
    ├─────────────────────────────────────────┤
    │ FINAL SUMMARY:                          │
    │                                         │
    │ Patient: John Doe (MRN-001-2024)        │
    │                                         │
    │ Items:                                  │
    │ Amoxicillin 500mg × 30 capsules         │
    │ Batch: 2024-001, Expiry: 2026-06-30    │
    │                                         │
    │ READY TO DISPENSE ✓                    │
    │                                         │
    │ [← Back] [Dispense & Print]             │
    │          (or [Skip Print])              │
    └─────────────────────────────────────────┘
    
    useMutation fires:
    POST /pharmacy/dispense {
      prescriptionId, items, dispensedBy, timestamp
    }
    ↓
    Backend processes:
    - Mark prescription as 'dispensed'
    - Deduct from inventory
    - Create pharmacy sale record
    - Update patient medication history
    ↓
    Sync Queue:
    if (navigator.onLine) {
      POST immediately
    } else {
      Queue operation to IndexedDB
      Show "Queued for sync" badge
    }
    ↓
    Frontend response:
    toast.success('Prescription dispensed successfully')
    Print receipt/label (JSPdf)
    navigate('/pharmacy/queue')
    ↓
    User back at queue, sees prescription moved to 'dispensed'

[6] SESSION EXPIRY HANDLING
    
    30 minutes of inactivity:
    - useSessionTimeout hook resets on user activity
    - At 25 minutes (warning point): Show modal warning
    - At 30 minutes: Auto logout
      - Clear auth store
      - Clear IndexedDB
      - Clear sessionStorage
      - Redirect to /login?expired=true
      - Show: "Your session has expired"

[7] LOGOUT (/logout or user clicks logout button)
    
    useAuthStore.logout():
    1. Clear Zustand state
    2. sessionStorage.clear()
    3. clearAllData() → IndexedDB wipe
    4. ProtectedRoute redirects to /login
    ↓
    Next login starts fresh cycle

[8] OFFLINE SCENARIO
    
    User losing internet connection during dispense:
    
    At Step 5 [Dispense & Print]:
    useMutation tries POST /pharmacy/dispense
    ↓
    Network error (no internet):
    queueOperation('pharmacy_dispensing', {
      prescriptionId, items, timestamp
    }) → Save to IndexedDB.syncQueue
    ↓
    Show: "Saved offline - will sync when online"
    ↓
    User continues other work (search patients, view vitals, etc.)
    All API calls similarly queued to IndexedDB
    ↓
    Internet restored:
    - Window 'online' event fires
    - syncNow() triggered
    - syncQueue operations POSTed to server
    - conflicts detected if needed
    - UI shows sync progress
    ↓
    Dispense finally recorded on server
    User sees "Synced ✓" confirmation

[9] FACILITY SWITCHING
    
    User clicks FacilitySwitcher component:
    ├─ Facility 1 (Current)
    ├─ Facility 2
    └─ Facility 3
    
    Selection triggers:
    sessionStorage.setItem('glide_active_facility_id', facilityId)
    ↓
    Next API call includes:
    header: x-facility-id = facilityId
    ↓
    Backend filters data by facility
    ↓
    QueryClient.invalidateQueries()
    ↓
    All pages re-fetch data for new facility
    Dashboard updates with new facility's stats

```

---

## 10. STATE FLOW SUMMARY

```
┌─────────────────────────────────────┐
│     AUTHENTICATION STATE            │
└─────────────────────────────────────┘
    ↓
    useAuthStore (Zustand)
    {
      user: User | null
      accessToken: string | null
      refreshToken: string | null
      isAuthenticated: boolean
    }
    ↓ (persisted to localStorage)
    ↓
    On Page Load:
    - Restore from localStorage
    - Validate token via /auth/profile
    - If invalid: Refresh via /auth/refresh
    - If refresh fails: Logout

┌─────────────────────────────────────┐
│     API REQUEST STATE               │
└─────────────────────────────────────┘
    ↓
    Request Interceptor:
    - Add Authorization header
    - Add x-facility-id header
    - Add x-tenant-id header
    ↓
    Response Interceptor:
    - If 401: Refresh token (mutex pattern)
    - If 403: Toast error "Access Denied"
    - Else: Return response

┌─────────────────────────────────────┐
│     DATA FETCHING STATE             │
└─────────────────────────────────────┘
    ↓
    React Query (TanStack Query)
    {
      queryKey: [entityType, filters],
      queryFn: () => serviceMethod(),
      staleTime: 5m (default),
      cacheTime: 10m,
      retry: 1,
      refetchOnWindowFocus: false
    }
    ↓
    If offline:
    - Try cache first
    - If not in cache: Queue to IndexedDB
    - UI shows "offline mode"

┌─────────────────────────────────────┐
│     SYNC STATE                      │
└─────────────────────────────────────┘
    ↓
    IndexedDB (Dexie)
    syncQueue: [{
      entityType, entityId, operation,
      payload, status, retryCount
    }]
    ↓
    On Connection Restore:
    - Fetch pending operations
    - POST /sync/push
    - POST /sync/pull
    - Merge results
    - Update local cache
```

---

## 11. KEY FILES & LINES OF CODE

| File | LOC | Purpose |
|------|-----|---------|
| `src/App.tsx` | ~1100 | Main routing, setup check, session timeout wrapper |
| `src/store/auth.ts` | 130 | Zustand auth store with persistence |
| `src/services/api.ts` | 193 | Axios instance + interceptors |
| `src/services/pharmacy.ts` | 816 | Pharmacy APIs (40+ endpoints) |
| `src/services/hr.ts` | 802 | HR module APIs |
| `src/services/lab.ts` | 457 | Lab testing APIs |
| `src/pages/pharmacy/DispenseMedicationPage.tsx` | 51 KB | Multi-step dispense workflow |
| `src/pages/pharmacy/PharmacyQueuePage.tsx` | 39 KB | Queue management |
| `src/lib/sync/db.ts` | ~200 | Dexie IndexedDB setup |
| `src/lib/sync/syncManager.ts` | ~200 | Push/pull sync logic |
| `src/components/DashboardLayout.tsx` | 67 KB | Main dashboard + sidebar |
| `src/components/ErrorBoundary.tsx` | 98 | Global error handling |
| `src/components/ProtectedRoute.tsx` | 65 | Route authentication guard |
| `src/components/RoleRoute.tsx` | 97 | Role-based route guard |
| `src/hooks/useSessionTimeout.ts` | 150 | Inactivity timeout hook |

---

## 12. CONFIGURATION & ENVIRONMENT

### `vite.config.ts`
```typescript
- HTTPS dev server (localhost:5173)
- Proxy /api → http://localhost:3000
- Proxy /socket.io → ws://localhost:3000
- Tailwind CSS + React plugins
```

### `package.json` (Dependencies)
```
React 19 + TypeScript
@tanstack/react-query: Data fetching & caching
axios: HTTP client
zustand: State management
react-router-dom: Routing
dexie: IndexedDB wrapper
sonner: Toast notifications
tailwindcss: Styling
lucide-react: Icons
```

### `tsconfig.app.json`
- Target: ES2020
- Module: ESNext
- Strict mode enabled
- JSX: react-jsx

---

## 13. SECURITY HIGHLIGHTS

✅ **Authentication**
- JWT tokens with auto-refresh
- Session timeout on inactivity (30 min)
- Tokens cleared on logout
- IndexedDB wiped on logout (patient data isolation)

✅ **Authorization**
- Role-based access control (RBAC)
- Permission checks at route level + component level
- Super Admin bypass only for Super Admin role

✅ **Data Privacy**
- Multi-tenant isolation: x-tenant-id header
- Multi-facility filtering: x-facility-id header
- Patient data cleared between user sessions

✅ **Error Handling**
- 403 Forbidden: Access Denied toast
- 401 Unauthorized: Auto-refresh or logout
- Network errors: Queue to IndexedDB, retry on restore

---

## 14. PERFORMANCE OPTIMIZATIONS

⚡ **Code Splitting**
- 100+ lazy-loaded pages via React.lazy()
- Separate bundles per route
- Suspense fallback: PageLoader

⚡ **Data Caching**
- React Query: staleTime=5m, cacheTime=10m
- localStorage: Auth state persistence
- IndexedDB: Offline cache

⚡ **Sync Optimization**
- Batch operations in syncQueue
- Mutex pattern: Prevent concurrent token refreshes
- Throttle: Session timeout reset max once/sec

⚡ **Network**
- Vite proxy: Avoid CORS
- Axios interceptors: Reuse connections
- WebSocket: Real-time updates via Socket.io

---

## 15. DEBUGGING & MONITORING

### Console Logs
```typescript
[App] Setup status, token validation
[SESSION] Inactivity timeout, session expiry
[ErrorBoundary] Caught errors
```

### React DevTools
- Profiler: Track rendering performance
- Components: Inspect Zustand state

### Network Tab
- Monitor API requests/responses
- Token refresh flow
- Sync push/pull operations

### Application Tab (IndexedDB)
- `GlideHIMSOfflineDB`
- Tables: syncQueue, patients, encounters, etc.
- Inspect pending operations

### Conflict Resolution UI (`pages/sync/ConflictResolutionPage`)
- View conflicting entities
- Choose resolution strategy (local/server/merge)

---

## CONCLUSION

This frontend system provides:
- **Type-safe**: Full TypeScript coverage
- **Performant**: Code splitting, caching, query batching
- **Resilient**: Offline support, auto-refresh, error boundaries
- **Secure**: RBAC, multi-tenant isolation, session management
- **Scalable**: 100+ routes, 40+ services, modular architecture
- **User-friendly**: Role-based dashboards, intuitive workflows, real-time feedback

Perfect for a complex healthcare system serving doctors, nurses, pharmacists, lab technicians, cashiers, and admins across multiple facilities.
