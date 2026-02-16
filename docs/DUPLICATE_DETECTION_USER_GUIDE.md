# Quick Reference: Understanding Duplicate Warnings

## For Hospital Registration Staff

### What is a Duplicate Patient?
A **duplicate patient** means you're trying to register someone who is **already in the system**. This could happen when:
- The same patient visits again (forgot they were registered)
- Typos in the name during previous registration
- Patient gives different information each visit

### Why Do We Check for Duplicates?
- ✅ **Patient Safety**: Avoid split medical records
- ✅ **Data Quality**: Keep one complete record per patient
- ✅ **Medical History**: Ensure doctors see full patient history
- ✅ **Billing Accuracy**: Prevent duplicate charges

---

## Understanding the Warning Screen

When you see a **"Possible Duplicate Found"** warning, here's what it means:

### The Colors Mean:
- 🔴 **RED Border**: High confidence (85%+) - Very likely the same person
- 🟡 **YELLOW Border**: Medium confidence (60-84%) - Possibly the same person
- 🔵 **BLUE Border**: Low confidence (<60%) - Probably not shown

### The Badges Show:
- **"95% Match - HIGH"**: Almost certainly the same person
- **"70% Match - MEDIUM"**: Needs careful review
- Match percentage = how similar the records are

### What You'll See:
1. **Your New Entry** (blue box at top)
2. **Potential Matches** (colored boxes below)
3. **Match Reasons** - Why we think it's a duplicate
4. **Last Visit Date** - When they were last here

---

## What Are "Match Reasons"?

### Examples You'll See:

**"Identical National ID"**
→ 100% duplicate - Same government ID number
→ **Action**: DO NOT register, use existing record

**"Exact name match" + "Exact date of birth match"**
→ Very high confidence - Same name and birthday
→ **Action**: Check with patient, likely duplicate

**"Very similar name (possible typo)" + "Exact date of birth match"**
→ Example: "Elvis Ntuyo" vs "Ntuyo Elvis" 
→ **Action**: Probably same person, check records

**"Same gender" + "Date of birth within 3 days"**
→ Could be data entry error from before
→ **Action**: Verify with patient

---

## When to Click "Go Back & Edit"

Click this if:
- ✅ You made a typo in the current registration
- ✅ Patient confirms they were registered before
- ✅ High confidence match (85%+) and details match
- ✅ You want to verify information before proceeding

What happens:
- Returns to registration form
- You can correct any mistakes
- Search for existing record instead

---

## When to Click "Register Anyway"

Click this ONLY if you're sure it's a NEW patient:

### Valid Reasons:
1. **Family Members**
   - Example: Mother and child share phone number
   - Different people, same contact info

2. **Common Names**
   - Example: "John Smith" born different dates
   - Same name doesn't mean same person

3. **Different Person, Similar Info**
   - Example: Twins with same birthday, different names
   - Similar but clearly not the same

### ⚠️ Important Notes:
- **Phone numbers alone DO NOT mean duplicate** - families share phones!
- **Same surname is normal** - family members visit hospital
- Always verify National ID if provided
- When in doubt, check with supervisor

---

## Step-by-Step: What To Do

### STEP 1: Review the Warning
Look at the **Match %** and **Match Reasons**

### STEP 2: Check Key Details
Compare these carefully:
- ✅ Full Name (spelling, order)
- ✅ Date of Birth
- ✅ National ID (if available)
- ✅ Gender

**Note**: Phone number alone is NOT enough!

### STEP 3: Ask the Patient
Simple questions:
- "Have you visited this hospital before?"
- "Do you remember your patient number (MRN)?"
- "Is this your phone number: [show number]?"

### STEP 4: Decide
- **If same person**: Click "Go Back", search for existing record
- **If different person**: Click "Register Anyway"
- **If unsure**: Call supervisor or click "View Full Record"

---

## Common Scenarios

### Scenario 1: Same Phone, Different Person ✅
```
Existing: Jane Doe, +256700123456
New: John Doe, +256700123456 (husband)
```
**Decision**: Register Anyway - Different people sharing phone

### Scenario 2: Name Typo 🔴
```
Existing: Elvis Ntuyo, DOB: 1985-03-20
New: Ntuyo Elvis, DOB: 1985-03-20
```
**Decision**: Go Back - Same person, name reversed

### Scenario 3: Same Name, Different DOB ✅
```
Existing: Mary Smith, DOB: 1990-05-15
New: Mary Smith, DOB: 1992-08-20
```
**Decision**: Register Anyway - Common name, different people

### Scenario 4: Exact National ID Match 🔴
```
Existing: Patient A, ID: CM123456
New: Patient B, ID: CM123456
```
**Decision**: NEVER Register - National IDs are unique!

---

## Tips for Preventing Duplicates

### Before Starting New Registration:
1. **Always search first** using:
   - Patient name
   - Phone number
   - National ID
   
2. **Ask the patient**: "Have you been here before?"

3. **Check spelling carefully**:
   - "NTUYO" vs "NUTUYO"
   - "ELVIS" vs "ELVES"

4. **Verify date of birth**: Read it back to patient

### Data Entry Best Practices:
- ✍️ Use proper capitalization
- ✍️ No extra spaces
- ✍️ Confirm National ID format
- ✍️ Include country code for phone (+256)

---

## Questions & Support

### Who to Contact:
- **Technical Issues**: IT Support
- **Unclear Warnings**: Supervisor
- **System Training**: Registration Manager

### Need Help?
- Click **"View Full Record"** to see complete patient history
- Check last visit date - if recent, likely duplicate
- Review match reasons carefully
- When in doubt, ask!

---

## Remember:
✅ Duplicate warnings are **helping you**, not blocking you  
✅ Phone sharing is **normal and expected**  
✅ "Register Anyway" is **safe to use** when appropriate  
✅ **Patient safety** comes first - one record per person

---

**Questions?** Ask your supervisor or check the full documentation.
