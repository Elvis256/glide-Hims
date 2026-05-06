# Phase 5: Procurement Analytics API Documentation

## Overview
Phase 5 introduces 16 new analytics endpoints across 3 categories: Supplier Analytics, Approval Analytics, and Spend Analytics.

All endpoints require:
- Authorization: `Bearer <token>` header
- Permission: `procurement.analytics`
- Content-Type: `application/json`

---

## SUPPLIER ANALYTICS

### 1. Get Supplier Metrics
**Endpoint:** `GET /procurement/analytics/suppliers/metrics`

**Query Parameters:**
- `startDate` (optional): ISO date string (e.g., "2024-01-01")
- `endDate` (optional): ISO date string

**Response:**
```json
[
  {
    "supplierId": "supp-001",
    "supplierName": "ABC Medical Supply",
    "totalSpend": 150000,
    "orderCount": 45,
    "avgOrderValue": 3333.33,
    "onTimeDeliveryRate": 98.5,
    "qualityScore": 92,
    "responseTime": 1.2,
    "lastInteraction": "2024-12-15T10:30:00Z"
  }
]
```

**Example cURL:**
```bash
curl -X GET "http://localhost:3001/api/procurement/analytics/suppliers/metrics" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

### 2. Get Supplier Spend Trends
**Endpoint:** `GET /procurement/analytics/suppliers/spend-trends`

**Query Parameters:**
- `supplierId` (required): Supplier ID
- `months` (optional, default: 12): Number of months to analyze

**Response:**
```json
[
  {
    "supplierId": "supp-001",
    "supplierName": "ABC Medical Supply",
    "period": "2024-01",
    "spend": 12000,
    "orderCount": 4,
    "trend": "increasing"
  }
]
```

**Example cURL:**
```bash
curl -X GET "http://localhost:3001/api/procurement/analytics/suppliers/spend-trends?supplierId=supp-001&months=6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. Get Top Suppliers
**Endpoint:** `GET /procurement/analytics/suppliers/top-suppliers`

**Query Parameters:**
- `limit` (optional, default: 10): Number of top suppliers to return

**Response:** Same as Supplier Metrics, sorted by totalSpend descending

**Example cURL:**
```bash
curl -X GET "http://localhost:3001/api/procurement/analytics/suppliers/top-suppliers?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Get Supplier Performance Comparison
**Endpoint:** `GET /procurement/analytics/suppliers/performance-comparison`

**Response:**
```json
{
  "supplier1": {
    "supplierId": "supp-001",
    "supplierName": "ABC Medical",
    "metrics": {...}
  },
  "supplier2": {
    "supplierId": "supp-002",
    "supplierName": "XYZ Pharma",
    "metrics": {...}
  }
}
```

---

### 5. Get Supplier Risk Score
**Endpoint:** `GET /procurement/analytics/suppliers/risk-score`

**Query Parameters:**
- `supplierId` (required): Supplier ID

**Response:**
```json
{
  "score": 35,
  "factors": [
    "Late delivery trend (3 late shipments in last 6 months)",
    "Quality issues detected (2 rejections)",
    "Price variance (8% above market average)"
  ]
}
```

---

## APPROVAL ANALYTICS

### 6. Detect Approval Bottlenecks
**Endpoint:** `GET /procurement/analytics/approvals/bottlenecks`

**Response:**
```json
[
  {
    "level": 1,
    "approverRole": "Department Head",
    "pendingCount": 5,
    "avgWaitTime": 24,
    "oldestPendingDate": "2024-12-10T08:00:00Z",
    "severity": "high"
  }
]
```

**Severity Levels:**
- `low`: < 24 hours
- `medium`: 24-48 hours
- `high`: 48-72 hours
- `critical`: > 72 hours

---

### 7. Get Approval Time Metrics
**Endpoint:** `GET /procurement/analytics/approvals/time-metrics`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
[
  {
    "period": "2024-12",
    "avgApprovalTime": 18.5,
    "medianApprovalTime": 16,
    "totalApprovals": 42,
    "fastApprovals": 35,
    "slowApprovals": 2
  }
]
```

---

### 8. Get Approval Trends
**Endpoint:** `GET /procurement/analytics/approvals/trends`

**Query Parameters:**
- `days` (optional, default: 30): Number of days to analyze

**Response:**
```json
[
  {
    "date": "2024-12-15",
    "avgTimeToApprove": 16.5,
    "approvalRate": 92.3,
    "rejectionRate": 7.7
  }
]
```

---

### 9. Get Approval SLA Compliance
**Endpoint:** `GET /procurement/analytics/approvals/sla-compliance`

**Response:**
```json
{
  "slaTarget": 48,
  "compliantCount": 38,
  "nonCompliantCount": 4,
  "complianceRate": 90.5
}
```

**Note:** SLA Target is 48 hours

---

### 10. Get Approval Workload
**Endpoint:** `GET /procurement/analytics/approvals/workload`

**Response:**
```json
{
  "byApprover": {
    "Department Head": 45,
    "Finance Manager": 42,
    "Executive Director": 38
  },
  "byStatus": {
    "pending_approval": 12,
    "approved": 95,
    "cancelled": 5
  }
}
```

---

## SPEND ANALYTICS

### 11. Get Spend by Category
**Endpoint:** `GET /procurement/analytics/spend/by-category`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
[
  {
    "category": "Medical Equipment",
    "totalSpend": 450000,
    "orderCount": 85,
    "avgOrderValue": 5294.12,
    "percentOfTotal": 35.2,
    "trend": "up"
  }
]
```

---

### 12. Get Spend by Department
**Endpoint:** `GET /procurement/analytics/spend/by-department`

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
[
  {
    "departmentId": "dept-001",
    "departmentName": "Department Cardiology",
    "totalSpend": 125000,
    "orderCount": 30,
    "avgOrderValue": 4166.67,
    "budget": 150000,
    "utilization": 83.3
  }
]
```

---

### 13. Get Spend Trends
**Endpoint:** `GET /procurement/analytics/spend/trends`

**Query Parameters:**
- `months` (optional, default: 12): Number of months to analyze

**Response:**
```json
[
  {
    "period": "2024-01",
    "totalSpend": 95000,
    "orderCount": 22,
    "avgOrderValue": 4318.18
  }
]
```

---

### 14. Get Budget Utilization
**Endpoint:** `GET /procurement/analytics/spend/budget-utilization`

**Response:**
```json
{
  "totalBudget": 1500000,
  "totalSpend": 1280000,
  "remaining": 220000,
  "utilizationRate": 85.3,
  "byDepartment": [
    {
      "departmentId": "dept-001",
      "departmentName": "Department Cardiology",
      "totalSpend": 125000,
      "budget": 150000,
      "utilization": 83.3
    }
  ]
}
```

---

### 15. Get Spend Forecast
**Endpoint:** `GET /procurement/analytics/spend/forecast`

**Query Parameters:**
- `months` (optional, default: 3): Number of months to forecast

**Response:**
```json
[
  {
    "period": "2025-01",
    "forecastedSpend": 98500,
    "confidence": 87.5
  }
]
```

**Note:** Confidence is based on historical variance

---

### 16. Get Top Spend Items
**Endpoint:** `GET /procurement/analytics/spend/top-items`

**Query Parameters:**
- `limit` (optional, default: 10): Number of top items to return

**Response:**
```json
[
  {
    "supplier": "supp-001",
    "totalSpend": 125000
  }
]
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid date format",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions: procurement.analytics required",
  "error": "Forbidden"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Performance Guidelines

| Endpoint | Typical Response Time | Notes |
|----------|----------------------|-------|
| Supplier Metrics | 200-500ms | Increases with date range |
| Approval Bottlenecks | 150-300ms | Real-time computation |
| Spend by Category | 300-800ms | Groups all orders |
| Budget Utilization | 400-1000ms | Aggregates departments |
| Spend Forecast | 100-200ms | Based on historical data |

---

## Testing Checklist

- [ ] All 16 endpoints return 200 OK with authorization header
- [ ] All endpoints properly validate input parameters
- [ ] Date range filters work correctly
- [ ] Pagination limits respected
- [ ] Response times under 1 second for typical queries
- [ ] Error responses include meaningful error messages
- [ ] Large datasets handled without timeouts
- [ ] Permission checks enforced (403 on missing permission)
- [ ] Invalid parameters rejected (400 Bad Request)
- [ ] Concurrent requests handled properly

---

## Troubleshooting

### Issue: 403 Forbidden on all endpoints
**Solution:** Ensure user has `procurement.analytics` permission assigned

### Issue: Empty results
**Solution:** Verify PurchaseOrder table has data with APPROVED or FULLY_RECEIVED status

### Issue: Slow response times
**Solution:** 
- Check database indexes on purchase_order.status and purchase_order.created_at
- Consider date range filters to reduce dataset size
- Monitor database query logs for slow queries

### Issue: Missing supplier data
**Solution:** Ensure Supplier table is populated and PurchaseOrder records have valid supplierId
