#!/bin/sh
set -e

# Ixtiyoriy: DB_RESET=true bo'lsa bazani to'liq tozalash
if [ "$DB_RESET" = "true" ]; then
    echo ">>> DB_RESET: schema tozalanmoqda..."
    psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;" 2>/dev/null || \
    npx prisma db execute --url "$DATABASE_URL" --file /dev/stdin <<'ENDSQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
ENDSQL
    echo ">>> Schema tozalandi."
fi

echo ">>> prisma db push ishlamoqda..."
npx prisma db push --accept-data-loss
echo ">>> Server ishga tushmoqda..."
exec node dist/app.js
