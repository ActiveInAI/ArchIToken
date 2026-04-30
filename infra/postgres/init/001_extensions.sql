-- Phase 7 local database extension bootstrap.
-- The default compose image validates configuration only. Runtime deployments
-- must use a PostgreSQL 16 image that has these extension packages installed.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgmq;

CREATE SCHEMA IF NOT EXISTS architoken;
