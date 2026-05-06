#!/bin/bash

# Phase 5 Analytics Endpoint Testing Script
# Tests all 16 Procurement Analytics endpoints

BASE_URL="http://localhost:3001/api"
BEARER_TOKEN="${BEARER_TOKEN:-}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

# Function to test an endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "${BLUE}Test $TESTS_RUN: $name${NC}"
    echo "  Method: $method"
    echo "  Endpoint: $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -H "Authorization: Bearer $BEARER_TOKEN" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Authorization: Bearer $BEARER_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "  Status: ${GREEN}✓ $http_code${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Print sample response
        echo "$body" | head -c 200
        echo "..."
    else
        echo -e "  Status: ${RED}✗ $http_code${NC}"
        echo "  Response: $body"
    fi
    echo ""
}

echo "=========================================="
echo "Phase 5: Procurement Analytics API Testing"
echo "=========================================="
echo ""

# ============ SUPPLIER ANALYTICS ENDPOINTS ============

echo -e "${BLUE}[SUPPLIER ANALYTICS]${NC}"

test_endpoint \
    "Get Supplier Metrics" \
    "GET" \
    "/procurement/analytics/suppliers/metrics"

test_endpoint \
    "Get Supplier Metrics (with date range)" \
    "GET" \
    "/procurement/analytics/suppliers/metrics?startDate=2024-01-01&endDate=2024-12-31"

test_endpoint \
    "Get Supplier Spend Trends" \
    "GET" \
    "/procurement/analytics/suppliers/spend-trends?supplierId=supp-001&months=12"

test_endpoint \
    "Get Top Suppliers" \
    "GET" \
    "/procurement/analytics/suppliers/top-suppliers?limit=10"

test_endpoint \
    "Get Supplier Performance Comparison" \
    "GET" \
    "/procurement/analytics/suppliers/performance-comparison"

test_endpoint \
    "Get Supplier Risk Score" \
    "GET" \
    "/procurement/analytics/suppliers/risk-score?supplierId=supp-001"

# ============ APPROVAL ANALYTICS ENDPOINTS ============

echo -e "${BLUE}[APPROVAL ANALYTICS]${NC}"

test_endpoint \
    "Detect Approval Bottlenecks" \
    "GET" \
    "/procurement/analytics/approvals/bottlenecks"

test_endpoint \
    "Get Approval Time Metrics" \
    "GET" \
    "/procurement/analytics/approvals/time-metrics"

test_endpoint \
    "Get Approval Time Metrics (with date range)" \
    "GET" \
    "/procurement/analytics/approvals/time-metrics?startDate=2024-01-01&endDate=2024-12-31"

test_endpoint \
    "Get Approval Trends" \
    "GET" \
    "/procurement/analytics/approvals/trends?days=30"

test_endpoint \
    "Get Approval SLA Compliance" \
    "GET" \
    "/procurement/analytics/approvals/sla-compliance"

test_endpoint \
    "Get Approval Workload" \
    "GET" \
    "/procurement/analytics/approvals/workload"

# ============ SPEND ANALYTICS ENDPOINTS ============

echo -e "${BLUE}[SPEND ANALYTICS]${NC}"

test_endpoint \
    "Get Spend by Category" \
    "GET" \
    "/procurement/analytics/spend/by-category"

test_endpoint \
    "Get Spend by Department" \
    "GET" \
    "/procurement/analytics/spend/by-department"

test_endpoint \
    "Get Spend Trends" \
    "GET" \
    "/procurement/analytics/spend/trends?months=12"

test_endpoint \
    "Get Budget Utilization" \
    "GET" \
    "/procurement/analytics/spend/budget-utilization"

test_endpoint \
    "Get Spend Forecast" \
    "GET" \
    "/procurement/analytics/spend/forecast?months=3"

test_endpoint \
    "Get Top Spend Items" \
    "GET" \
    "/procurement/analytics/spend/top-items?limit=10"

# ============ TEST SUMMARY ============

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Tests Run: $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
TESTS_FAILED=$((TESTS_RUN - TESTS_PASSED))
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "Tests Failed: ${GREEN}$TESTS_FAILED${NC}"
else
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
fi
echo -e "Pass Rate: $((TESTS_PASSED * 100 / TESTS_RUN))%"
echo "=========================================="
