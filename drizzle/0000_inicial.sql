CREATE TYPE "public"."content_kind" AS ENUM('pagina', 'noticia', 'formacao', 'comunicado');--> statement-breakpoint
CREATE TYPE "public"."content_nature" AS ENUM('doutrina', 'orientacao_pastoral', 'devocao', 'testemunho', 'institucional', 'noticia');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('rascunho', 'em_revisao', 'aprovado', 'agendado', 'publicado', 'arquivado');--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('pendente', 'aceita', 'rejeitada');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('cms', 'google');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('agendado', 'adiado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_status" AS ENUM('nao_iniciado', 'separando', 'enviado', 'entregue', 'retirado', 'devolvido');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('ativo', 'pausado', 'encerrado', 'a_confirmar');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pendente', 'executando', 'concluido', 'falhou', 'morto');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('aberto', 'aguardando_pagamento', 'pago', 'em_resolucao', 'concluido', 'cancelado', 'expirado');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pendente', 'aprovado', 'recusado', 'estornado', 'estornado_parcial', 'chargeback', 'expirado');--> statement-breakpoint
CREATE TYPE "public"."prayer_status" AS ENUM('novo', 'em_oracao', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."publication" AS ENUM('rascunho', 'candidato', 'publicado', 'arquivado');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('reservada', 'confirmada', 'lista_espera', 'cancelada', 'expirada', 'em_resolucao');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin_tecnico', 'gestor_institucional', 'editor', 'revisor', 'gestor_eventos', 'operador_loja', 'responsavel_local', 'intercessor');--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('global', 'regiao', 'grupo', 'ministerio');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_kind" AS ENUM('entrada', 'ajuste', 'baixa_venda', 'devolucao');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"result" text DEFAULT 'ok' NOT NULL,
	"correlation_id" text,
	"detail" jsonb,
	"prev_hash" text,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "cart_item" (
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "cart_item_cart_id_variant_id_pk" PRIMARY KEY("cart_id","variant_id"),
	CONSTRAINT "cart_qty_positive" CHECK ("cart_item"."quantity" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "content_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "content_kind" NOT NULL,
	"slug" text NOT NULL,
	"published_revision_id" uuid,
	"current_revision_id" uuid,
	"status" "content_status" DEFAULT 'rascunho' NOT NULL,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"ministry_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body_html" text NOT NULL,
	"nature" "content_nature" NOT NULL,
	"author_name" text,
	"source_reference" text,
	"rights_notice" text,
	"cover_media_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"review_note" text,
	"search_text" text
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"description_html" text,
	"location" text,
	"address" text,
	"municipality_id" uuid,
	"group_id" uuid,
	"all_day" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"start_date" date,
	"end_date" date,
	"timezone" text DEFAULT 'America/Cuiaba' NOT NULL,
	"rrule" text,
	"status" "event_status" DEFAULT 'agendado' NOT NULL,
	"publication" "publication" DEFAULT 'rascunho' NOT NULL,
	"source" "event_source" DEFAULT 'cms' NOT NULL,
	"ical_uid" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"external_id" text,
	"external_etag" text,
	"external_updated_at" timestamp with time zone,
	"registration_enabled" boolean DEFAULT false NOT NULL,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"capacity" integer,
	"waitlist_enabled" boolean DEFAULT false NOT NULL,
	"hold_minutes" integer DEFAULT 30 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_ical_uid_unique" UNIQUE("ical_uid"),
	CONSTRAINT "event_time_shape" CHECK (("event"."all_day" and "event"."start_date" is not null and "event"."starts_at" is null)
    or (not "event"."all_day" and "event"."starts_at" is not null and "event"."start_date" is null)),
	CONSTRAINT "event_capacity_positive" CHECK ("event"."capacity" is null or "event"."capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "event_exception" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"original_start" text NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"override_starts_at" timestamp with time zone,
	"override_ends_at" timestamp with time zone,
	"override_location" text,
	"external_id" text
);
--> statement-breakpoint
CREATE TABLE "exception_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"order_id" uuid,
	"registration_id" uuid,
	"detail" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_correction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"message" text NOT NULL,
	"contact_email" text,
	"status" "correction_status" DEFAULT 'pendente' NOT NULL,
	"moderated_by" text,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_private_contact" (
	"group_id" uuid PRIMARY KEY NOT NULL,
	"coordinator_name" text,
	"coordinator_phone" text,
	"coordinator_email" text,
	"phone_publication_authorized" boolean DEFAULT false NOT NULL,
	"authorization_recorded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"public_name" text NOT NULL,
	"archdiocese" text,
	"council_name" text,
	"timezone" text DEFAULT 'America/Cuiaba' NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"confirmed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institution_singleton" CHECK (id = 1)
);
--> statement-breakpoint
CREATE TABLE "integration_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"status" "job_status" DEFAULT 'pendente' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" text,
	"decorative" boolean DEFAULT false NOT NULL,
	"credit" text,
	"image_rights_authorized" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "alt_or_decorative" CHECK ("media"."decorative" or "media"."alt_text" is not null or "media"."mime_type" not like 'image/%')
);
--> statement-breakpoint
CREATE TABLE "ministry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"description" text,
	"published" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ministry_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "municipality" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"ibge_code" text,
	"region_id" uuid,
	CONSTRAINT "municipality_slug_unique" UNIQUE("slug"),
	CONSTRAINT "municipality_ibge_code_unique" UNIQUE("ibge_code")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_token" text NOT NULL,
	"status" "order_status" DEFAULT 'aberto' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pendente' NOT NULL,
	"fulfillment_status" "fulfillment_status" DEFAULT 'nao_iniciado' NOT NULL,
	"kind" text DEFAULT 'loja' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"shipping_cep" text,
	"shipping_address" jsonb,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"reservation_expires_at" timestamp with time zone,
	"stock_committed" boolean DEFAULT false NOT NULL,
	"reservation_released" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "order_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "order_total_consistent" CHECK ("order"."total_cents" = "order"."subtotal_cents" - "order"."discount_cents" + "order"."shipping_cents"),
	CONSTRAINT "order_currency_brl" CHECK ("order"."currency" = 'BRL')
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid,
	"sku" text NOT NULL,
	"product_name" text NOT NULL,
	"variant_label" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_item_qty" CHECK ("order_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "parish" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"municipality_id" uuid NOT NULL,
	"region_id" uuid,
	"address" text,
	CONSTRAINT "parish_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"method" text,
	"status" "payment_status" DEFAULT 'pendente' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"provider_state_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_le_amount" CHECK ("payment"."refunded_cents" <= "payment"."amount_cents")
);
--> statement-breakpoint
CREATE TABLE "prayer_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parish_id" uuid NOT NULL,
	"municipality_id" uuid NOT NULL,
	"region_id" uuid,
	"venue" text NOT NULL,
	"public_address" text,
	"latitude" text,
	"longitude" text,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"accessibility_info" text,
	"description" text,
	"photo_media_id" uuid,
	"public_contact" text,
	"status" "group_status" DEFAULT 'a_confirmar' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"last_confirmed_by" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prayer_group_slug_unique" UNIQUE("slug"),
	CONSTRAINT "weekday_range" CHECK ("prayer_group"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "prayer_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text,
	"intention" text NOT NULL,
	"wants_contact" boolean DEFAULT false NOT NULL,
	"contact" text,
	"status" "prayer_status" DEFAULT 'novo' NOT NULL,
	"delete_after" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"active" boolean DEFAULT false NOT NULL,
	"is_digital" boolean DEFAULT false NOT NULL,
	"cover_media_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"label" text NOT NULL,
	"price_cents" integer NOT NULL,
	"stock_on_hand" integer DEFAULT 0 NOT NULL,
	"stock_reserved" integer DEFAULT 0 NOT NULL,
	"weight_grams" integer,
	"width_cm" integer,
	"height_cm" integer,
	"length_cm" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_variant_sku_unique" UNIQUE("sku"),
	CONSTRAINT "variant_price_nonneg" CHECK ("product_variant"."price_cents" >= 0),
	CONSTRAINT "variant_stock_nonneg" CHECK ("product_variant"."stock_on_hand" >= 0 and "product_variant"."stock_reserved" >= 0),
	CONSTRAINT "variant_reserved_le_onhand" CHECK ("product_variant"."stock_reserved" <= "product_variant"."stock_on_hand")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider_refund_id" text,
	"amount_cents" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'solicitado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "region_name_unique" UNIQUE("name"),
	CONSTRAINT "region_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "registration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"batch_id" uuid,
	"status" "registration_status" NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"birth_date" date,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"public_token" text NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" text,
	"order_id" uuid,
	"waitlist_position" integer,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "registration_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "role_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"scope_type" "scope_type" DEFAULT 'global' NOT NULL,
	"scope_id" uuid,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_scope_consistency" CHECK (("role_assignment"."scope_type" = 'global') = ("role_assignment"."scope_id" is null))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"kind" "stock_movement_kind" NOT NULL,
	"quantity" integer NOT NULL,
	"order_id" uuid,
	"note" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"capacity" integer,
	"sales_start_at" timestamp with time zone,
	"sales_end_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "batch_price_nonneg" CHECK ("ticket_batch"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"result" text
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_ministry_id_ministry_id_fk" FOREIGN KEY ("ministry_id") REFERENCES "public"."ministry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_item_id_content_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."content_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revision" ADD CONSTRAINT "content_revision_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_group_id_prayer_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."prayer_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_exception" ADD CONSTRAINT "event_exception_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exception_case" ADD CONSTRAINT "exception_case_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_correction" ADD CONSTRAINT "group_correction_group_id_prayer_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."prayer_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_correction" ADD CONSTRAINT "group_correction_moderated_by_user_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_private_contact" ADD CONSTRAINT "group_private_contact_group_id_prayer_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."prayer_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipality" ADD CONSTRAINT "municipality_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parish" ADD CONSTRAINT "parish_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parish" ADD CONSTRAINT "parish_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_group" ADD CONSTRAINT "prayer_group_parish_id_parish_id_fk" FOREIGN KEY ("parish_id") REFERENCES "public"."parish"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_group" ADD CONSTRAINT "prayer_group_municipality_id_municipality_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipality"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_group" ADD CONSTRAINT "prayer_group_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_group" ADD CONSTRAINT "prayer_group_last_confirmed_by_user_id_fk" FOREIGN KEY ("last_confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_batch_id_ticket_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ticket_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_checked_in_by_user_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_batch" ADD CONSTRAINT "ticket_batch_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_kind_slug" ON "content_item" USING btree ("kind","slug");--> statement-breakpoint
CREATE INDEX "content_status_idx" ON "content_item" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_item_number" ON "content_revision" USING btree ("item_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "event_external_unique" ON "event" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "event_starts_idx" ON "event" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "event_start_date_idx" ON "event" USING btree ("start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "exception_unique" ON "event_exception" USING btree ("event_id","original_start");--> statement-breakpoint
CREATE INDEX "correction_status_idx" ON "group_correction" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_ready_idx" ON "job" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_dedupe_active" ON "job" USING btree ("dedupe_key") WHERE "job"."status" in ('pendente','executando');--> statement-breakpoint
CREATE INDEX "parish_municipality_idx" ON "parish" USING btree ("municipality_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_ref" ON "payment" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "group_filter_idx" ON "prayer_group" USING btree ("municipality_id","weekday");--> statement-breakpoint
CREATE INDEX "group_parish_idx" ON "prayer_group" USING btree ("parish_id");--> statement-breakpoint
CREATE INDEX "prayer_delete_after_idx" ON "prayer_request" USING btree ("delete_after");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_provider_ref" ON "refund" USING btree ("payment_id","provider_refund_id");--> statement-breakpoint
CREATE INDEX "registration_event_status_idx" ON "registration" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "registration_email_idx" ON "registration" USING btree ("event_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignment_unique" ON "role_assignment" USING btree ("user_id","role","scope_type",coalesce("scope_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_sale_once" ON "stock_movement" USING btree ("variant_id","order_id","kind") WHERE "stock_movement"."kind" = 'baixa_venda';--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_once" ON "webhook_inbox" USING btree ("provider","external_event_id");