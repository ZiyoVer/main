#!/bin/sh
set -e

# XAVFLI: DB_RESET=true faqat mahsus holatlarda (masalan, staging reset)
# Production'da HECH QACHON DB_RESET=true qo'ymang!
if [ "$DB_RESET" = "true" ]; then
    if [ "$NODE_ENV" = "production" ]; then
        echo ">>> XAVF: DB_RESET=true production'da ruxsat etilmagan! O'tkazib yuborilmoqda."
    else
        echo ">>> DB_RESET: schema tozalanmoqda (faqat non-production)..."
        psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;" 2>/dev/null || \
        npx prisma db execute --url "$DATABASE_URL" --file /dev/stdin <<'ENDSQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
ENDSQL
        echo ">>> Schema tozalandi."
    fi
fi

echo ">>> prisma migrate deploy ishlamoqda..."
if ! npx prisma migrate deploy; then
    echo ">>> migrate deploy amalga oshmadi, prisma db push ishlatilmoqda (birinchi deploy)..."
    npx prisma db push --skip-generate
fi
echo ">>> Server ishga tushmoqda..."
exec node dist/app.js
