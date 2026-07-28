import {
  evaluatePackingRecord,
  evaluateProductBatchForRelease,
  evaluateReleasedProductBatch,
  evaluatePackedQuantity,
} from '../apps/api/src/quality/policy';

describe('box quality operational policy', () => {
  const supplier = { agreementStatus: 'ACTIVE', qualityStatus: 'APPROVED' };
  const product = { metadata: { requiresCertificate: true, requiresStorageCondition: true } };
  const validBatch = {
    productId: 'product-1',
    supplierId: 'supplier-1',
    lotNumber: 'LOT-2026-01',
    quantityAvailable: 20,
    expiryDate: '2027-01-01T00:00:00.000Z',
    certificateReferences: ['CERT-1'],
    storageCondition: 'dry 15-25C',
    supplier,
    product,
    qaStatus: 'RELEASED',
    qaCheckedAt: '2026-07-22T00:00:00.000Z',
    qaCheckedBy: 'quality-1',
    recallStatus: 'CLEAR',
  };

  it('requires dual control and a sealed released box', () => {
    const issues = evaluatePackingRecord({
      packedBy: 'employee-1',
      checkedBy: 'employee-1',
      qaStatus: 'RELEASED',
      qaReleasedAt: new Date(),
      sealedAt: new Date(),
      sealId: 'SEAL-1',
    });
    expect(issues.map((issue) => issue.code)).toContain('DUAL_CONTROL_REQUIRED');
  });

  it('blocks a batch from an unapproved supplier', () => {
    const issues = evaluateProductBatchForRelease({
      ...validBatch,
      supplier: { agreementStatus: 'PENDING', qualityStatus: 'PENDING_REVIEW' },
    }, new Date('2026-07-22T00:00:00.000Z'));
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'SUPPLIER_AGREEMENT_NOT_ACTIVE',
      'SUPPLIER_QUALITY_NOT_APPROVED',
    ]));
  });

  it('requires certificate and storage evidence when product metadata requires them', () => {
    const issues = evaluateProductBatchForRelease({
      ...validBatch,
      certificateReferences: null,
      storageCondition: null,
    }, new Date('2026-07-22T00:00:00.000Z'));
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'BATCH_CERTIFICATE_REQUIRED',
      'BATCH_STORAGE_CONDITION_REQUIRED',
    ]));
  });

  it('accepts a released traceable batch and sufficient quantity', () => {
    expect(evaluateReleasedProductBatch(validBatch, new Date('2026-07-22T00:00:00.000Z'))).toEqual([]);
    expect(evaluatePackedQuantity(validBatch, 5)).toEqual([]);
  });

  it('blocks expired, recalled and insufficient batches', () => {
    const batch = { ...validBatch, expiryDate: '2026-01-01T00:00:00.000Z', recallStatus: 'BLOCKED', quantityAvailable: 1 };
    const codes = evaluateReleasedProductBatch(batch, new Date('2026-07-22T00:00:00.000Z')).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['PRODUCT_BATCH_EXPIRED', 'PRODUCT_BATCH_RECALL_BLOCKED']));
    expect(evaluatePackedQuantity(batch, 2).map((issue) => issue.code)).toContain('BATCH_QUANTITY_INSUFFICIENT');
  });
});
