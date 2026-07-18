export const ORDER_STATUSES = [
  'DRAFT','PENDING_PAYMENT','PAID','PACKING','READY_FOR_COURIER','COURIER_ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','PAYMENT_FAILED','REFUNDED','ISSUE',
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = ['UNPAID','REQUIRES_ACTION','PROCESSING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const DELIVERY_STATUSES = ['NOT_READY','READY','READY_FOR_COURIER','COURIER_ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY','DELIVERED','DELIVERY_ISSUE','FAILED','RETURNED','CANCELLED'] as const;
export type DeliveryStatus = typeof DELIVERY_STATUSES[number];

export const ADMIN_ROLES = ['OWNER','ADMIN','SUPPORT','PACKER','COURIER_MANAGER','COURIER','READONLY','CATALOG_MANAGER'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export const PRODUCT_CATEGORIES = ['PADS_DAY','PADS_NIGHT','TAMPONS','LINERS','WIPES','TEA','SWEET','HEAT_PATCH','SKINCARE','ACCESSORY','REUSABLE_CUP','REUSABLE_DISC','OTHER'] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const DELIVERY_HANDOFF_TYPES = ['HAND_TO_RECIPIENT','LEAVE_AT_DOOR','LEAVE_WITH_RECEPTION','LEAVE_WITH_SECURITY','CALL_ON_ARRIVAL','OTHER'] as const;
export type DeliveryHandoffType = typeof DELIVERY_HANDOFF_TYPES[number];

export const DELIVERY_ADDRESS_TYPES = ['APARTMENT','PRIVATE_HOUSE','OFFICE','WORKPLACE','HOTEL','OTHER'] as const;
export type DeliveryAddressType = typeof DELIVERY_ADDRESS_TYPES[number];

export const allowedDeliveryTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  NOT_READY: ['READY', 'READY_FOR_COURIER', 'CANCELLED'],
  READY: ['READY_FOR_COURIER', 'COURIER_ASSIGNED', 'CANCELLED'],
  READY_FOR_COURIER: ['COURIER_ASSIGNED', 'CANCELLED'],
  COURIER_ASSIGNED: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERY_ISSUE'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'DELIVERY_ISSUE'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ISSUE'],
  DELIVERED: [],
  DELIVERY_ISSUE: ['OUT_FOR_DELIVERY', 'FAILED', 'RETURNED'],
  FAILED: ['RETURNED'],
  RETURNED: [],
  CANCELLED: [],
};

export function canTransitionDelivery(from: string, to: string, actorRole: AdminRole = 'ADMIN') {
  if (!DELIVERY_STATUSES.includes(from as DeliveryStatus) || !DELIVERY_STATUSES.includes(to as DeliveryStatus)) return false;
  if (actorRole === 'READONLY' || actorRole === 'SUPPORT' || actorRole === 'PACKER' || actorRole === 'CATALOG_MANAGER') return false;
  if (actorRole === 'OWNER') return true;
  if (actorRole === 'COURIER') {
    const courierTargets: DeliveryStatus[] = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_ISSUE'];
    if (!courierTargets.includes(to as DeliveryStatus)) return false;
  }
  return allowedDeliveryTransitions[from as DeliveryStatus].includes(to as DeliveryStatus);
}

export const allowedOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING_PAYMENT','CANCELLED'],
  PENDING_PAYMENT: ['PAID','PAYMENT_FAILED','CANCELLED'],
  PAID: ['PACKING','CANCELLED','ISSUE'],
  PACKING: ['READY_FOR_COURIER','ISSUE','CANCELLED'],
  READY_FOR_COURIER: ['COURIER_ASSIGNED','ISSUE','CANCELLED'],
  COURIER_ASSIGNED: ['PICKED_UP','OUT_FOR_DELIVERY','ISSUE','CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY','ISSUE','CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED','ISSUE'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  PAYMENT_FAILED: ['PENDING_PAYMENT','CANCELLED'],
  REFUNDED: [],
  ISSUE: ['PACKING','READY_FOR_COURIER','CANCELLED','REFUNDED'],
};

export function canTransitionOrder(from: string, to: string, actorRole: AdminRole = 'ADMIN') {
  if (actorRole === 'OWNER') return ORDER_STATUSES.includes(to as OrderStatus);
  if (!ORDER_STATUSES.includes(from as OrderStatus) || !ORDER_STATUSES.includes(to as OrderStatus)) return false;
  return allowedOrderTransitions[from as OrderStatus].includes(to as OrderStatus);
}

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export interface SafeCustomerDTO {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  createdAt?: string;
  ordersCount?: number;
}

export interface AdminOrderDTO {
  id: string;
  code: string;
  status: OrderStatus | string;
  paymentStatus: string;
  totalMinor: number;
  currency: string;
  createdAt: string;
  customer: SafeCustomerDTO;
  delivery?: {
    formattedAddress?: string | null;
    city?: string | null;
    phone?: string | null;
    recipientName?: string | null;
    handoffType?: string | null;
  };
  plan?: string | null;
  itemsCount: number;
}

export interface PackerOrderDTO {
  id: string;
  code: string;
  status: string;
  plan?: string | null;
  items: Array<{ id: string; sku?: string | null; name: string; quantity: number; packedQuantity?: number; status?: string }>;
  preferences?: Record<string, unknown>;
}

export interface CourierTaskDTO {
  id: string;
  orderCode: string;
  recipientName: string;
  phone: string;
  formattedAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  handoffType?: string | null;
  instructions?: string | null;
  status: string;
  eta?: string | null;
}
