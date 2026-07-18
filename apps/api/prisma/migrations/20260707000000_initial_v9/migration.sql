CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3) NULL,
  "passwordHash" TEXT NULL,
  "name" TEXT NOT NULL,
  "language" TEXT DEFAULT 'ru' NOT NULL,
  "status" TEXT DEFAULT 'active' NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("email")
);


CREATE TABLE IF NOT EXISTS "AuthIdentity" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "providerEmail" TEXT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthIdentity_provider_providerSubject_key" ON "AuthIdentity" ("provider", "providerSubject");
CREATE INDEX IF NOT EXISTS "AuthIdentity_userId_provider_idx" ON "AuthIdentity" ("userId", "provider");

CREATE TABLE IF NOT EXISTS "EmailVerification" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER DEFAULT 0 NOT NULL,
  "sendCount" INTEGER DEFAULT 1 NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailVerification_email_purpose_expiresAt_idx" ON "EmailVerification" ("email", "purpose", "expiresAt");

CREATE TABLE IF NOT EXISTS "PasswordReset" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "email" TEXT NOT NULL,
  "verificationId" TEXT NULL,
  "resetTokenHash" TEXT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PasswordReset_email_expiresAt_idx" ON "PasswordReset" ("email", "expiresAt");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "deviceName" TEXT NULL,
  "ipHash" TEXT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("refreshTokenHash")
);

CREATE INDEX IF NOT EXISTS "Session_userId_expiresAt_idx" ON "Session" ("userId", "expiresAt");

CREATE TABLE IF NOT EXISTS "Consent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3) NULL,
  "metadata" JSONB NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Consent_userId_kind_grantedAt_idx" ON "Consent" ("userId", "kind", "grantedAt");

CREATE TABLE IF NOT EXISTS "Period" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NULL,
  "confirmed" BOOLEAN DEFAULT FALSE NOT NULL,
  "source" TEXT NOT NULL,
  "needsReview" BOOLEAN DEFAULT FALSE NOT NULL,
  "data" JSONB NOT NULL,
  "revision" INTEGER DEFAULT 1 NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Period_userId_startDate_idx" ON "Period" ("userId", "startDate");
CREATE INDEX IF NOT EXISTS "Period_userId_updatedAt_idx" ON "Period" ("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "DiaryLog" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL,
  "revision" INTEGER DEFAULT 1 NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiaryLog_userId_date_key" ON "DiaryLog" ("userId", "date");
CREATE INDEX IF NOT EXISTS "DiaryLog_userId_updatedAt_idx" ON "DiaryLog" ("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "PredictionSnapshot" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "mostLikelyStart" TIMESTAMP(3) NULL,
  "earliestStart" TIMESTAMP(3) NULL,
  "latestStart" TIMESTAMP(3) NULL,
  "confidence" TEXT NOT NULL,
  "confidenceScore" DOUBLE PRECISION NULL,
  "sourcePeriodIds" TEXT[] NULL,
  "data" JSONB NOT NULL,
  "actualStartDate" TIMESTAMP(3) NULL,
  "absoluteErrorDays" INTEGER NULL,
  "wasInsideRange" BOOLEAN NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PredictionSnapshot_userId_generatedAt_idx" ON "PredictionSnapshot" ("userId", "generatedAt");

CREATE TABLE IF NOT EXISTS "BoxPreference" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "revision" INTEGER DEFAULT 1 NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("userId")
);


CREATE TABLE IF NOT EXISTS "DeliveryAddress" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT DEFAULT 'home' NOT NULL,
  "addressType" TEXT DEFAULT 'apartment' NOT NULL,
  "handoffType" TEXT DEFAULT 'hand_to_recipient' NOT NULL,
  "country" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT NULL,
  "street" TEXT NOT NULL,
  "house" TEXT NOT NULL,
  "entrance" TEXT NULL,
  "floor" TEXT NULL,
  "apartment" TEXT NULL,
  "postalCode" TEXT NULL,
  "intercomCode" TEXT NULL,
  "instructions" TEXT NULL,
  "companyName" TEXT NULL,
  "contactPerson" TEXT NULL,
  "officeNumber" TEXT NULL,
  "hotelName" TEXT NULL,
  "roomNumber" TEXT NULL,
  "landmark" TEXT NULL,
  "gateDetails" TEXT NULL,
  "leaveAtDoorLocation" TEXT NULL,
  "callOnArrival" BOOLEAN DEFAULT FALSE NOT NULL,
  "doNotKnock" BOOLEAN DEFAULT FALSE NOT NULL,
  "photoConfirmation" BOOLEAN DEFAULT FALSE NOT NULL,
  "recipientName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "formattedAddress" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerPlaceId" TEXT NULL,
  "deliveryZoneId" TEXT NULL,
  "deliveryFeeMinor" INTEGER NULL,
  "estimatedMinutes" INTEGER NULL,
  "validationStatus" TEXT DEFAULT 'unverified' NOT NULL,
  "isDefault" BOOLEAN DEFAULT FALSE NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryAddress_userId_isDefault_idx" ON "DeliveryAddress" ("userId", "isDefault");
CREATE INDEX IF NOT EXISTS "DeliveryAddress_latitude_longitude_idx" ON "DeliveryAddress" ("latitude", "longitude");

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "pendingPlan" TEXT NULL,
  "planChangesAt" TIMESTAMP(3) NULL,
  "status" TEXT NOT NULL,
  "pauseUntil" TIMESTAMP(3) NULL,
  "skipNextBox" BOOLEAN DEFAULT FALSE NOT NULL,
  "deliveryAddressId" TEXT NULL,
  "deliveryWindow" TEXT NULL,
  "nextBillingDate" TIMESTAMP(3) NULL,
  "nextPreparationDate" TIMESTAMP(3) NULL,
  "nextDeliveryDate" TIMESTAMP(3) NULL,
  "cancelledAt" TIMESTAMP(3) NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Subscription_userId_status_idx" ON "Subscription" ("userId", "status");

CREATE TABLE IF NOT EXISTS "BoxOrder" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "version" INTEGER DEFAULT 1 NOT NULL,
  "plannedDeliveryDate" TIMESTAMP(3) NULL,
  "customizationDeadline" TIMESTAMP(3) NULL,
  "preparationDeadline" TIMESTAMP(3) NULL,
  "snapshot" JSONB NOT NULL,
  "deliverySnapshot" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BoxOrder_subscriptionId_createdAt_idx" ON "BoxOrder" ("subscriptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "BoxOrder_status_updatedAt_idx" ON "BoxOrder" ("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "OrderStatusEvent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "note" TEXT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderStatusEvent_orderId_createdAt_idx" ON "OrderStatusEvent" ("orderId", "createdAt");

CREATE TABLE IF NOT EXISTS "BoxFeedbackRecord" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("orderId")
);


CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerToken" TEXT NOT NULL,
  "brand" TEXT NULL,
  "last4" TEXT NULL,
  "expiresMonth" INTEGER NULL,
  "expiresYear" INTEGER NULL,
  "isDefault" BOOLEAN DEFAULT FALSE NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerToken")
);

CREATE INDEX IF NOT EXISTS "PaymentMethod_userId_isDefault_idx" ON "PaymentMethod" ("userId", "isDefault");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentMethodId" TEXT NULL,
  "provider" TEXT NOT NULL,
  "providerIntentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "refundedMinor" INTEGER DEFAULT 0 NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "data" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerIntentId"),
  UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "Payment_orderId_status_idx" ON "Payment" ("orderId", "status");

CREATE TABLE IF NOT EXISTS "Refund" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "paymentId" TEXT NOT NULL,
  "providerRefundId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerRefundId")
);


CREATE TABLE IF NOT EXISTS "Delivery" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerJobId" TEXT NULL,
  "status" TEXT NOT NULL,
  "courierId" TEXT NULL,
  "eta" TIMESTAMP(3) NULL,
  "recipientCodeHash" TEXT NULL,
  "proofData" JSONB NULL,
  "routeData" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("orderId"),
  UNIQUE ("providerJobId")
);


CREATE TABLE IF NOT EXISTS "DeliveryEvent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "data" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryEvent_deliveryId_createdAt_idx" ON "DeliveryEvent" ("deliveryId", "createdAt");

CREATE TABLE IF NOT EXISTS "NotificationInboxItem" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "titleKey" TEXT NOT NULL,
  "bodyKey" TEXT NOT NULL,
  "data" JSONB NULL,
  "readAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationInboxItem_userId_readAt_createdAt_idx" ON "NotificationInboxItem" ("userId", "readAt", "createdAt");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "actorId" TEXT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NULL,
  "metadata" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog" ("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog" ("actorId", "createdAt");

CREATE TABLE IF NOT EXISTS "CycleSettings" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "averageCycleLength" INTEGER DEFAULT 28 NOT NULL,
  "averagePeriodLength" INTEGER DEFAULT 5 NOT NULL,
  "regularity" TEXT DEFAULT 'unknown' NOT NULL,
  "data" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("userId")
);


CREATE TABLE IF NOT EXISTS "DailyEntry" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "mood" TEXT NULL,
  "energy" INTEGER NULL,
  "pain" INTEGER NULL,
  "symptoms" JSONB NULL,
  "flow" TEXT NULL,
  "sleep" DOUBLE PRECISION NULL,
  "water" INTEGER NULL,
  "note" TEXT NULL,
  "data" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyEntry_userId_date_key" ON "DailyEntry" ("userId", "date");
CREATE INDEX IF NOT EXISTS "DailyEntry_userId_updatedAt_idx" ON "DailyEntry" ("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "WellnessLog" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WellnessLog_userId_date_idx" ON "WellnessLog" ("userId", "date");

CREATE TABLE IF NOT EXISTS "ProductCatalogItem" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "sku" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameHy" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NULL,
  "imageUrl" TEXT NULL,
  "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
  "metadata" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("sku")
);


CREATE TABLE IF NOT EXISTS "ProductPrice" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "productId" TEXT NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "validFrom" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "validUntil" TIMESTAMP(3) NULL,
  "priceVersion" INTEGER DEFAULT 1 NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductPrice_productId_currency_validFrom_idx" ON "ProductPrice" ("productId", "currency", "validFrom");

CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT DEFAULT 'gyumri-main' NOT NULL,
  "availableQuantity" INTEGER DEFAULT 0 NOT NULL,
  "reservedQuantity" INTEGER DEFAULT 0 NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_productId_warehouseId_key" ON "InventoryItem" ("productId", "warehouseId");

CREATE TABLE IF NOT EXISTS "BoxPlan" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "basePriceMinor" INTEGER NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "includedUnits" INTEGER DEFAULT 0 NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("code")
);


CREATE TABLE IF NOT EXISTS "BoxPlanIncludedItem" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "planId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "includedQuantity" INTEGER NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoxPlanIncludedItem_planId_productId_key" ON "BoxPlanIncludedItem" ("planId", "productId");

CREATE TABLE IF NOT EXISTS "DeliveryZone" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT DEFAULT 'radius' NOT NULL,
  "centerLat" DOUBLE PRECISION NULL,
  "centerLng" DOUBLE PRECISION NULL,
  "radiusKm" DOUBLE PRECISION NULL,
  "polygonJson" JSONB NULL,
  "isActive" BOOLEAN DEFAULT TRUE NOT NULL,
  "baseFeeMinor" INTEGER DEFAULT 70000 NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);


CREATE TABLE IF NOT EXISTS "OrderQuote" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "deliveryAddressId" TEXT NULL,
  "deliveryZoneId" TEXT NULL,
  "basePriceMinor" INTEGER NOT NULL,
  "includedTotalMinor" INTEGER DEFAULT 0 NOT NULL,
  "addOnTotalMinor" INTEGER DEFAULT 0 NOT NULL,
  "deliveryFeeMinor" INTEGER DEFAULT 0 NOT NULL,
  "discountMinor" INTEGER DEFAULT 0 NOT NULL,
  "totalMinor" INTEGER NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "validationErrors" JSONB NULL,
  "warnings" JSONB NULL,
  "selectedSnapshot" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderQuote_userId_expiresAt_idx" ON "OrderQuote" ("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "OrderQuote_planId_idx" ON "OrderQuote" ("planId");

CREATE TABLE IF NOT EXISTS "OrderQuoteItem" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "quoteId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "includedQuantity" INTEGER DEFAULT 0 NOT NULL,
  "addOnQuantity" INTEGER DEFAULT 0 NOT NULL,
  "unitPriceMinor" INTEGER DEFAULT 0 NOT NULL,
  "totalMinor" INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderQuoteItem_quoteId_idx" ON "OrderQuoteItem" ("quoteId");

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "deliveryAddressId" TEXT NULL,
  "deliveryZoneId" TEXT NULL,
  "status" TEXT DEFAULT 'PENDING_PAYMENT' NOT NULL,
  "paymentStatus" TEXT DEFAULT 'PENDING' NOT NULL,
  "totalMinor" INTEGER NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "recipientSnapshot" JSONB NULL,
  "handoffSnapshot" JSONB NULL,
  "deliverySnapshot" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3) NULL,
  "deletedAt" TIMESTAMP(3) NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("quoteId")
);

CREATE INDEX IF NOT EXISTS "Order_userId_status_idx" ON "Order" ("userId", "status");
CREATE INDEX IF NOT EXISTS "Order_status_updatedAt_idx" ON "Order" ("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "includedQuantity" INTEGER DEFAULT 0 NOT NULL,
  "addOnQuantity" INTEGER DEFAULT 0 NOT NULL,
  "unitPriceMinor" INTEGER DEFAULT 0 NOT NULL,
  "totalMinor" INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem" ("orderId");

CREATE TABLE IF NOT EXISTS "PaymentIntent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerIntentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT DEFAULT 'AMD' NOT NULL,
  "clientSecret" TEXT NULL,
  "data" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerIntentId"),
  UNIQUE ("idempotencyKey")
);

CREATE INDEX IF NOT EXISTS "PaymentIntent_orderId_status_idx" ON "PaymentIntent" ("orderId", "status");

CREATE TABLE IF NOT EXISTS "PaymentEvent" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentIntentId" TEXT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "data" JSONB NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("providerEventId")
);

CREATE INDEX IF NOT EXISTS "PaymentEvent_orderId_createdAt_idx" ON "PaymentEvent" ("orderId", "createdAt");

CREATE TABLE IF NOT EXISTS "DeliveryTask" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" TEXT DEFAULT 'CREATED' NOT NULL,
  "courierId" TEXT NULL,
  "safePayload" JSONB NOT NULL,
  "eta" TIMESTAMP(3) NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeliveryTask_orderId_status_idx" ON "DeliveryTask" ("orderId", "status");

CREATE TABLE IF NOT EXISTS "AccountDeletionRequest" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT DEFAULT 'PENDING' NOT NULL,
  "verificationHash" TEXT NULL,
  "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "confirmedAt" TIMESTAMP(3) NULL,
  "completedAt" TIMESTAMP(3) NULL,
  "cancelledAt" TIMESTAMP(3) NULL,
  "metadata" JSONB NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_userId_status_idx" ON "AccountDeletionRequest" ("userId", "status");

CREATE TABLE IF NOT EXISTS "ConsentRecord" (
  "id" TEXT DEFAULT gen_random_uuid()::text NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "revokedAt" TIMESTAMP(3) NULL,
  "locale" TEXT DEFAULT 'ru' NOT NULL,
  "source" TEXT DEFAULT 'app' NOT NULL,
  "metadata" JSONB NULL,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConsentRecord_userId_type_acceptedAt_idx" ON "ConsentRecord" ("userId", "type", "acceptedAt");
