export type CourierTaskDto = {
  id: string;
  orderCode: string;
  recipientName: string;
  phone: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  handoffType: string | null;
  instructions: string | null;
  status: string;
  eta: string | null;
};

function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function sanitizeCourierInstructions(value: unknown): string | null {
  const raw = text(value, 300);
  if (!raw) return null;
  // Delivery instructions are never a channel for health or payment data.
  const blockedPatterns = [
    /(?:cycle|period|menstruat|овуляц|месячн|цикл|դաշտան|օվուլյաց)/giu,
    /(?:symptom|mood|diagnos|симптом|настроен|диагноз|ախտանիշ|տրամադր)/giu,
    /\b(?:\d[ -]*?){13,19}\b/g,
  ];
  let safe = raw;
  for (const pattern of blockedPatterns) safe = safe.replace(pattern, '•••');
  return safe;
}

export function courierTaskDto(task: any, orderCode: (order: any) => string): CourierTaskDto {
  const payload = task?.safePayload && typeof task.safePayload === 'object' ? task.safePayload : {};
  const address = task?.order?.deliveryAddress || {};
  return {
    id: text(task?.id, 120),
    orderCode: text(task?.order ? orderCode(task.order) : payload.orderCode, 40),
    recipientName: text(payload.recipientName || address.recipientName, 120),
    phone: text(payload.phone || address.phone, 40),
    formattedAddress: text(payload.formattedAddress || address.formattedAddress, 300),
    latitude: numberOrNull(payload.latitude ?? address.latitude),
    longitude: numberOrNull(payload.longitude ?? address.longitude),
    handoffType: text(payload.handoffType || address.handoffType, 80) || null,
    instructions: sanitizeCourierInstructions(payload.instructions || address.instructions),
    status: text(task?.status, 60),
    eta: task?.eta?.toISOString?.() || null,
  };
}

export const COURIER_DTO_FIELDS = Object.freeze([
  'id',
  'orderCode',
  'recipientName',
  'phone',
  'formattedAddress',
  'latitude',
  'longitude',
  'handoffType',
  'instructions',
  'status',
  'eta',
] as const);
