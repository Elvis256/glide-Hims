# Phase 5 Staging Deployment Guide

## Pre-Deployment Checklist

- [x] Build successful (0 errors)
- [x] All commits pushed to GitHub
- [x] Analytics services created (Supplier, Approval, Spend)
- [x] Frontend dashboard implemented
- [x] API documentation complete
- [ ] Database contains sample data
- [ ] Environment variables configured
- [ ] Staging server ready

## Deployment Steps

### 1. Pull Latest Code on Staging Server

```bash
cd /path/to/glide-Hims
git pull origin main
```

Expected output:
```
From https://github.com/Elvis256/glide-Hims
 b0d419b..6b2650f  main       -> origin/main
Fast-forward
 packages/backend/src/modules/procurement/approval-analytics.service.ts       |  231 +++++++
 packages/backend/src/modules/procurement/spend-analytics.service.ts          |  211 +++++++
 packages/backend/src/modules/procurement/supplier-analytics.service.ts       |  196 ++++++
 packages/frontend/src/pages/procurement/ProcurementAnalyticsDashboard.tsx     |  278 ++++++++
 packages/frontend/src/App.tsx                                                 |    3 +
 packages/backend/src/modules/procurement/procurement.module.ts                |   12 +-
 packages/backend/src/modules/procurement/procurement.controller.ts            |   90 +++
 7 files changed, 1136 insertions(+)
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Application

```bash
npm run build
```

Expected: 0 errors, successful build

### 4. Run Database Migrations (if any)

```bash
npm run migration:run
```

### 5. Seed Sample Data (if needed)

Create sample PurchaseOrders for analytics testing:

```bash
cat > seed-analytics-data.sql << 'EOF'
-- Verify sample data exists
SELECT COUNT(*) as po_count FROM purchase_orders WHERE status = 'approved';
SELECT COUNT(*) as supplier_count FROM suppliers;

-- If empty, consider creating test data
-- INSERT statements would go here
EOF

mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < seed-analytics-data.sql
```

### 6. Start Application

```bash
npm run start:staging
# or
npm run start
```

### 7. Verify API Health

```bash
curl http://localhost:3001/api/health
```

Expected response: `200 OK`

---

## Testing Phase 5 Analytics

### Quick Health Check (5 minutes)

```bash
# Test one endpoint from each category
curl -X GET "http://localhost:3001/api/procurement/analytics/suppliers/metrics" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X GET "http://localhost:3001/api/procurement/analytics/approvals/bottlenecks" \
  -H "Authorization: Bearer YOUR_TOKEN"

curl -X GET "http://localhost:3001/api/procurement/analytics/spend/trends" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Comprehensive Endpoint Testing (15 minutes)

```bash
# Run the test script
bash test-analytics-endpoints.sh
```

### Dashboard UI Testing (10 minutes)

1. Navigate to: `http://localhost:3001/procurement/analytics`
2. Verify page loads without errors
3. Test all 3 tabs:
   - **Spend Analysis**: Check line chart and pie chart render
   - **Supplier Performance**: Check bar charts display top suppliers
   - **Approvals**: Check placeholder content displays
4. Click "Refresh" button and verify data updates
5. Test responsive design (resize window)

### Performance Testing (20 minutes)

Use Apache Bench or similar:

```bash
# Test supplier metrics endpoint
ab -n 100 -c 10 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/procurement/analytics/suppliers/metrics"
```

Expected:
- Requests per second: > 10
- Mean response time: < 500ms
- Failed requests: 0

### Load Testing with Realistic Data (30 minutes)

```bash
# Generate test load with concurrent requests
for i in {1..50}; do
  curl -X GET "http://localhost:3001/api/procurement/analytics/spend/trends" \
    -H "Authorization: Bearer YOUR_TOKEN" &
done
wait
```

Monitor:
- Server CPU usage (should stay < 80%)
- Database connection pool (no exhaustion)
- Response times (should stay consistent)

---

## Endpoint Coverage Matrix

| Category | Endpoint | Status | Response Time | Notes |
|----------|----------|--------|----------------|-------|
| Supplier | `/metrics` | ✓ | TBD | |
| Supplier | `/spend-trends` | ✓ | TBD | |
| Supplier | `/top-suppliers` | ✓ | TBD | |
| Supplier | `/performance-comparison` | ✓ | TBD | |
| Supplier | `/risk-score` | ✓ | TBD | |
| Approval | `/bottlenecks` | ✓ | TBD | |
| Approval | `/time-metrics` | ✓ | TBD | |
| Approval | `/trends` | ✓ | TBD | |
| Approval | `/sla-compliance` | ✓ | TBD | |
| Approval | `/workload` | ✓ | TBD | |
| Spend | `/by-category` | ✓ | TBD | |
| Spend | `/by-department` | ✓ | TBD | |
| Spend | `/trends` | ✓ | TBD | |
| Spend | `/budget-utilization` | ✓ | TBD | |
| Spend | `/forecast` | ✓ | TBD | |
| Spend | `/top-items` | ✓ | TBD | |

---

## Known Limitations (Phase 5)

1. **Category Data**: Randomly assigned (no real category mapping)
   - *Workaround*: Use category-by-supplier mapping in Phase 5.1

2. **Approval Chain**: Simulated at 3 levels
   - *Workaround*: Query actual ApprovalWorkflow table in future phase

3. **Department Budgets**: Randomly generated
   - *Workaround*: Pull from actual Department entity budgets

4. **Forecast Method**: Simple historical average
   - *Workaround*: Implement weighted moving average or ML model later

---

## Post-Deployment Checklist

- [ ] All 16 endpoints responding correctly (200 OK)
- [ ] Dashboard page loads and displays charts
- [ ] No console errors in browser
- [ ] No backend errors in logs
- [ ] Response times acceptable (< 500ms average)
- [ ] All tabs in dashboard functional
- [ ] Data updates on refresh
- [ ] Mobile responsive design working
- [ ] Permission checks enforced
- [ ] Error handling tested (invalid inputs)

---

## Rollback Plan

If critical issues found:

```bash
# Revert to Phase 4
git revert 6b2650f

# Rebuild
npm run build

# Restart
npm run start
```

---

## Next Steps After Deployment

### Phase 5.1: Data Quality Improvements (1-2 hours)
- Map real purchase order categories
- Link to actual ApprovalWorkflow entities
- Use real department budgets from finance module

### Phase 5.2: Frontend Enhancements (2-3 hours)
- Add date range pickers for analytics filtering
- Implement data export (CSV/Excel)
- Add comparison views between periods
- Implement drill-down functionality

### Phase 6: Advanced Analytics (4-6 hours)
- Supplier risk ML model
- Spend forecasting with confidence intervals
- Anomaly detection for unusual purchases
- Supplier performance scoring

---

## Support Contacts

- Backend Issues: Check backend logs at `/var/log/glide-hims/backend.log`
- Database Issues: Run `SELECT * FROM information_schema.tables WHERE table_schema='hims';`
- Frontend Issues: Check browser console (F12)
- Performance Issues: Monitor database slow query log

---

## Documentation Links

- [Analytics API Docs](./ANALYTICS-API-DOCS.md)
- [Test Script](./test-analytics-endpoints.sh)
- [Phase 5 Plan](./plan.md)
- [Code Commit](https://github.com/Elvis256/glide-Hims/commit/6b2650f)
