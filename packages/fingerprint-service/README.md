# SecuGen Fingerprint Service for Linux

A local HTTP service that bridges SecuGen fingerprint scanners to the HIMS web application on Linux.

## Prerequisites

1. **Install SecuGen SDK**
   ```bash
   # Clone the SDK
   git clone https://github.com/simjedi98/SecuGen-SDK /opt/secugen-sdk
   
   # Install libraries
   sudo cp /opt/secugen-sdk/lib/linux4X64/*.so /usr/local/lib/
   sudo ldconfig
   
   # Set up udev rules for USB access
   sudo cp 99-secugen.rules /etc/udev/rules.d/
   sudo udevadm control --reload-rules
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Service

```bash
# Development
python server.py

# Production (with systemd)
sudo cp fingerprint-service.service /etc/systemd/system/
sudo systemctl enable fingerprint-service
sudo systemctl start fingerprint-service
```

## API Endpoints

- `GET /health` - Health check
- `GET /status` - Scanner status
- `POST /capture` - Capture fingerprint, returns template
- `POST /verify` - Verify fingerprint against template

## Configuration

The service runs on `http://localhost:8444` by default (different from SecuGen WebAPI's 8443).
