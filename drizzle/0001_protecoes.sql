-- Auditoria append-only: impede UPDATE/DELETE/TRUNCATE mesmo pela aplicação.
-- (O dono do banco ainda pode desativar o trigger; por isso também há o encadeamento de hash.)
CREATE OR REPLACE FUNCTION audit_log_block_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é somente inclusão';
END; $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_change();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_change();
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint
-- Busca sem acento: wrapper IMMUTABLE para uso em índices.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ SELECT public.unaccent('public.unaccent', $1) $$;
