# Fingerprint Scanner "Not Detected" Troubleshooting

## Issue
Frontend shows "Scanner not detected" but the scanner is plugged in.

## Root Cause
The browser is trying to connect to `localhost:8444`, but when accessing the system from a different device (e.g., accessing `http://192.168.1.9:4173` from another computer), `localhost` refers to the **client's machine**, not the **server**.

## Solution Applied
The frontend now **auto-detects** the correct URL:
- If accessing via `localhost` → Uses `http://localhost:8444`
- If accessing via IP (e.g., `192.168.1.9`) → Uses `http://192.168.1.9:8444`

## Quick Test

### Option 1: Use Test Page
Open in your browser:
```
http://192.168.1.9:4173/test-fingerprint.html
```

This will:
- Show the auto-detected fingerprint service URL
- Test the connection
- Show detailed error messages if connection fails

### Option 2: Browser Console Test
1. Open enrollment page
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Run this command:
```javascript
fetch('http://192.168.1.9:8444/health')
  .then(r => r.json())
  .then(d => console.log('Scanner status:', d))
  .catch(e => console.error('Connection failed:', e));
```

**Expected output:**
```json
{
  "status": "ok",
  "secugen_available": true,
  "mock_mode": false
}
```

## Troubleshooting Steps

### Step 1: Verify Service is Running
```bash
systemctl status fingerprint-service
```

**Expected:** `Active: active (running)`

If not running:
```bash
sudo systemctl start fingerprint-service
```

### Step 2: Test Local Connection
On the server:
```bash
curl http://localhost:8444/health
```

**Expected:**
```json
{"status": "ok", "secugen_available": true, "mock_mode": false}
```

### Step 3: Test Network Connection
From the server:
```bash
curl http://192.168.1.9:8444/health
```

From any computer on the network:
```bash
curl http://192.168.1.9:8444/health
```

If this fails, check firewall:
```bash
sudo ufw status
sudo ufw allow 8444/tcp
```

### Step 4: Check Scanner Hardware
```bash
lsusb | grep -i secugen
```

**Expected output:**
```
Bus 001 Device 006: ID 1162:2203 Secugen Corp. SecuGen USB U10
```

If missing:
- Unplug and replug the USB scanner
- Try a different USB port
- Check USB cable

### Step 5: Check Service Logs
```bash
sudo journalctl -u fingerprint-service -f
```

Look for:
- ✅ `INFO:__main__:SecuGen SDK initialized successfully`
- ✅ `INFO:__main__:SecuGen SDK: Available`
- ❌ `WARNING:__main__:Error initializing SecuGen: ...`

### Step 6: Verify CORS Configuration
Check if service allows requests from frontend:
```bash
grep -A 5 "CORS(app" /home/avis/Hospital/glide-Hims/packages/fingerprint-service/server.py
```

Should include:
```python
CORS(app, origins=[
    'http://localhost:5173',
    'http://192.168.1.9:4173',
    '*'  # Allows all
])
```

### Step 7: Browser Developer Tools
Open enrollment page, press F12, go to:

**Console Tab:**
- Look for CORS errors
- Look for connection refused errors

**Network Tab:**
- Filter by "8444"
- Check if requests to fingerprint service are being made
- Check response status (should be 200)
- Check response body

## Common Issues & Fixes

### Issue: "Failed to fetch"
**Cause:** Service not accessible from browser
**Fix:**
1. Check service is running: `systemctl status fingerprint-service`
2. Check firewall: `sudo ufw allow 8444/tcp`
3. Verify network connection: `curl http://192.168.1.9:8444/health`

### Issue: "CORS policy error"
**Cause:** Service not allowing requests from frontend origin
**Fix:**
1. Add frontend URL to CORS origins in `server.py`
2. Restart service: `sudo systemctl restart fingerprint-service`

### Issue: "secugen_available: false"
**Cause:** SecuGen SDK not loaded (running in mock mode)
**Fix:**
1. Install libusb: `sudo apt install libusb-0.1-4`
2. Install SDK libraries (see FINGERPRINT_SCANNER_SETUP.md)
3. Restart service

### Issue: "Device not found"
**Cause:** Scanner hardware not detected
**Fix:**
1. Check USB connection: `lsusb | grep Secugen`
2. Check udev rules: `cat /etc/udev/rules.d/99-secugen.rules`
3. Add user to plugdev group: `sudo usermod -a -G plugdev $USER`
4. Logout and login again

### Issue: Works on server but not on other devices
**Cause:** Accessing from different machine, localhost != server
**Fix:**
- ✅ **Already fixed!** Frontend now auto-detects correct URL
- Refresh browser cache: Ctrl+F5
- Clear browser cache completely
- Try incognito/private window

## Testing Checklist

- [ ] Service running: `systemctl status fingerprint-service`
- [ ] Service accessible locally: `curl localhost:8444/health`
- [ ] Service accessible via network IP: `curl 192.168.1.9:8444/health`
- [ ] Scanner hardware detected: `lsusb | grep Secugen`
- [ ] SDK loaded: `secugen_available: true` in health check
- [ ] Frontend can connect: Open test page or check browser console
- [ ] No CORS errors in browser console
- [ ] No firewall blocking port 8444

## Network Configuration

If accessing from different devices on the network:

**Server Machine (192.168.1.9):**
- Backend API: `http://192.168.1.9:3000`
- Frontend: `http://192.168.1.9:4173`
- Fingerprint Service: `http://192.168.1.9:8444`

**Client Machine:**
- Browser opens: `http://192.168.1.9:4173`
- Frontend makes API calls to: `http://192.168.1.9:3000`
- Frontend connects fingerprint to: `http://192.168.1.9:8444` (auto-detected!)

**Same Machine:**
- Browser opens: `http://localhost:4173`
- Frontend makes API calls to: `http://localhost:3000`
- Frontend connects fingerprint to: `http://localhost:8444`

## Production Deployment Notes

For production deployment with HTTPS:

1. **Use reverse proxy (Nginx):**
```nginx
location /fingerprint/ {
    proxy_pass http://localhost:8444/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

2. **Update frontend to use relative URL:**
```typescript
const FINGERPRINT_URL = '/fingerprint';
```

3. **Enable HTTPS for fingerprint service** (required for secure contexts)

## Still Not Working?

1. **Restart everything:**
```bash
sudo systemctl restart fingerprint-service
sudo systemctl restart glide-hims-backend
sudo systemctl restart glide-hims-frontend
```

2. **Check from browser console:**
```javascript
// What URL is the frontend trying to use?
console.log('Window hostname:', window.location.hostname);
console.log('Expected fingerprint URL:', 
  window.location.hostname === 'localhost' 
    ? 'http://localhost:8444' 
    : `http://${window.location.hostname}:8444`
);
```

3. **Force clear browser cache:**
   - Chrome: Ctrl+Shift+Delete → Clear cached images and files
   - Firefox: Ctrl+Shift+Delete → Clear cache
   - Safari: Develop menu → Empty Caches

4. **Try different browser** to rule out browser-specific issues

5. **Check service logs in real-time:**
```bash
sudo journalctl -u fingerprint-service -f
```
Then try to enroll - you should see logs of connection attempts.

## Contact Support

If still having issues, provide:
1. Output of: `systemctl status fingerprint-service`
2. Output of: `curl http://192.168.1.9:8444/health`
3. Screenshot of browser console (F12) showing errors
4. Output of: `lsusb | grep Secugen`
5. Output of: `sudo journalctl -u fingerprint-service --since "5 minutes ago"`
