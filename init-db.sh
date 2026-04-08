#!/bin/bash
set -e

echo "🔄 Initializing database schema..."

mysql -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < /docker-entrypoint-initdb.d/schema.sql

echo "✅ Database schema initialized successfully!"
