# How to Find Hospital Insurance Enrollment

## 📍 Location in Navigation Menu

The Hospital Insurance Enrollment page can be accessed from the main navigation:

```
Registration (Section)
  └── Insurance Desk
      └── Hospital Scheme Enrollment  ⭐ (First option)
```

## 🎯 Step-by-Step Instructions

### Method 1: Via Navigation Menu (Recommended)

1. **Log in** to the system
2. Look at the **left sidebar navigation**
3. Find the **"Registration"** section (with UserPlus icon)
4. Click on **"Insurance Desk"** (with Shield icon)
5. Click **"Hospital Scheme Enrollment"** (first item in the list)

### Method 2: Via OPD Token Page

1. Go to **OPD Token** page (`/opd/token`)
2. Select a patient who is **not enrolled**
3. Choose payment method: **"Hospital Scheme"** or **"Staff"**
4. You'll see a warning: "⚠️ Patient must have a linked user account"
5. Click the **"Enroll Now"** button
6. This redirects to the enrollment page with patient MRN pre-filled

### Method 3: Direct URL

Navigate directly to:
```
http://your-hospital-domain:4173/patients/hospital-scheme-enroll
```

## 🔐 Required Permissions

To access this page, users need:
- `insurance.create` permission
- Must be logged in with proper role (Reception, Insurance Desk staff)

## 📝 What You'll See

The enrollment page has **4 steps**:

1. **Search Patient** - Enter MRN to find the patient
2. **Create User Account** - Set username and password for biometric login
3. **Register Fingerprint** - Scan patient's fingerprints
4. **Complete Enrollment** - System automatically links user to patient

## 💡 Quick Tips

- The link is located **first** in the Insurance Desk submenu
- Look for the **BadgeCheck icon** (✓ in shield)
- If you don't see it, check your user permissions
- You can bookmark the page for quick access

## 🎨 Visual Reference

```
┌─ Dashboard Sidebar ─────────────────┐
│                                     │
│ [Dashboard Icon] Dashboard          │
│                                     │
│ ┌─ Registration Section ──────┐    │
│ │  [UserPlus] Registration     │    │
│ │                              │    │
│ │  ▼ Patient Management        │    │
│ │  ▼ Queue & Tokens            │    │
│ │  ▼ Channelling               │    │
│ │  ▼ Reception Billing         │    │
│ │                              │    │
│ │  ▼ Insurance Desk ⬅️ CLICK   │    │
│ │     ┌────────────────────┐   │    │
│ │     │ ✓ Hospital Scheme  │ ⭐│    │
│ │     │   Enrollment       │   │    │
│ │     ├────────────────────┤   │    │
│ │     │ Verify Coverage    │   │    │
│ │     │ Pre-Authorization  │   │    │
│ │     │ Claim Submission   │   │    │
│ │     │ Insurance Cards    │   │    │
│ │     └────────────────────┘   │    │
│ │                              │    │
│ └──────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

## ❓ Troubleshooting

**Q: I don't see "Registration" section**
- Check if you're logged in
- Verify your user role has registration permissions

**Q: I see "Insurance Desk" but not "Hospital Scheme Enrollment"**
- Check if you have `insurance.create` permission
- Contact system administrator to update your role

**Q: Link appears but clicking does nothing**
- Clear browser cache and reload
- Check browser console for errors
- Verify frontend service is running

## 📞 Need Help?

If you still can't find it, contact your system administrator or IT support.
