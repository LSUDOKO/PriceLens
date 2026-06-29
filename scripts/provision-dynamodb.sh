#!/usr/bin/env bash
#
# provision-dynamodb.sh — Create PriceLens DynamoDB tables
#
# Usage:
#   ./scripts/provision-dynamodb.sh               # Create tables
#   ./scripts/provision-dynamodb.sh --delete      # Delete tables (cleanup)
#   ./scripts/provision-dynamodb.sh --list        # List existing tables
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - Execute: chmod +x scripts/provision-dynamodb.sh
#
# Environment variables:
#   AWS_REGION                (default: us-east-1)
#   DYNAMODB_PRODUCTS_TABLE   (default: pricelens-products)
#   DYNAMODB_PRICES_TABLE     (default: pricelens-prices)
#   DYNAMODB_ALERTS_TABLE     (default: pricelens-alerts)

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PRODUCTS_TABLE="${DYNAMODB_PRODUCTS_TABLE:-pricelens-products}"
PRICES_TABLE="${DYNAMODB_PRICES_TABLE:-pricelens-prices}"
ALERTS_TABLE="${DYNAMODB_ALERTS_TABLE:-pricelens-alerts}"

echo "🔧 PriceLens DynamoDB Provisioning"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Region:   $REGION"
echo "Products: $PRODUCTS_TABLE"
echo "Prices:   $PRICES_TABLE"
echo "Alerts:   $ALERTS_TABLE"
echo ""

# ─── Actions ────────────────────────────────────────────────

if [ "${1:-}" = "--delete" ]; then
  echo "🗑️  Deleting tables..."
  for tbl in "$PRODUCTS_TABLE" "$PRICES_TABLE" "$ALERTS_TABLE"; do
    echo "  Deleting $tbl ..."
    aws dynamodb delete-table --table-name "$tbl" --region "$REGION" 2>/dev/null || echo "  (not found)"
    echo "  ✅ Deleted $tbl"
  done
  echo "Done."
  exit 0
fi

if [ "${1:-}" = "--list" ]; then
  echo "📋 Existing Tables:"
  aws dynamodb list-tables --region "$REGION" --output table
  exit 0
fi

# ─── Create Tables ──────────────────────────────────────────

echo "📦 Creating DynamoDB tables..."

# 1. Products table
#    PK: sku (String)
#    GSI: category-index on category (String)
echo ""
echo "  Creating $PRODUCTS_TABLE ..."
aws dynamodb create-table \
  --table-name "$PRODUCTS_TABLE" \
  --attribute-definitions \
    AttributeName=sku,AttributeType=S \
    AttributeName=category,AttributeType=S \
  --key-schema \
    AttributeName=sku,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"category-index\",\"KeySchema\":[{\"AttributeName\":\"category\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" > /dev/null && echo "  ✅ Created" || echo "  ❌ Failed"

echo "  Waiting for table to become ACTIVE ..."
aws dynamodb wait table-exists --table-name "$PRODUCTS_TABLE" --region "$REGION"
echo "  ✅ Ready"

# 2. Prices table
#    PK: sku (String), SK: region (String)
#    GSI: source-index on region (String)
#    LSI: price-index on sku (HASH) + pricePerUnit (RANGE, Number)
echo ""
echo "  Creating $PRICES_TABLE ..."
aws dynamodb create-table \
  --table-name "$PRICES_TABLE" \
  --attribute-definitions \
    AttributeName=sku,AttributeType=S \
    AttributeName=region,AttributeType=S \
    AttributeName=pricePerUnit,AttributeType=N \
  --key-schema \
    AttributeName=sku,KeyType=HASH \
    AttributeName=region,KeyType=RANGE \
  --global-secondary-indexes \
    "[{\"IndexName\":\"source-index\",\"KeySchema\":[{\"AttributeName\":\"region\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --local-secondary-indexes \
    "[{\"IndexName\":\"price-index\",\"KeySchema\":[{\"AttributeName\":\"sku\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"pricePerUnit\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" > /dev/null && echo "  ✅ Created" || echo "  ❌ Failed"

echo "  Waiting for table to become ACTIVE ..."
aws dynamodb wait table-exists --table-name "$PRICES_TABLE" --region "$REGION"
echo "  ✅ Ready"

# Enable TTL on Prices table
aws dynamodb update-time-to-live \
  --table-name "$PRICES_TABLE" \
  --time-to-live-specification "Enabled=true,AttributeName=ttl" \
  --region "$REGION" > /dev/null 2>&1 || true
echo "  ✅ TTL enabled"

# 3. Alerts table
#    PK: userId (String), SK: alertId (String)
echo ""
echo "  Creating $ALERTS_TABLE ..."
aws dynamodb create-table \
  --table-name "$ALERTS_TABLE" \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=alertId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=alertId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" > /dev/null && echo "  ✅ Created" || echo "  ❌ Failed"

echo "  Waiting for table to become ACTIVE ..."
aws dynamodb wait table-exists --table-name "$ALERTS_TABLE" --region "$REGION"
echo "  ✅ Ready"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tables created successfully!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env.local"
echo "  2. Fill in your AWS credentials"
echo "  3. Run: curl http://localhost:3000/api/seed"
echo "  4. Start the app: npm run dev"
echo "  5. For Claude Desktop: npm run mcp"
echo ""
