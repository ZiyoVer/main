#!/bin/sh
set -e

# Eski production schema tarixiy `db push` bilan yaratilgan bo'lishi mumkin.
# Repair migrationlar clone'da tekshirilib, migration history reconciliation
# tugatilmaguncha tasodifiy main deploy production bazaga SQL yubormaydi.
if [ "${RAILWAY_ENVIRONMENT_NAME:-}" = "production" ] && [ "${PRODUCTION_MIGRATION_RECONCILED:-}" != "true" ]; then
    echo ">>> XATO: production migration tarixi tasdiqlanmagan. MIGRATIONS.md runbookini bajaring."
    exit 1
fi

echo ">>> prisma migrate deploy ishlamoqda..."
# Fail-closed: migration xato bo'lsa servis eski yoki drift holatdagi schema bilan
# ishga tushmaydi. `db push` deploy oqimida mutlaqo ishlatilmaydi.
npx prisma migrate deploy
echo ">>> migrate deploy muvaffaqiyatli"
echo ">>> Server ishga tushmoqda..."
exec node dist/app.js
