# Quick Reference: Hospital Insurance Enrollment

## For Reception Staff

### When to Enroll a Patient

✅ **Enroll When:**
- Patient wants to join hospital insurance scheme
- Patient will use hospital coverage for treatments
- Patient needs biometric verification

❌ **Do NOT Enroll:**
- During regular patient registration
- For cash payments
- For external insurance (use insurance page instead)

---

## Enrollment Steps (5 Minutes)

### 1️⃣ Navigate to Enrollment Page
- Click: **Patients** → **Hospital Scheme Enrollment**
- Or go to: `/patients/hospital-scheme-enroll`

### 2️⃣ Search Patient
- Enter patient's **MRN** (Medical Record Number)
- Example: `MRN26000002`
- Click "Find Patient"

**If Error:**
- "Patient not found" → Register patient first
- "Already enrolled" → Patient is already in system

### 3️⃣ Create User Account
**Auto-filled for you:**
- Username: `mrn26000002` (MRN in lowercase)
- Email: From patient record
- Phone: From patient record

**You must:**
- Set a **password** (minimum 8 characters)
- Confirm the password
- Write down the username & password for patient

**Give to patient:**
- Username: ___________________
- Password: ___________________

### 4️⃣ Register Fingerprint
- Click "Start Fingerprint Registration"
- Ask patient to place finger on scanner
- System will guide through the process
- At least **one fingerprint** required
- Recommended: Register **2-3 fingers**

### 5️⃣ Complete!
- System automatically links user to patient
- Patient is now enrolled
- Can issue OPD tokens with biometric verification

---

## Using Hospital Scheme at OPD

### When Issuing Token:
1. Select patient
2. Choose payment: **"Hospital Scheme"**
3. Click **"Verify Fingerprint"**
4. Patient places finger on scanner
5. ✅ If verified → Issue token
6. ❌ If not verified → Check finger placement, try again

### If Patient Not Enrolled:
- System shows: "⚠️ Patient not enrolled"
- Click **"Enroll Now"** button
- Follow enrollment steps above

---

## Common Questions

**Q: What if patient forgets password?**
A: Admin can reset password in Users page. Contact IT support.

**Q: What if fingerprint doesn't work?**
A: Try different finger. If still fails, re-enroll the patient.

**Q: Can I enroll staff members?**
A: Yes, use same process. HR will update insurance coverage later.

**Q: What if scanner is not working?**
A: Check USB connection. Restart browser. Call IT if issue persists.

**Q: Do I need internet?**
A: No, system works offline. Fingerprint matching is done locally.

**Q: Can patient enroll themselves?**
A: No, must be done by authorized staff with scanner access.

---

## Troubleshooting

### ❌ "Patient not found"
→ Register patient first at `/patients/new`

### ❌ "Patient already enrolled"
→ Patient is already in system. Can issue tokens directly.

### ❌ "Fingerprint quality too low"
→ Clean patient's finger. Press firmly. Try different finger.

### ❌ "User account already exists"
→ This username is taken. Modify username or contact admin.

### ❌ "Scanner not detected"
→ Check USB connection. Refresh page. Restart scanner.

---

## Tips for Success

✅ **Before Starting:**
- Make sure patient is present
- Verify patient identity (ask for ID)
- Have MRN ready

✅ **During Enrollment:**
- Explain process to patient
- Write down username & password CLEARLY
- Give credentials to patient immediately

✅ **After Enrollment:**
- Test fingerprint verification
- Explain how to use at OPD
- Keep enrollment record

✅ **Best Practices:**
- Enroll patients during quiet hours
- Register multiple fingers (backup)
- Clean scanner regularly
- Report technical issues immediately

---

## Quick Actions

| **Task** | **Steps** |
|----------|-----------|
| Enroll Patient | Patients → Hospital Scheme Enroll → Enter MRN → Create Account → Register Finger |
| Check if Enrolled | OPD Token → Select Patient → Look for "Verify Fingerprint" button |
| Issue Token | OPD → Select Patient → Hospital Scheme → Verify Finger → Issue |
| Re-enroll | Admin → Unlink user → Re-enroll through enrollment page |

---

## Need Help?

**Technical Issues**: IT Support  
**Process Questions**: Supervisor  
**System Errors**: Check documentation in `/docs`

**Emergency**: If system is down, use **Cash** payment and enroll later.

---

## Remember

🔑 **Security**: Never share patient credentials  
👆 **Quality**: Clean fingers = better scans  
📝 **Records**: Always write down username/password  
✅ **Verification**: Test fingerprint before patient leaves

---

Print this page and keep at reception desk for quick reference.

**Updated**: February 16, 2026
