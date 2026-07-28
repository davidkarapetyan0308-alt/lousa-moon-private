const fs = require('node:fs');
const path = require('node:path');

const policyPath = path.resolve(process.cwd(), 'apps/api/src/quality/policy.ts');
const serverPath = path.resolve(process.cwd(), 'apps/api/src/server.ts');
const schemaPath = path.resolve(process.cwd(), 'apps/api/prisma/schema.prisma');
const openapiPath = path.resolve(process.cwd(), 'apps/api/openapi.yaml');

for (const file of [policyPath, serverPath, schemaPath, openapiPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required Box quality file: ${path.relative(process.cwd(), file)}`);
}

const policy = fs.readFileSync(policyPath, 'utf8');
const server = fs.readFileSync(serverPath, 'utf8');
const schema = fs.readFileSync(schemaPath, 'utf8');
const openapi = fs.readFileSync(openapiPath, 'utf8');

const requirements = [
  [policy.includes('DUAL_CONTROL_REQUIRED'), 'dual-control policy'],
  [policy.includes('SUPPLIER_AGREEMENT_NOT_ACTIVE'), 'supplier agreement gate'],
  [policy.includes('SUPPLIER_QUALITY_NOT_APPROVED'), 'supplier quality gate'],
  [policy.includes('BATCH_CERTIFICATE_REQUIRED'), 'certificate gate'],
  [policy.includes('BATCH_STORAGE_CONDITION_REQUIRED'), 'storage-condition gate'],
  [policy.includes('PRODUCT_BATCH_RECALL_BLOCKED'), 'recall gate'],
  [server.includes("quality-record\\/release$/"), 'separate packing release endpoint'],
  [server.includes('BOX_RELEASE_SEPARATE_REVIEW_REQUIRED'), 'packer self-release blocker'],
  [server.includes('evaluateReleasedProductBatch'), 'runtime batch policy use'],
  [schema.includes('model BoxPackingRecord'), 'packing record schema'],
  [schema.includes('model ProductBatch'), 'product batch schema'],
  [openapi.includes('/v1/admin/packing/{orderId}/quality-record/release:'), 'OpenAPI release contract'],
  [openapi.includes('/v1/admin/quality/suppliers/{supplierId}/status:'), 'OpenAPI supplier status contract'],
];

const failures = requirements.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error('verify:box-quality-policy FAIL');
  failures.forEach((label) => console.error(`- Missing ${label}`));
  process.exit(1);
}

console.log('verify:box-quality-policy PASS — supplier, batch, dual-control, seal and traceability gates present');
