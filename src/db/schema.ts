/**
 * Esquema do banco — RCC Arquidiocesana.
 * Convenções:
 *  - Instantes em `timestamptz` (UTC). Datas de dia inteiro em `date` (data local, sem fuso).
 *  - Dinheiro em centavos inteiros (`integer`), moeda BRL. Nunca ponto flutuante.
 *  - Identificadores públicos (comprovante, pedido, carrinho) são tokens opacos aleatórios,
 *    separados das chaves primárias.
 *  - Dados privados (contatos de coordenadores, pedidos de oração, participantes) ficam em
 *    tabelas próprias e nunca entram na busca pública.
 */
import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, text, integer, boolean, timestamp, date, jsonb, uuid, uniqueIndex,
  index, check, primaryKey, bigserial, bigint, time, smallint,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ───────────────────────── Autenticação (tabelas exigidas pelo better-auth) ─────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: ts("locked_until"),
}, (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)]);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ───────────────────────── Papéis e escopos ─────────────────────────
export const roleEnum = pgEnum("role", [
  "admin_tecnico", "gestor_institucional", "editor", "revisor", "gestor_eventos",
  "operador_loja", "responsavel_local", "intercessor",
]);
export const scopeTypeEnum = pgEnum("scope_type", ["global", "regiao", "grupo", "ministerio"]);

/** Um usuário pode ter vários papéis, cada um limitado a um escopo organizacional. */
export const roleAssignment = pgTable("role_assignment", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  scopeType: scopeTypeEnum("scope_type").notNull().default("global"),
  scopeId: uuid("scope_id"),
  grantedBy: text("granted_by").references(() => user.id),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("role_assignment_unique").on(t.userId, t.role, t.scopeType, sql`coalesce(${t.scopeId}, '00000000-0000-0000-0000-000000000000'::uuid)`),
  check("role_scope_consistency", sql`(${t.scopeType} = 'global') = (${t.scopeId} is null)`),
]);

// ───────────────────────── Instituição e território ─────────────────────────
export const institution = pgTable("institution", {
  id: smallint("id").primaryKey().default(1),
  publicName: text("public_name").notNull(),
  archdiocese: text("archdiocese"),
  councilName: text("council_name"),
  timezone: text("timezone").notNull().default("America/Cuiaba"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  confirmed: boolean("confirmed").notNull().default(false),
  updatedAt: updatedAt(),
}, () => [check("institution_singleton", sql`id = 1`)]);

export const region = pgTable("region", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const municipality = pgTable("municipality", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ibgeCode: text("ibge_code").unique(),
  regionId: uuid("region_id").references(() => region.id, { onDelete: "set null" }),
});

export const parish = pgTable("parish", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  municipalityId: uuid("municipality_id").notNull().references(() => municipality.id),
  regionId: uuid("region_id").references(() => region.id, { onDelete: "set null" }),
  address: text("address"),
}, (t) => [index("parish_municipality_idx").on(t.municipalityId)]);

// ───────────────────────── Grupos de Oração ─────────────────────────
export const groupStatusEnum = pgEnum("group_status", ["ativo", "pausado", "encerrado", "a_confirmar"]);

export const prayerGroup = pgTable("prayer_group", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parishId: uuid("parish_id").notNull().references(() => parish.id),
  municipalityId: uuid("municipality_id").notNull().references(() => municipality.id),
  regionId: uuid("region_id").references(() => region.id, { onDelete: "set null" }),
  venue: text("venue").notNull(),
  publicAddress: text("public_address"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  /** 0 = domingo … 6 = sábado */
  weekday: smallint("weekday").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time"),
  accessibilityInfo: text("accessibility_info"),
  description: text("description"),
  photoMediaId: uuid("photo_media_id"),
  /** Contato institucional público (ex.: e-mail da paróquia). */
  publicContact: text("public_contact"),
  status: groupStatusEnum("status").notNull().default("a_confirmar"),
  published: boolean("published").notNull().default(false),
  lastConfirmedAt: ts("last_confirmed_at"),
  lastConfirmedBy: text("last_confirmed_by").references(() => user.id),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  check("weekday_range", sql`${t.weekday} between 0 and 6`),
  index("group_filter_idx").on(t.municipalityId, t.weekday),
  index("group_parish_idx").on(t.parishId),
]);

/** Dados privados do coordenador — nunca saem em páginas públicas sem autorização explícita. */
export const groupPrivateContact = pgTable("group_private_contact", {
  groupId: uuid("group_id").primaryKey().references(() => prayerGroup.id, { onDelete: "cascade" }),
  coordinatorName: text("coordinator_name"),
  coordinatorPhone: text("coordinator_phone"),
  coordinatorEmail: text("coordinator_email"),
  phonePublicationAuthorized: boolean("phone_publication_authorized").notNull().default(false),
  authorizationRecordedAt: ts("authorization_recorded_at"),
  updatedAt: updatedAt(),
});

export const correctionStatusEnum = pgEnum("correction_status", ["pendente", "aceita", "rejeitada"]);

/** Sugestões de visitantes: sempre moderadas, nunca aplicadas automaticamente. */
export const groupCorrection = pgTable("group_correction", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => prayerGroup.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  contactEmail: text("contact_email"),
  status: correctionStatusEnum("status").notNull().default("pendente"),
  moderatedBy: text("moderated_by").references(() => user.id),
  moderatedAt: ts("moderated_at"),
  createdAt: createdAt(),
}, (t) => [index("correction_status_idx").on(t.status)]);

export const ministry = pgTable("ministry", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary"),
  description: text("description"),
  published: boolean("published").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ───────────────────────── Conteúdo editorial ─────────────────────────
export const contentKindEnum = pgEnum("content_kind", ["pagina", "noticia", "formacao", "comunicado"]);
export const contentStatusEnum = pgEnum("content_status", ["rascunho", "em_revisao", "aprovado", "agendado", "publicado", "arquivado"]);
export const contentNatureEnum = pgEnum("content_nature", ["doutrina", "orientacao_pastoral", "devocao", "testemunho", "institucional", "noticia"]);

export const contentItem = pgTable("content_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: contentKindEnum("kind").notNull(),
  slug: text("slug").notNull(),
  /** Revisão atualmente pública (pode continuar no ar enquanto nova versão aguarda revisão). */
  publishedRevisionId: uuid("published_revision_id"),
  /** Revisão de trabalho (a mais recente). */
  currentRevisionId: uuid("current_revision_id"),
  status: contentStatusEnum("status").notNull().default("rascunho"),
  publishAt: ts("publish_at"),
  publishedAt: ts("published_at"),
  archivedAt: ts("archived_at"),
  ministryId: uuid("ministry_id").references(() => ministry.id, { onDelete: "set null" }),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("content_kind_slug").on(t.kind, t.slug),
  index("content_status_idx").on(t.status),
]);

export const contentRevision = pgTable("content_revision", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => contentItem.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  /** HTML já sanitizado no servidor. */
  bodyHtml: text("body_html").notNull(),
  nature: contentNatureEnum("nature").notNull(),
  authorName: text("author_name"),
  sourceReference: text("source_reference"),
  rightsNotice: text("rights_notice"),
  coverMediaId: uuid("cover_media_id"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: createdAt(),
  /** Aprovação vale SOMENTE para esta revisão (imutável depois de criada). */
  approvedBy: text("approved_by").references(() => user.id),
  approvedAt: ts("approved_at"),
  reviewNote: text("review_note"),
  searchVector: text("search_text"),
}, (t) => [uniqueIndex("revision_item_number").on(t.itemId, t.number)]);

// ───────────────────────── Mídia ─────────────────────────
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  decorative: boolean("decorative").notNull().default(false),
  credit: text("credit"),
  imageRightsAuthorized: boolean("image_rights_authorized").notNull().default(false),
  isPrivate: boolean("is_private").notNull().default(false),
  uploadedBy: text("uploaded_by").references(() => user.id),
  createdAt: createdAt(),
}, (t) => [check("alt_or_decorative", sql`${t.decorative} or ${t.altText} is not null or ${t.mimeType} not like 'image/%'`)]);

// ───────────────────────── Agenda ─────────────────────────
export const eventStatusEnum = pgEnum("event_status", ["agendado", "adiado", "cancelado"]);
export const eventSourceEnum = pgEnum("event_source", ["cms", "google"]);
export const publicationEnum = pgEnum("publication", ["rascunho", "candidato", "publicado", "arquivado"]);

export const event = pgTable("event", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  descriptionHtml: text("description_html"),
  location: text("location"),
  address: text("address"),
  municipalityId: uuid("municipality_id").references(() => municipality.id),
  groupId: uuid("group_id").references(() => prayerGroup.id, { onDelete: "set null" }),
  /** Evento com horário: starts_at/ends_at (UTC). Dia inteiro: start_date/end_date (exclusivo). */
  allDay: boolean("all_day").notNull().default(false),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  /** Fuso IANA original, usado para expandir recorrências. */
  timezone: text("timezone").notNull().default("America/Cuiaba"),
  rrule: text("rrule"),
  status: eventStatusEnum("status").notNull().default("agendado"),
  publication: publicationEnum("publication").notNull().default("rascunho"),
  source: eventSourceEnum("source").notNull().default("cms"),
  /** UID estável do iCalendar; nunca muda depois de publicado. */
  icalUid: text("ical_uid").notNull().unique(),
  /** SEQUENCE do iCalendar — incrementa a cada alteração relevante. */
  sequence: integer("sequence").notNull().default(0),
  externalId: text("external_id"),
  externalEtag: text("external_etag"),
  externalUpdatedAt: ts("external_updated_at"),
  registrationEnabled: boolean("registration_enabled").notNull().default(false),
  registrationOpensAt: ts("registration_opens_at"),
  registrationClosesAt: ts("registration_closes_at"),
  capacity: integer("capacity"),
  waitlistEnabled: boolean("waitlist_enabled").notNull().default(false),
  holdMinutes: integer("hold_minutes").notNull().default(30),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("event_external_unique").on(t.source, t.externalId),
  index("event_starts_idx").on(t.startsAt),
  index("event_start_date_idx").on(t.startDate),
  check("event_time_shape", sql`(${t.allDay} and ${t.startDate} is not null and ${t.startsAt} is null)
    or (not ${t.allDay} and ${t.startsAt} is not null and ${t.startDate} is null)`),
  check("event_capacity_positive", sql`${t.capacity} is null or ${t.capacity} > 0`),
]);

/** Exceções de recorrência: ocorrência cancelada ou alterada (RECURRENCE-ID). */
export const eventException = pgTable("event_exception", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
  /** Início original da ocorrência (UTC) ou data, para dia inteiro. */
  originalStart: text("original_start").notNull(),
  cancelled: boolean("cancelled").notNull().default(false),
  overrideStartsAt: ts("override_starts_at"),
  overrideEndsAt: ts("override_ends_at"),
  overrideLocation: text("override_location"),
  externalId: text("external_id"),
}, (t) => [uniqueIndex("exception_unique").on(t.eventId, t.originalStart)]);

export const ticketBatch = pgTable("ticket_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull().default(0),
  capacity: integer("capacity"),
  salesStartAt: ts("sales_start_at"),
  salesEndAt: ts("sales_end_at"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [check("batch_price_nonneg", sql`${t.priceCents} >= 0`)]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "reservada", "confirmada", "lista_espera", "cancelada", "expirada", "em_resolucao",
]);

export const registration = pgTable("registration", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => event.id),
  batchId: uuid("batch_id").references(() => ticketBatch.id),
  status: registrationStatusEnum("status").notNull(),
  holdExpiresAt: ts("hold_expires_at"),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  birthDate: date("birth_date"),
  priceCents: integer("price_cents").notNull().default(0),
  /** Token opaco para comprovante e QR Code — não contém dados pessoais. */
  publicToken: text("public_token").notNull().unique(),
  checkedInAt: ts("checked_in_at"),
  checkedInBy: text("checked_in_by").references(() => user.id),
  orderId: uuid("order_id"),
  waitlistPosition: integer("waitlist_position"),
  confirmedAt: ts("confirmed_at"),
  cancelledAt: ts("cancelled_at"),
  /** Chave de idempotência do envio do formulário (evita duplo clique). */
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: createdAt(),
}, (t) => [
  index("registration_event_status_idx").on(t.eventId, t.status),
  index("registration_email_idx").on(t.eventId, t.email),
]);

// ───────────────────────── Pedidos de oração (privados) ─────────────────────────
export const prayerStatusEnum = pgEnum("prayer_status", ["novo", "em_oracao", "concluido"]);
export const prayerRequest = pgTable("prayer_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name"),
  intention: text("intention").notNull(),
  wantsContact: boolean("wants_contact").notNull().default(false),
  contact: text("contact"),
  status: prayerStatusEnum("status").notNull().default("novo"),
  deleteAfter: ts("delete_after").notNull(),
  createdAt: createdAt(),
}, (t) => [index("prayer_delete_after_idx").on(t.deleteAfter)]);

// ───────────────────────── Loja ─────────────────────────
export const product = pgTable("product", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  active: boolean("active").notNull().default(false),
  isDigital: boolean("is_digital").notNull().default(false),
  coverMediaId: uuid("cover_media_id"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const productVariant = pgTable("product_variant", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  label: text("label").notNull(),
  priceCents: integer("price_cents").notNull(),
  stockOnHand: integer("stock_on_hand").notNull().default(0),
  stockReserved: integer("stock_reserved").notNull().default(0),
  weightGrams: integer("weight_grams"),
  widthCm: integer("width_cm"),
  heightCm: integer("height_cm"),
  lengthCm: integer("length_cm"),
  active: boolean("active").notNull().default(true),
}, (t) => [
  check("variant_price_nonneg", sql`${t.priceCents} >= 0`),
  check("variant_stock_nonneg", sql`${t.stockOnHand} >= 0 and ${t.stockReserved} >= 0`),
  check("variant_reserved_le_onhand", sql`${t.stockReserved} <= ${t.stockOnHand}`),
]);

export const stockMovementKindEnum = pgEnum("stock_movement_kind", ["entrada", "ajuste", "baixa_venda", "devolucao"]);
export const stockMovement = pgTable("stock_movement", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id").notNull().references(() => productVariant.id),
  kind: stockMovementKindEnum("kind").notNull(),
  quantity: integer("quantity").notNull(),
  orderId: uuid("order_id"),
  note: text("note"),
  actorId: text("actor_id").references(() => user.id),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("stock_sale_once").on(t.variantId, t.orderId, t.kind).where(sql`${t.kind} = 'baixa_venda'`)]);

export const cart = pgTable("cart", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Token opaco guardado em cookie HttpOnly (nunca em localStorage). */
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cartItem = pgTable("cart_item", {
  cartId: uuid("cart_id").notNull().references(() => cart.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").notNull().references(() => productVariant.id),
  quantity: integer("quantity").notNull(),
}, (t) => [primaryKey({ columns: [t.cartId, t.variantId] }), check("cart_qty_positive", sql`${t.quantity} between 1 and 20`)]);

export const orderStatusEnum = pgEnum("order_status", ["aberto", "aguardando_pagamento", "pago", "em_resolucao", "concluido", "cancelado", "expirado"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pendente", "aprovado", "recusado", "estornado", "estornado_parcial", "chargeback", "expirado"]);
export const fulfillmentStatusEnum = pgEnum("fulfillment_status", ["nao_iniciado", "separando", "enviado", "entregue", "retirado", "devolvido"]);

export const order = pgTable("order", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Token opaco para acesso ao pedido sem login. */
  publicToken: text("public_token").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("aberto"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pendente"),
  fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status").notNull().default("nao_iniciado"),
  kind: text("kind").notNull().default("loja"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  shippingCep: text("shipping_cep"),
  shippingAddress: jsonb("shipping_address"),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  shippingCents: integer("shipping_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("BRL"),
  reservationExpiresAt: ts("reservation_expires_at"),
  /** true depois que o estoque reservado virou baixa definitiva (uma única vez). */
  stockCommitted: boolean("stock_committed").notNull().default(false),
  reservationReleased: boolean("reservation_released").notNull().default(false),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  check("order_total_consistent", sql`${t.totalCents} = ${t.subtotalCents} - ${t.discountCents} + ${t.shippingCents}`),
  check("order_currency_brl", sql`${t.currency} = 'BRL'`),
]);

export const orderItem = pgTable("order_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => order.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => productVariant.id),
  /** Fotografia comercial do item no momento da compra. */
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  variantLabel: text("variant_label").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
}, (t) => [check("order_item_qty", sql`${t.quantity} > 0`)]);

export const payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => order.id),
  provider: text("provider").notNull(),
  providerPaymentId: text("provider_payment_id"),
  method: text("method"),
  status: paymentStatusEnum("status").notNull().default("pendente"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("BRL"),
  refundedCents: integer("refunded_cents").notNull().default(0),
  /** Momento (do provedor) do último estado aplicado — descarta eventos mais antigos. */
  providerStateAt: ts("provider_state_at"),
  approvedAt: ts("approved_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("payment_provider_ref").on(t.provider, t.providerPaymentId),
  check("refund_le_amount", sql`${t.refundedCents} <= ${t.amountCents}`),
]);

export const refund = pgTable("refund", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => payment.id),
  providerRefundId: text("provider_refund_id"),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("solicitado"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("refund_provider_ref").on(t.paymentId, t.providerRefundId)]);

/** Fila de exceções que exigem decisão humana (pagamento tardio sem estoque, divergências). */
export const exceptionCase = pgTable("exception_case", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  orderId: uuid("order_id"),
  registrationId: uuid("registration_id"),
  detail: text("detail").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedBy: text("resolved_by").references(() => user.id),
  createdAt: createdAt(),
});

// ───────────────────────── Integrações, jobs e auditoria ─────────────────────────
/** Inbox: cada evento externo (webhook) é registrado uma única vez. */
export const webhookInbox = pgTable("webhook_inbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
  result: text("result"),
}, (t) => [uniqueIndex("webhook_once").on(t.provider, t.externalEventId)]);

export const jobStatusEnum = pgEnum("job_status", ["pendente", "executando", "concluido", "falhou", "morto"]);
/** Fila durável em PostgreSQL (outbox). Processada com FOR UPDATE SKIP LOCKED. */
export const job = pgTable("job", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  dedupeKey: text("dedupe_key"),
  status: jobStatusEnum("status").notNull().default("pendente"),
  runAt: ts("run_at").notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(8),
  lockedAt: ts("locked_at"),
  lockedBy: text("locked_by"),
  lastError: text("last_error"),
  createdAt: createdAt(),
  finishedAt: ts("finished_at"),
}, (t) => [
  index("job_ready_idx").on(t.status, t.runAt),
  uniqueIndex("job_dedupe_active").on(t.dedupeKey).where(sql`${t.status} in ('pendente','executando')`),
]);

export const integrationState = pgTable("integration_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  lastSuccessAt: ts("last_success_at"),
  lastErrorAt: ts("last_error_at"),
  lastError: text("last_error"),
  updatedAt: updatedAt(),
});

/** Auditoria append-only com encadeamento de hash (detecção de adulteração). */
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: ts("at").notNull().defaultNow(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  result: text("result").notNull().default("ok"),
  correlationId: text("correlation_id"),
  detail: jsonb("detail"),
  prevHash: text("prev_hash"),
  hash: text("hash").notNull(),
}, (t) => [index("audit_resource_idx").on(t.resourceType, t.resourceId), index("audit_actor_idx").on(t.actorId)]);
