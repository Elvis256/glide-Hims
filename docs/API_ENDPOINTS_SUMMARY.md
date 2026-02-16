# API Endpoints Summary

## Fingerprint Service (Port 8444)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/health` | Service health check | ✅ Working |
| GET | `/status` | Scanner connection status | ✅ Working |
| GET | `/device-info` | Detailed device information | ✅ Working |
| POST | `/capture` | Capture fingerprint | ✅ Working |
| POST | `/verify` | Verify against stored templates | ✅ Working |
| POST | `/match` | Match two templates | ✅ Working |

## Backend API (Port 3000)

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/patients/:id/link-user` | Link user account to patient |
| GET | `/api/v1/patients/:id/linked-user` | Get linked user info |
| POST | `/api/v1/patients/:id/unlink-user` | Unlink user from patient |
| POST | `/api/v1/patients/check-duplicates` | Check for duplicate patients |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users` | Create user account |
| GET | `/api/v1/users/:id` | Get user by ID |
| PATCH | `/api/v1/users/:id` | Update user |

### Biometrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/biometrics/register` | Register fingerprint template |
| POST | `/api/v1/biometrics/verify` | Verify fingerprint |
| GET | `/api/v1/biometrics/enrollment/:userId` | Check enrollment status |

## Frontend Routes

| Path | Description | Status |
|------|-------------|--------|
| `/patients/hospital-scheme-enroll` | Hospital insurance enrollment | ✅ Working |
| `/patients/new` | Patient registration | ✅ Working |
| `/patients/search` | Search patients | ✅ Working |
| `/opd/token` | Issue OPD token | ✅ Working |

## Service Status

**All services running:**
- ✅ Backend API: `http://localhost:3000` 
- ✅ Frontend: `http://192.168.1.9:4173`
- ✅ Fingerprint Service: `http://localhost:8444`
- ✅ PostgreSQL: `localhost:5432`

**Quick Health Check:**
```bash
# Backend
curl http://localhost:3000/api/v1/health

# Fingerprint service
curl http://localhost:8444/health

# Frontend
curl http://localhost:4173
```
