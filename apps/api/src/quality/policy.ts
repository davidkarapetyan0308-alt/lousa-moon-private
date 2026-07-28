export type QualityIssue = {
  code: string;
  message: string;
};

export type QualitySupplierSnapshot = {
  id?: string | null;
  agreementStatus?: string | null;
  qualityStatus?: string | null;
  certificates?: unknown;
};

export type QualityProductSnapshot = {
  id?: string | null;
  metadata?: unknown;
};

export type QualityBatchSnapshot = {
  productId?: string | null;
  supplierId?: string | null;
  lotNumber?: string | null;
  qaStatus?: string | null;
  qaCheckedAt?: Date | string | null;
  qaCheckedBy?: string | null;
  recallStatus?: string | null;
  expiryDate?: Date | string | null;
  quantityAvailable?: number | null;
  certificateReferences?: unknown;
  storageCondition?: string | null;
  product?: QualityProductSnapshot | null;
  supplier?: QualitySupplierSnapshot | null;
};

export type PackingRecordSnapshot = {
  packedBy?: string | null;
  checkedBy?: string | null;
  qaStatus?: string | null;
  qaReleasedAt?: Date | string | null;
  sealedAt?: Date | string | null;
  sealId?: string | null;
};

function upper(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function hasReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => String(item || '').trim().length > 0);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasReference);
  return String(value || '').trim().length > 0;
}

function metadataFlag(metadata: unknown, key: string): boolean {
  return Boolean(metadata && typeof metadata === 'object' && (metadata as Record<string, unknown>)[key] === true);
}

function validDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function evaluatePackingRecord(record: PackingRecordSnapshot | null | undefined): QualityIssue[] {
  if (!record) return [{ code: 'BOX_QA_RECORD_REQUIRED', message: 'Для бокса отсутствует запись контроля качества.' }];
  const issues: QualityIssue[] = [];
  if (!String(record.packedBy || '').trim()) issues.push({ code: 'PACKED_BY_REQUIRED', message: 'Не указан сотрудник, собравший бокс.' });
  if (!String(record.checkedBy || '').trim()) issues.push({ code: 'CHECKED_BY_REQUIRED', message: 'Бокс должен проверить второй сотрудник.' });
  if (record.packedBy && record.checkedBy && String(record.packedBy) === String(record.checkedBy)) {
    issues.push({ code: 'DUAL_CONTROL_REQUIRED', message: 'Сборщик и проверяющий должны быть разными сотрудниками.' });
  }
  if (upper(record.qaStatus) !== 'RELEASED') issues.push({ code: 'BOX_QA_NOT_RELEASED', message: 'Контроль качества бокса не завершён.' });
  if (!validDate(record.qaReleasedAt)) issues.push({ code: 'QA_RELEASE_DATE_REQUIRED', message: 'Не зафиксирована дата выпуска бокса контролем качества.' });
  if (!validDate(record.sealedAt)) issues.push({ code: 'SEALED_AT_REQUIRED', message: 'Не зафиксировано время пломбирования бокса.' });
  if (!String(record.sealId || '').trim()) issues.push({ code: 'SEAL_ID_REQUIRED', message: 'Бокс нельзя передать без идентификатора пломбы.' });
  return issues;
}

export function evaluateProductBatchForRelease(batch: QualityBatchSnapshot, at = new Date()): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const supplierAgreement = upper(batch.supplier?.agreementStatus);
  const supplierQuality = upper(batch.supplier?.qualityStatus);
  const metadata = batch.product?.metadata;

  if (!String(batch.productId || '').trim()) issues.push({ code: 'BATCH_PRODUCT_REQUIRED', message: 'Партия не связана с товаром.' });
  if (!String(batch.supplierId || '').trim() || !batch.supplier) issues.push({ code: 'BATCH_SUPPLIER_REQUIRED', message: 'Партия не связана с поставщиком.' });
  if (!String(batch.lotNumber || '').trim()) issues.push({ code: 'LOT_NUMBER_REQUIRED', message: 'У партии отсутствует номер lot.' });
  if (Number(batch.quantityAvailable) < 0) issues.push({ code: 'BATCH_QUANTITY_INVALID', message: 'Доступное количество партии не может быть отрицательным.' });

  if (batch.supplier) {
    if (supplierAgreement !== 'ACTIVE') {
      issues.push({ code: 'SUPPLIER_AGREEMENT_NOT_ACTIVE', message: 'Договор с поставщиком не имеет статуса ACTIVE.' });
    }
    if (supplierQuality !== 'APPROVED') {
      issues.push({ code: 'SUPPLIER_QUALITY_NOT_APPROVED', message: 'Поставщик не прошёл контроль качества.' });
    }
  }

  const expiry = validDate(batch.expiryDate);
  if (batch.expiryDate && !expiry) issues.push({ code: 'BATCH_EXPIRY_INVALID', message: 'У партии указана некорректная дата срока годности.' });
  if (expiry && expiry.getTime() <= at.getTime()) issues.push({ code: 'PRODUCT_BATCH_EXPIRED', message: 'Срок годности партии истёк.' });

  if (metadataFlag(metadata, 'requiresCertificate') && !hasReference(batch.certificateReferences)) {
    issues.push({ code: 'BATCH_CERTIFICATE_REQUIRED', message: 'Для товара требуется сертификат партии.' });
  }
  if (metadataFlag(metadata, 'requiresStorageCondition') && !String(batch.storageCondition || '').trim()) {
    issues.push({ code: 'BATCH_STORAGE_CONDITION_REQUIRED', message: 'Для партии не указаны обязательные условия хранения.' });
  }

  return issues;
}

export function evaluateReleasedProductBatch(batch: QualityBatchSnapshot, at = new Date()): QualityIssue[] {
  const issues = evaluateProductBatchForRelease(batch, at);
  if (upper(batch.qaStatus) !== 'RELEASED') issues.push({ code: 'PRODUCT_BATCH_NOT_RELEASED', message: 'Партия не выпущена контролем качества.' });
  if (!validDate(batch.qaCheckedAt) || !String(batch.qaCheckedBy || '').trim()) {
    issues.push({ code: 'BATCH_QA_TRACE_REQUIRED', message: 'У партии отсутствует проверяемая запись контроля качества.' });
  }
  if (upper(batch.recallStatus) !== 'CLEAR') issues.push({ code: 'PRODUCT_BATCH_RECALL_BLOCKED', message: 'Партия заблокирована или отозвана.' });
  return issues;
}

export function evaluatePackedQuantity(batch: QualityBatchSnapshot, packedQuantity: number): QualityIssue[] {
  if (!Number.isFinite(packedQuantity) || packedQuantity <= 0) {
    return [{ code: 'PACKING_QUANTITY_INVALID', message: 'Количество товара из партии должно быть больше нуля.' }];
  }
  if (Number(batch.quantityAvailable) < packedQuantity) {
    return [{ code: 'BATCH_QUANTITY_INSUFFICIENT', message: 'В партии недостаточно доступного товара для упаковки.' }];
  }
  return [];
}
