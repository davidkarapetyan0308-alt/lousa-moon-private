# LOUSA Moon 1.18.0 — Release Checklist

## Кодовые gates

- [x] Version 1.18.0 / versionCode 109 synchronized.
- [x] TypeScript PASS.
- [x] ESLint PASS.
- [x] Unit 223/223 PASS.
- [x] Contract integration 2/2 PASS.
- [x] Route integrity PASS.
- [x] Touch-target static guard PASS.
- [x] UI geometry / safe area PASS.
- [x] Mobile Only boundary PASS.
- [x] No admin frontend.
- [x] No fake AI route.
- [x] No synthetic cycle fallback.
- [x] Delivery fee zero enforced.
- [x] Server quote/order/subscription flow present.
- [x] Quality/allergen/substitution model present.

## Infrastructure gates

- [ ] Prisma validate with network.
- [ ] Apply migrations to disposable QA PostgreSQL.
- [ ] Real HTTP/DB integration suite.
- [ ] Redis/retry/conflict test.
- [ ] Production payment provider.
- [ ] Webhook signature/replay/refund certification.
- [ ] Separate admin-panel live smoke.
- [ ] Courier app live smoke.

## Android gates

- [ ] Install correct QA google-services.json.
- [ ] Verify Firebase signing SHA.
- [ ] Build QA APK successfully.
- [ ] Verify package/signer/version/bundled JS.
- [ ] Clean install without Metro.
- [ ] Complete Device QA checklist.
- [ ] TalkBack/font scale/language matrix.
- [ ] Screenshot/video/logcat evidence.

## Operations gates

- [ ] Supplier onboarding and certificate verification.
- [ ] Batch/lot/expiry scan workflow.
- [ ] Storage conditions logs.
- [ ] Packing seal and dual check.
- [ ] Complaint-to-batch trace test.
- [ ] Recall drill.
- [ ] Support/cancellation/refund SOP.

## Release decision

**DO NOT RELEASE TO PRODUCTION** until every unchecked P0 gate is complete and signed by engineering, operations and product owner.
