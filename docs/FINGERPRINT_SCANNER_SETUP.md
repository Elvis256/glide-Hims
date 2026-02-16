# Fingerprint Scanner Setup Guide

## ⚠️ "Scanner not detected" Error

This error means the **fingerprint service** is not running on your computer.

## What You Need

### Hardware:
- **SecuGen Fingerprint Scanner** (USB device)
- USB port on your computer

### Software:
- **Fingerprint Service** (running locally on port 8444 for Linux or 8443 for Windows)

---

## Quick Fix: Check Scanner Service

The frontend looks for a fingerprint service at:
- **Linux:** `http://localhost:8444`
- **Windows:** `https://localhost:8443`

### Step 1: Check if Service is Running

```bash
# For Linux
curl http://localhost:8444/health

# For Windows
curl https://localhost:8443/api/ping
```

**Expected Response:**
```json
{"status": "ok", "device": "connected"}
```

If you get "Connection refused" or "Failed to connect", the service is **not running**.

---

## Setting Up Fingerprint Service

### Option 1: Linux Fingerprint Service (Recommended)

The system includes a custom fingerprint service for Linux.

#### Check if it exists:
```bash
ls -la /home/avis/Hospital/glide-Hims/infrastructure/fingerprint-service/
```

#### Start the service:
```bash
cd /home/avis/Hospital/glide-Hims/infrastructure/fingerprint-service
sudo npm install
sudo node server.js
```

The service should start on port **8444**.

#### Make it run automatically (systemd):
```bash
sudo nano /etc/systemd/system/fingerprint-service.service
```

Add:
```ini
[Unit]
Description=Fingerprint Scanner Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/avis/Hospital/glide-Hims/infrastructure/fingerprint-service
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fingerprint-service
sudo systemctl start fingerprint-service
sudo systemctl status fingerprint-service
```

---

### Option 2: Windows SecuGen WebAPI

If running on Windows, install SecuGen WebAPI:

1. Download from SecuGen website
2. Install the SecuGen WebAPI software
3. Ensure it's running on port 8443
4. Accept the SSL certificate in browser

---

## Verify Scanner Hardware

### Check USB Connection:

**Linux:**
```bash
lsusb | grep -i secugen
```

**Expected output:**
```
Bus 001 Device 005: ID 147e:2016 SecuGen Corporation Fingerprint Reader
```

If you don't see this, the scanner is **not connected**.

### Install Scanner Drivers (if needed):

**For Linux:**
```bash
# Install libusb (required for USB devices)
sudo apt-get install libusb-1.0-0 libusb-1.0-0-dev

# Add udev rules for SecuGen device
sudo nano /etc/udev/rules.d/99-secugen.rules
```

Add this line:
```
SUBSYSTEM=="usb", ATTRS{idVendor}=="147e", ATTRS{idProduct}=="2016", MODE="0666", GROUP="plugdev"
```

Reload udev:
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Unplug and replug the scanner.

---

## Testing the Setup

### 1. Test Scanner Service API:

```bash
# Check health
curl http://localhost:8444/health

# Get device info
curl http://localhost:8444/device-info

# Test capture (requires scanner)
curl -X POST http://localhost:8444/capture \
  -H "Content-Type: application/json" \
  -d '{"timeout": 10, "quality": 50}'
```

### 2. Test from Frontend:

1. Open Browser Developer Console (F12)
2. Go to Hospital Scheme Enrollment page
3. Check console for errors like:
   - `Failed to fetch http://localhost:8444/health`
   - `Connection refused`
   - `Scanner not detected`

---

## Troubleshooting

### Issue: "Connection refused"
**Cause:** Service not running
**Fix:** Start the fingerprint service (see Option 1 or 2 above)

### Issue: "Scanner not detected" but service is running
**Cause:** Scanner hardware not connected
**Fix:** 
1. Check USB cable
2. Run `lsusb` to verify device is detected
3. Check scanner LED is on
4. Try different USB port

### Issue: "Permission denied" when accessing USB
**Cause:** User doesn't have USB device permissions
**Fix:**
```bash
sudo usermod -a -G plugdev $USER
# Logout and login again
```

### Issue: Service starts but immediately crashes
**Cause:** Missing dependencies or wrong node modules
**Fix:**
```bash
cd /home/avis/Hospital/glide-Hims/infrastructure/fingerprint-service
rm -rf node_modules
npm install
```

### Issue: CORS errors in browser console
**Cause:** Fingerprint service not allowing requests from frontend
**Fix:** Update fingerprint service CORS settings to allow `http://192.168.1.9:4173`

---

## Temporary Workaround: Skip Fingerprint Registration

If you don't have a scanner right now but want to continue:

### Option A: Mock the Fingerprint Service

Create a simple mock service:

```bash
mkdir -p /tmp/mock-fingerprint
cd /tmp/mock-fingerprint
npm init -y
npm install express cors body-parser
```

Create `mock-server.js`:
```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', device: 'connected' });
});

app.get('/device-info', (req, res) => {
  res.json({
    connected: true,
    deviceName: 'Mock Scanner',
    serialNumber: 'MOCK123',
  });
});

app.post('/capture', (req, res) => {
  // Return fake template data
  res.json({
    success: true,
    imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    templateData: 'MOCK_TEMPLATE_' + Date.now(),
    quality: 85,
  });
});

app.listen(8444, () => {
  console.log('Mock fingerprint service running on port 8444');
});
```

Run it:
```bash
node mock-server.js
```

Now try the enrollment again - it will accept fake fingerprints.

**⚠️ WARNING: This is for testing only! Don't use in production!**

---

## Option B: Complete Enrollment Without Fingerprint

If fingerprints are not critical right now, you can manually link the user to patient in database:

```bash
# Get the created user ID
PGPASSWORD='glide_hims_dev' psql -h localhost -U glide_hims -d glide_hims_dev -c \
  "SELECT id, username FROM users WHERE username='mrn26000001';"

# Copy the user ID, then link to patient
PGPASSWORD='glide_hims_dev' psql -h localhost -U glide_hims -d glide_hims_dev -c \
  "UPDATE patients SET user_id='<USER_ID_HERE>' WHERE mrn='MRN26000001';"
```

This completes the enrollment without biometrics. Patient won't be able to use fingerprint verification at OPD, but they can use other payment methods.

---

## Production Checklist

Before going live, ensure:

- [ ] Fingerprint scanner is connected to reception computer
- [ ] Scanner LED turns on when plugged in
- [ ] `lsusb` shows SecuGen device
- [ ] Fingerprint service is running (`systemctl status fingerprint-service`)
- [ ] Service responds to health check (`curl localhost:8444/health`)
- [ ] Frontend can communicate with service (check browser console)
- [ ] Test enrollment with real fingerprint
- [ ] Test verification at OPD Token page
- [ ] Backup plan if scanner fails (use alternative payment method)

---

## Support Information

**Scanner Model:** SecuGen Hamster Pro 20 (or compatible)
**Service Port (Linux):** 8444
**Service Port (Windows):** 8443
**USB Vendor ID:** 147e
**USB Product ID:** 2016

For hardware issues, contact SecuGen support or your IT vendor.
