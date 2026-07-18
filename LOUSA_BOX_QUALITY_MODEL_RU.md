# LOUSA Box Quality Model — 1.18.0

## Реализованные сущности

- Supplier;
- Product/SKU metadata;
- ProductBatch;
- BoxPackingRecord;
- BoxPackingBatch;
- ProductComplaint;
- lot/expiry/received/available;
- QA status/checker/time;
- certificates;
- recall status;
- packing seal/checker/photo reference;
- substitution policy;
- structured allergens.

## Серверные правила

- просроченная/recall/rejected партия не разрешается;
- packing release требует traceable batches;
- аллергенный конфликт блокирует quote;
- неизвестный аллерген требует manual review;
- substitutions выключены по умолчанию;
- замена разрешена только по сохранённой policy;
- courier release требует QA released и sealed packing record.

## Что код не может доказать

- реальное качество закупленного товара;
- подлинность сертификата;
- соблюдение температуры/влажности;
- фактическое соответствие lot упаковке;
- санитарное состояние зоны комплектации;
- обучение упаковщика;
- выполнение recall процедуры.

Для production необходимы SOP, ответственные роли, сканирование lot/expiry, фото/пломба, журналы хранения, входной контроль и тестовый recall drill.
