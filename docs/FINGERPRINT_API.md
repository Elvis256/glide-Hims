# Fingerprint Service API Documentation

## Base URL
- Local: `http://localhost:8444`
- Network: `http://192.168.1.9:8444`

## Available Endpoints

### 1. Health Check
**GET** `/health`

Check if the service is running.

**Response:**
```json
{
  "status": "ok",
  "secugen_available": true,
  "mock_mode": false
}
```

**Status Codes:**
- `200 OK` - Service is healthy

---

### 2. Scanner Status
**GET** `/status`

Get current scanner connection status.

**Response:**
```json
{
  "connected": true,
  "secugen_available": true,
  "mock_mode": false
}
```

**Fields:**
- `connected` - Whether scanner hardware is connected and accessible
- `secugen_available` - Whether SecuGen SDK is loaded
- `mock_mode` - Whether running in mock/testing mode

---

### 3. Device Information
**GET** `/device-info`

Get detailed information about the connected scanner.

**Response:**
```json
{
  "connected": true,
  "deviceName": "SecuGen Fingerprint Scanner",
  "serialNumber": "N/A",
  "firmwareVersion": "N/A",
  "imageWidth": 252,
  "imageHeight": 330,
  "mock_mode": false
}
```

**Status Codes:**
- `200 OK` - Device info retrieved
- `500 Error` - Failed to get device info

---

### 4. Capture Fingerprint
**POST** `/capture`

Capture a fingerprint from the scanner.

**Request Body:**
```json
{
  "timeout": 10000,
  "quality": 50
}
```

**Parameters:**
- `timeout` (optional) - Capture timeout in milliseconds (default: 10000)
- `quality` (optional) - Minimum quality threshold 0-100 (default: 50)

**Response (Success):**
```json
{
  "success": true,
  "template": "base64_encoded_template_data",
  "imageData": "data:image/png;base64,iVBORw0...",
  "quality": 85,
  "width": 252,
  "height": 330
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Capture failed: Timeout"
}
```

**Fields:**
- `template` - Base64 encoded fingerprint template (for matching/storage)
- `imageData` - Base64 encoded PNG image (for display)
- `quality` - Captured image quality score (0-100)
- `width`, `height` - Image dimensions in pixels

**Status Codes:**
- `200 OK` - Request processed (check `success` field)
- `500 Error` - Server error

---

### 5. Verify Fingerprint
**POST** `/verify`

Verify a captured fingerprint against stored templates.

**Request Body:**
```json
{
  "capturedTemplate": "base64_template_from_capture",
  "storedTemplates": [
    {
      "templateData": "base64_stored_template",
      "fingerIndex": "right_index"
    }
  ],
  "securityLevel": 5
}
```

**Parameters:**
- `capturedTemplate` - Template from recent capture
- `storedTemplates` - Array of stored templates to match against
- `securityLevel` (optional) - Match strictness 1-9 (default: 5)
  - 1 = Lenient (faster, less accurate)
  - 5 = Balanced (recommended)
  - 9 = Strict (slower, more accurate)

**Response (Matched):**
```json
{
  "success": true,
  "matched": true,
  "fingerIndex": "right_index"
}
```

**Response (Not Matched):**
```json
{
  "success": true,
  "matched": false
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "No stored templates"
}
```

**Status Codes:**
- `200 OK` - Verification completed
- `400 Bad Request` - Missing required fields
- `500 Error` - Server error

---

### 6. Match Templates
**POST** `/match`

Directly match two fingerprint templates.

**Request Body:**
```json
{
  "template1": "base64_template_1",
  "template2": "base64_template_2",
  "securityLevel": 5
}
```

**Parameters:**
- `template1` - First template (base64)
- `template2` - Second template (base64)
- `securityLevel` (optional) - Match strictness 1-9 (default: 5)

**Response:**
```json
{
  "success": true,
  "matched": true
}
```

**Status Codes:**
- `200 OK` - Match completed
- `400 Bad Request` - Missing templates
- `500 Error` - Server error

---

## Error Responses

All endpoints may return errors in this format:

```json
{
  "success": false,
  "error": "Error description"
}
```

Common error messages:
- `"Failed to open device"` - Scanner not connected or in use
- `"Capture failed: Timeout"` - No finger placed within timeout
- `"Capture failed: Invalid quality"` - Poor image quality, try again
- `"No captured template"` - Missing required field
- `"Template creation failed"` - Extraction failed

---

## Usage Examples

### JavaScript/TypeScript

```typescript
// Check if service is available
const health = await fetch('http://localhost:8444/health');
const status = await health.json();
console.log('Scanner available:', status.secugen_available);

// Capture fingerprint
const captureResponse = await fetch('http://localhost:8444/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timeout: 10000,
    quality: 50
  })
});

const result = await captureResponse.json();
if (result.success) {
  console.log('Template:', result.template);
  console.log('Quality:', result.quality);
  // Display image
  document.getElementById('preview').src = result.imageData;
}

// Verify fingerprint
const verifyResponse = await fetch('http://localhost:8444/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    capturedTemplate: result.template,
    storedTemplates: [
      { templateData: 'stored_template_here', fingerIndex: 'right_index' }
    ],
    securityLevel: 5
  })
});

const verified = await verifyResponse.json();
console.log('Matched:', verified.matched);
```

### Python

```python
import requests
import json

# Check service
health = requests.get('http://localhost:8444/health')
print('Status:', health.json())

# Capture fingerprint
capture = requests.post('http://localhost:8444/capture', json={
    'timeout': 10000,
    'quality': 50
})
result = capture.json()

if result['success']:
    template = result['template']
    print(f"Quality: {result['quality']}")
    
    # Verify fingerprint
    verify = requests.post('http://localhost:8444/verify', json={
        'capturedTemplate': template,
        'storedTemplates': [
            {'templateData': 'stored_template', 'fingerIndex': 'right_index'}
        ],
        'securityLevel': 5
    })
    
    print('Matched:', verify.json()['matched'])
```

### cURL

```bash
# Health check
curl http://localhost:8444/health

# Get device info
curl http://localhost:8444/device-info

# Capture fingerprint
curl -X POST http://localhost:8444/capture \
  -H "Content-Type: application/json" \
  -d '{"timeout": 10000, "quality": 50}'

# Verify fingerprint
curl -X POST http://localhost:8444/verify \
  -H "Content-Type: application/json" \
  -d '{
    "capturedTemplate": "captured_template_base64",
    "storedTemplates": [
      {"templateData": "stored_template_base64", "fingerIndex": "right_index"}
    ],
    "securityLevel": 5
  }'
```

---

## CORS Configuration

The service allows requests from:
- `http://localhost:5173` - Vite dev server
- `http://localhost:3000` - Backend API
- `http://192.168.1.9:4173` - Production frontend
- All origins (`*`) for local development

---

## Security Levels

Recommended security levels by use case:

| Use Case | Level | Description |
|----------|-------|-------------|
| Quick unlock | 3 | Fast, less secure |
| **OPD verification** | **5** | **Balanced (recommended)** |
| Financial transaction | 7 | More secure |
| High security | 9 | Maximum security |

Higher levels reduce false positives but may increase false negatives.

---

## Performance

Typical response times on local hardware:

| Endpoint | Avg Response Time |
|----------|------------------|
| /health | 5-10ms |
| /status | 50-100ms |
| /device-info | 100-200ms |
| /capture | 2-5 seconds (waiting for finger) |
| /verify | 100-300ms |
| /match | 50-100ms |

---

## Troubleshooting

### "Connection refused"
- Service not running: `systemctl start fingerprint-service`
- Check port: `ss -tlnp | grep 8444`

### "Device not connected"
- Check USB: `lsusb | grep Secugen`
- Check permissions: User must be in `plugdev` group
- Unplug and replug scanner

### "Capture timeout"
- No finger on scanner
- Place finger firmly and hold still
- Increase timeout value

### "Invalid quality"
- Dirty scanner surface - clean with soft cloth
- Dry finger - moisten slightly
- Press finger more firmly
- Lower quality threshold

### CORS errors in browser
- Check frontend URL is in CORS origins list
- Clear browser cache
- Check browser console for exact error

---

## Integration with HIMS

The Glide HIMS frontend automatically uses this service for:

1. **Hospital Insurance Enrollment**
   - Path: `/patients/hospital-scheme-enroll`
   - Captures patient fingerprints during enrollment
   - Stores templates in `biometrics` table

2. **OPD Token Issuance**
   - Path: `/opd/token`
   - Verifies patient fingerprint for hospital scheme payment
   - Matches against stored templates

3. **Staff Verification**
   - Used for employee authentication
   - Links to user accounts in HR module

---

## Database Integration

Fingerprint templates are stored in the backend database:

```sql
-- Biometrics table
CREATE TABLE biometrics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  finger_index VARCHAR(20),  -- 'right_index', 'left_thumb', etc.
  template_data TEXT,         -- Base64 encoded template
  quality_score INTEGER,
  enrolled_at TIMESTAMP,
  last_verified_at TIMESTAMP
);
```

---

## Service Management

```bash
# Start service
sudo systemctl start fingerprint-service

# Stop service
sudo systemctl stop fingerprint-service

# Restart service
sudo systemctl restart fingerprint-service

# Check status
sudo systemctl status fingerprint-service

# View logs
sudo journalctl -u fingerprint-service -f

# Enable auto-start on boot
sudo systemctl enable fingerprint-service
```

---

## Development

To run in development mode with debug logging:

```bash
cd /home/avis/Hospital/glide-Hims/packages/fingerprint-service
export DEBUG=true
python3 server.py
```

---

## Production Deployment

For production, use a production WSGI server like Gunicorn:

```bash
pip install gunicorn

# Run with 4 workers
gunicorn -w 4 -b 0.0.0.0:8444 server:app
```

Update the systemd service file to use gunicorn instead of python directly.
