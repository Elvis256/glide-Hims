#!/bin/sh
# =============================================================================
# Runtime Environment Configuration
# Allows environment variables to be set at container runtime
# =============================================================================

# Create runtime config
cat > /usr/share/nginx/html/config.js << EOF
window.RUNTIME_CONFIG = {
  API_URL: "${VITE_API_URL:-/api}",
  APP_NAME: "${VITE_APP_NAME:-Glide HIMS}",
  HOSPITAL_NAME: "${HOSPITAL_NAME:-}",
  SUPPORT_EMAIL: "${SUPPORT_EMAIL:-support@itsolutionsuganda.com}",
  SUPPORT_PHONE: "${SUPPORT_PHONE:-}",
};
EOF

echo "Runtime config generated:"
cat /usr/share/nginx/html/config.js

# Execute the main command
exec "$@"
