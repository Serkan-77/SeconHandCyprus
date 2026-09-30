#!/bin/sh
# Runs once, when the PostgreSQL data directory is first created (official
# postgres image: /docker-entrypoint-initdb.d). Creates the two application
# roles and the database they own. Passwords come from the environment
# (Docker secrets in production); nothing is hard-coded.
#
#   kie_owner  owns the schema, runs migrations (not a superuser)
#   kie_app    the API at runtime: DML only, row level security applies
set -eu

: "${KIE_OWNER_PASSWORD:?KIE_OWNER_PASSWORD is required}"
: "${KIE_APP_PASSWORD:?KIE_APP_PASSWORD is required}"
DB="${KIE_DB:-kibrisikincielcim}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$KIE_OWNER_PASSWORD" -v app_pw="$KIE_APP_PASSWORD" -v db="$DB" <<'SQL'
create role kie_owner login password :'owner_pw' nosuperuser nocreaterole nocreatedb noreplication nobypassrls;
create role kie_app login password :'app_pw' nosuperuser nocreaterole nocreatedb noreplication nobypassrls connection limit 40;
create database :"db" owner kie_owner encoding 'UTF8' template template0 lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8';
revoke all on database :"db" from public;
grant connect, temporary on database :"db" to kie_app;
SQL

# Extensions need a superuser; everything else is created by kie_owner.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB" <<'SQL'
create extension if not exists pg_trgm;
create extension if not exists citext;
revoke create on schema public from public;
alter schema public owner to kie_owner;
SQL
