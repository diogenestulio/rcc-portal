-- Minimização de IP (docs/15-incidente-2026-11-10.md, achado lateral):
-- sessões antigas guardavam o IP em claro; contadores do limitador usavam "IP|rota" como chave.
-- Daqui em diante a aplicação grava só HMAC ("h:..." nas sessões, "ba:..." no limitador).
UPDATE "session" SET "ip_address" = NULL WHERE "ip_address" IS NOT NULL AND "ip_address" NOT LIKE 'h:%';
--> statement-breakpoint
-- Contadores são temporários (janelas de minutos): apagar os de chave em claro não tem efeito duradouro.
DELETE FROM "rate_limit" WHERE "key" NOT LIKE 'app:%' AND "key" NOT LIKE 'ba:%';
