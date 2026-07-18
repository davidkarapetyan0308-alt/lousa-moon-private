import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("complete product recovery release guards", () => {
  test("onboarding skip cannot fabricate cycle data", () => {
    const onboarding = read("app/auth/onboarding.tsx");
    const store = read("src/store/index.ts");
    expect(onboarding).toContain("selectedDate: null");
    expect(onboarding).toContain(
      "questionnaireStatus: records.length ? 'completed' : 'skipped_cycle_date'",
    );
    expect(onboarding).not.toMatch(/subDays\([^\n]*13/);
    expect(store).toContain("lastPeriodStart: null");
  });

  test("health queues and address drafts use encrypted state storage", () => {
    for (const file of [
      "src/services/cycleSync.ts",
      "src/services/sync.ts",
      "src/services/addressDraft.ts",
      "src/services/cycleSettingsSync.ts",
    ]) {
      expect(read(file)).toContain("encryptedStateStorage");
    }
  });

  test("fake AI route and production admin frontend are absent", () => {
    expect(fs.existsSync(path.join(root, "app/screens/ai-chat.tsx"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(root, "apps/admin"))).toBe(false);
    expect(read("app/screens/help-assistant.tsx")).toContain(
      "подготовленный справочный материал",
    );
  });

  test("subscription activation requires paid order and server actions", () => {
    const server = read("apps/api/src/server.ts");
    const subscription = read("app/screens/subscription.tsx");
    expect(server).toContain("'PAID_ORDER_REQUIRED'");
    expect(server).toContain("pathname === '/v1/subscription/actions'");
    expect(subscription).toContain("orderId: orderResult.data.id");
    expect(subscription).not.toContain("services.box.cancel");
  });

  test("box quality and allergen controls are enforced before fulfillment", () => {
    const schema = read("apps/api/prisma/schema.prisma");
    const server = read("apps/api/src/server.ts");
    expect(schema).toContain("model ProductBatch");
    expect(schema).toContain("model BoxPackingRecord");
    expect(server).toContain("assertOrderPackingQuality");
    expect(server).toContain("ALLERGEN_CONFLICT:");
    expect(server).toContain("SUBSTITUTIONS_DISABLED");
  });

  test("questionnaire schema and contexts stay aligned between mobile and backend", () => {
    const onboarding = read("app/auth/onboarding.tsx");
    const server = read("apps/api/src/server.ts");
    expect(onboarding).toContain("const QUESTIONNAIRE_SCHEMA_VERSION = 3");
    expect(onboarding).toContain(
      "const QUESTIONNAIRE_SCHEMA_ID = 'cycle-profile-v3'",
    );
    for (const context of [
      "natural",
      "pill",
      "hormonal_iud",
      "copper_iud",
      "implant",
      "injection",
      "pregnant",
      "postpartum",
      "breastfeeding",
      "perimenopause",
      "amenorrhea",
      "prefer_not_to_say",
    ]) {
      expect(server).toContain(`'${context}'`);
    }
    expect(server).toContain(
      "questionnaireSchemaVersion: `cycle-profile-v${schemaVersion}`",
    );
  });

  test("native sensitive storage refuses a plaintext fallback", () => {
    const storage = read("src/security/encryptedStateStorage.ts");
    expect(storage).toContain("Platform.OS === 'web'");
    expect(storage).toContain(
      "Encrypted native storage is unavailable for sensitive state",
    );
    expect(storage).not.toContain(
      "Platform.OS !== 'web' || process.env.NODE_ENV !== 'test'",
    );
  });

  test("manual street or house changes invalidate the prior delivery verification", () => {
    const address = read("app/screens/address-map.tsx");
    expect(address).toMatch(
      /handleManualAddressIdentityChange\(["\']street["\'], value\)/,
    );
    expect(address).toMatch(
      /handleManualAddressIdentityChange\(["\']house["\'], value\)/,
    );
    expect(address).toMatch(/setZoneStatus\(["\']idle["\']\)/);
    expect(address).toContain("addressIdentityDirty");
    expect(address).toContain("recheckManualAddressPoint");
    expect(address).toContain("if (addressIdentityDirty)");
  });

  test("delivery remains included and never becomes a client-calculated fee", () => {
    const server = read("apps/api/src/server.ts");
    const subscription = read("app/screens/subscription.tsx");
    expect(server).toContain("let deliveryFeeMinor = 0");
    expect(subscription).toContain("result.data.deliveryFeeMinor !== 0");
  });
});
