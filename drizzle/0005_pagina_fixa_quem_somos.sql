ALTER TABLE "content_item" ADD COLUMN "chave" text;--> statement-breakpoint
CREATE UNIQUE INDEX "content_chave" ON "content_item" USING btree ("chave");--> statement-breakpoint
-- Vincula automaticamente a página existente "quem-somos" à seção A RCC, só quando ela é a ÚNICA candidata.
-- Havendo mais de uma (ambíguo), nada é feito: o gestor escolhe no painel (Conteúdo → A RCC → Quem Somos).
UPDATE "content_item" SET "chave" = 'quem-somos'
WHERE "kind" = 'pagina' AND "slug" = 'quem-somos'
  AND (SELECT count(*) FROM "content_item" WHERE "kind" = 'pagina' AND "slug" = 'quem-somos') = 1
  AND NOT EXISTS (SELECT 1 FROM "content_item" WHERE "chave" = 'quem-somos');
