# glide-Hims API Documentation

Complete guide for using the glide-Hims deployment management API.

## Authentication & Setup

### JWT Bearer Token
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://hmisdemo.itsolutionsuganda.com/api/v1/deployments
```

### API Key
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://hmisdemo.itsolutionsuganda.com/api/v1/deployments
```

## Rate Limiting: 100 req/min per user

## Key Endpoints

### Deployments
- `GET /deployments` - List
- `POST /deployments` - Create
- `GET /deployments/{id}` - Get
- `PUT /deployments/{id}` - Update
- `DELETE /deployments/{id}` - Delete

### Updates & Rollouts
- `POST /rollouts` - Initiate rollout
- `GET /rollouts/{id}` - Status
- `POST /rollouts/{id}/execute` - Execute phase
- `POST /rollouts/{id}/rollback` - Rollback

### Health & Alerts
- `GET /deployments/{id}/health` - Health status
- `GET /alerts` - List alerts
- `POST /alerts` - Send alert
- `POST /alerts/{id}/acknowledge` - Acknowledge

### Sync & Conflicts
- `POST /sync` - Coordinate sync
- `GET /conflicts` - List conflicts
- `POST /conflicts` - Resolve conflict

## Interactive Documentation

- **Swagger UI**: /api/docs
- **ReDoc**: /api/redoc
