export type SupportedLanguage = 'en' | 'ru' | 'hy';

export type FlowLevel = 'spotting' | 'light' | 'medium' | 'heavy' | 'very_heavy';
export type ConfidenceLevel = 'insufficient' | 'low' | 'medium' | 'high';
export type CycleGoal = 'track' | 'symptoms' | 'pregnancy' | 'box' | 'reminders';
export type CycleContext =
  | 'natural'
  | 'pill'
  | 'hormonal_iud'
  | 'copper_iud'
  | 'implant'
  | 'injection'
  | 'pregnant'
  | 'postpartum'
  | 'breastfeeding'
  | 'perimenopause'
  | 'amenorrhea'
  | 'prefer_not_to_say';

export type CycleFactor =
  | 'pcos'
  | 'endometriosis'
  | 'thyroid'
  | 'recent_contraception_change'
  | 'recent_pregnancy'
  | 'intense_training'
  | 'weight_change'
  | 'none'
  | 'prefer_not_to_say';

export interface OnboardingProfile {
  goals: CycleGoal[];
  cycleContext: CycleContext;
  factors: CycleFactor[];
  regularity: 'regular' | 'somewhat_variable' | 'irregular' | 'unknown';
  shortestCycle: number | null;
  longestCycle: number | null;
  periodLengthKnown: boolean;
  completedAt: string | null;
  consentVersion?: string | null;
  sensitiveDataConsentAt?: string | null;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  questionnaireStatus?: 'completed' | 'skipped_cycle_date' | 'partial';
  questionnaireSchemaVersion?: string | null;
}

export type CycleObservationType = 'period_start' | 'period_day' | 'period_end' | 'spotting' | 'no_bleeding';

export interface CycleDayObservation {
  id: string;
  date: string;
  type: CycleObservationType;
  source: 'user' | 'imported';
  periodRecordId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  serverRevision?: number;
}

export interface PeriodRecord {
  id: string;
  startDate: string;
  endDate: string | null;
  confirmed: boolean;
  source: 'user' | 'imported' | 'legacy' | 'demo';
  needsReview?: boolean;
  migrationNote?: string;
  flowByDay: Record<string, FlowLevel>;
  painByDay?: Record<string, number>;
  productsUsedByDay?: Record<string, number>;
  nightLeakageByDay?: Record<string, boolean>;
  symptomsByDay?: Record<string, string[]>;
  notesByDay?: Record<string, string>;
  notes?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  serverRevision?: number;
}

export interface CyclePrediction {
  id?: string;
  generatedAt?: string;
  mostLikelyStart: string | null;
  earliestStart: string | null;
  latestStart: string | null;
  medianCycleLength: number | null;
  weightedCycleLength: number | null;
  weightedAverageCycleLength?: number | null;
  averagePeriodLength: number | null;
  variabilityDays: number | null;
  completedCyclesCount: number;
  confirmedPeriodsCount?: number;
  confidence: ConfidenceLevel;
  confidenceScore?: number;
  reasons: string[];
  warnings?: string[];
  lastConfirmedStart: string | null;
  dataQualityScore: number;
  estimatedOvulationDate?: string | null;
  estimatedFertileWindowStart?: string | null;
  estimatedFertileWindowEnd?: string | null;
  isCalendarEstimateOnly?: true;
  expectedWindowPassed?: boolean;
  userReportedNoBleedingThrough?: string | null;
  confidenceExplanation?: string[];
}

export interface PredictionEvaluation {
  id: string;
  predictionId: string;
  predictedMostLikelyDate: string;
  predictedRangeStart: string;
  predictedRangeEnd: string;
  actualStartDate: string;
  absoluteErrorDays: number;
  wasInsideRange: boolean;
  confidenceAtPrediction: ConfidenceLevel;
  evaluatedAt: string;
}

export interface FertilityObservation {
  date: string;
  basalTemperature?: number | null;
  temperatureTime?: string | null;
  temperatureDisturbed?: boolean;
  cervicalMucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'egg_white' | null;
  lhTest?: 'negative' | 'high' | 'peak' | 'unknown' | null;
  notes?: string;
}

export type ProductType = 'pads' | 'tampons' | 'mixed' | 'cup' | 'disc';
export type Absorbency = 'light' | 'regular' | 'super' | 'overnight';

export type AllergenCode =
  | 'milk'
  | 'nuts'
  | 'peanuts'
  | 'gluten'
  | 'soy'
  | 'egg'
  | 'sesame'
  | 'herbs'
  | 'fragrance'
  | 'latex'
  | 'unknown';

export interface StructuredAllergen {
  code: AllergenCode;
  label?: string;
  severity?: 'avoid' | 'sensitivity' | 'unknown';
}

export interface BoxPreferences {
  menstrualProducts: ProductType[];
  primaryProduct: ProductType;
  dailyQuantityEstimate: number;
  nightQuantityEstimate?: number;
  periodLengthEstimate: number;
  flowProfile: FlowLevel[];
  nightProtection: boolean;
  applicatorPreference: 'applicator' | 'non_applicator' | 'no_preference';
  wingPreference: 'wings' | 'no_wings' | 'no_preference';
  reusableProducts: boolean;
  productSizes?: string[];
  preferredBrands?: string[];
  avoidedMaterials?: string[];
  skinSensitivity: boolean;
  fragranceFree: boolean;
  foodAllergies: string[];
  cosmeticAllergies: string[];
  foodIntolerances?: string[];
  dislikedItems: string[];
  favoriteItems?: string[];
  minimumMenstrualItems?: number | null;
  maximumMenstrualItems?: number | null;
  heatPadPreference: 'include' | 'exclude' | 'no_preference';
  teaPreference: 'herbal' | 'decaf' | 'none' | 'no_preference';
  chocolatePreference: 'dark' | 'milk' | 'none' | 'no_preference';
  structuredAllergens?: StructuredAllergen[];
  allowSubstitutions?: boolean;
  substitutionPolicy?: 'none' | 'same_category';
}

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'payment_failed' | 'expired';
export type BoxPlan = 'essential' | 'comfort' | 'ritual';

export interface SubscriptionModel {
  id: string;
  plan: BoxPlan;
  pendingPlan?: BoxPlan | null;
  planChangesAt?: string | null;
  status: SubscriptionStatus;
  pauseUntil?: string | null;
  skipNextBox: boolean;
  deliveryAddressId: string;
  deliveryWindow: string;
  nextBillingDate?: string | null;
  nextPreparationDate?: string | null;
  nextDeliveryDate?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BoxOrderStatus =
  | 'draft'
  | 'scheduled'
  | 'customization_open'
  | 'awaiting_payment'
  | 'paid'
  | 'packing'
  | 'ready'
  | 'courier_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'delayed'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

export type PaymentStatus = 'not_required' | 'pending' | 'requires_action' | 'paid' | 'failed' | 'refund_pending' | 'refunded';

export interface BoxItem {
  id: string;
  sku?: string;
  name: string;
  category: 'menstrual' | 'wellness' | 'food' | 'skincare' | 'gift';
  quantity: number;
  reason: string;
  replaceable: boolean;
  excluded?: boolean;
  allergenTags?: string[];
  unitPriceMinor?: number;
}

export interface OrderStatusEvent {
  status: BoxOrderStatus;
  at: string;
  note?: string;
  source?: 'user' | 'system' | 'warehouse' | 'courier' | 'payment' | 'demo';
}


export type DeliveryAddressType = 'apartment' | 'private_house' | 'office' | 'workplace' | 'hotel' | 'other';
export type AddressFieldOrigin = 'provider_confirmed' | 'inferred' | 'user_entered' | 'unknown';

export type DeliveryHandoffType = 'hand_to_recipient' | 'leave_at_door' | 'leave_with_reception' | 'leave_with_security' | 'call_on_arrival' | 'other';

export interface DeliveryAddress {
  id: string;
  userId?: string | null;
  label: 'home' | 'work' | 'other';
  addressType?: DeliveryAddressType;
  handoffType?: DeliveryHandoffType;
  country: string;
  region: string;
  city: string;
  district: string;
  street: string;
  house: string;
  entrance: string;
  floor: string;
  apartment: string;
  postalCode: string;
  intercomCode: string;
  instructions: string;
  companyName?: string;
  contactPerson?: string;
  officeNumber?: string;
  hotelName?: string;
  roomNumber?: string;
  landmark?: string;
  gateDetails?: string;
  leaveAtDoorLocation?: string;
  callOnArrival?: boolean;
  doNotKnock?: boolean;
  photoConfirmation?: boolean;
  recipientName: string;
  phone: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  provider: 'google' | 'maptiler' | 'device' | 'manual';
  providerPlaceId: string | null;
  fieldOrigins?: Record<string, AddressFieldOrigin>;
  deliveryZoneId: string | null;
  deliveryFeeMinor: number | null;
  estimatedMinutes: number | null;
  validationStatus: 'unverified' | 'verified' | 'outside_zone';
  deliveryIncludedInPlan?: boolean;
  planCode?: string | null;
  zoneVerifiedAt?: string | null;
  syncStatus?: 'synced' | 'pending' | 'failed';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAddressSnapshot {
  recipientName: string;
  phone: string;
  formattedAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryNote?: string;
  addressType?: DeliveryAddressType;
  handoffType?: DeliveryHandoffType;
  entrance?: string;
  floor?: string;
  apartment?: string;
  intercomCode?: string;
  deliveryZoneId?: string | null;
  deliveryFeeMinor?: number | null;
  estimatedMinutes?: number | null;
  fieldOrigins?: Record<string, AddressFieldOrigin>;
}

export interface BoxOrder {
  id: string;
  subscriptionId?: string | null;
  cyclePredictionSnapshot: CyclePrediction | null;
  preferenceSnapshot?: BoxPreferences | null;
  plannedDeliveryDate: string | null;
  deliveryRange: { earliest: string | null; latest: string | null };
  preparationDeadline: string | null;
  customizationDeadline: string | null;
  status: BoxOrderStatus;
  paymentStatus?: PaymentStatus;
  currency?: 'AMD';
  totalMinor?: number;
  version?: number;
  items: BoxItem[];
  statusHistory: OrderStatusEvent[];
  deliveryAddressSnapshot?: DeliveryAddressSnapshot | null;
  demo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoxFeedback {
  orderId: string;
  enoughItems: boolean | null;
  tooFewCategories: string[];
  tooManyCategories: string[];
  likedItems: string[];
  removeItems: string[];
  replaceItems?: Record<string, string>;
  allergyReaction: boolean | null;
  irritationReaction?: boolean | null;
  packagingRating: number | null;
  deliveryRating: number | null;
  note: string;
  createdAt: string;
}

export interface DeliveryPlan {
  targetDate: string | null;
  recommendedDate?: string | null;
  earliestDate: string | null;
  latestDate: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  customizationDeadline: string | null;
  preparationDeadline: string | null;
  canArriveBeforePeriod: boolean;
  mode: 'standard' | 'urgent' | 'next_cycle' | 'insufficient_data' | 'manual_selection';
  strategy?: 'normal' | 'express' | 'next_cycle' | 'manual_selection' | 'insufficient_prediction';
  reasons: string[];
  warnings?: string[];
}

export interface AppNotificationItem {
  id: string;
  remoteId?: string;
  category: 'cycle' | 'diary' | 'box' | 'moon' | 'system' | 'support' | 'delivery';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  route?: string;
  privateBody?: string;
}

export type PermissionState = 'undetermined' | 'granted' | 'denied' | 'blocked' | 'limited' | 'unavailable';

export interface SyncMetadata {
  localRevision: number;
  serverRevision: number | null;
  syncStatus: 'synced' | 'pending' | 'error' | 'conflict';
  lastSyncedAt: string | null;
  lastError?: string | null;
}

export type CommunicationStyle = 'brief' | 'neutral' | 'warm';
export type InsightFeedbackResponse = 'helpful' | 'not_relevant' | 'dismissed';
export type TodayPriorityType =
  | 'confirm_period'
  | 'quick_check_in'
  | 'review_legacy_data'
  | 'box_deadline'
  | 'delivery_today'
  | 'feedback_required'
  | 'complete_profile'
  | 'none';

export interface InsightFeedback {
  id: string;
  insightId: string;
  date: string;
  response: InsightFeedbackResponse;
  createdAt: string;
}

export interface DailyInsight {
  id: string;
  category: string;
  title: string;
  body: string;
  sourceNote: string;
  safetyNote?: string;
}

export interface TodayPriority {
  type: TodayPriorityType;
  priority: number;
  title: string;
  description?: string;
  actionLabel?: string;
  route?: string;
}

export interface GentleProgress {
  careDaysThisMonth: number;
  confirmedCycles: number;
  completedWeeklyReviews: number;
  insightsRated: number;
  lastMilestone?: string;
}

export interface WeeklySummary {
  id: string;
  rangeStart: string;
  rangeEnd: string;
  loggedDays: number;
  averageEnergy: number | null;
  averageSleep: number | null;
  commonMood: string | null;
  commonSymptoms: string[];
  observation: string | null;
  generatedAt: string;
}

export interface CycleStoryHighlight {
  key: string;
  label: string;
  value: string;
}

export interface CycleStory {
  id: string;
  cycleId: string;
  title: string;
  dateRange: string;
  summary: string;
  highlights: CycleStoryHighlight[];
  predictionAccuracy?: number;
  moonVisualKey: string;
  generatedAt: string;
}

export interface ProgressiveProfilePrompt {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  route: string;
}


export type SupportTicketStatus =
  | 'OPEN'
  | 'PENDING_CUSTOMER'
  | 'PENDING_TEAM'
  | 'WAITING_FOR_CUSTOMER'
  | 'WAITING_FOR_TEAM'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';
export type SupportTicketCategory = 'GENERAL' | 'ORDER' | 'DELIVERY' | 'BOX' | 'PAYMENT' | 'SUBSCRIPTION' | 'ACCOUNT' | 'PRIVACY' | 'SAFETY' | 'OTHER';

export interface SupportMessage {
  id: string;
  senderType: 'CUSTOMER' | 'ADMIN' | 'COURIER' | 'SYSTEM';
  body: string;
  visibility?: 'CUSTOMER_AND_SUPPORT' | 'SUPPORT_AND_COURIER' | 'INTERNAL';
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  orderId?: string | null;
  subject: string;
  category: SupportTicketCategory | string;
  status: SupportTicketStatus | string;
  priority: string;
  safeSummary?: string | null;
  contactChannel?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  messages?: SupportMessage[];
  orderCode?: string | null;
  customerVisibleOnly?: true;
}

export interface OrderTimelineEvent {
  id: string;
  type: string;
  publicTitle: string;
  publicBody?: string | null;
  createdAt: string;
}

export interface OrderTimelineSnapshot {
  orderId: string;
  status: BoxOrderStatus | string;
  events: OrderTimelineEvent[];
}

export interface AdminV22SyncHealth {
  api: 'online' | 'offline' | string;
  supportTickets: boolean;
  orderTimeline: boolean;
  courierContact: boolean;
  notificationInbox: boolean;
  privacyBoundary: boolean;
  checkedAt: string;
}

export interface CourierContact {
  available: boolean;
  status?: string | null;
  message?: string;
  supportFallback?: boolean;
  courier?: { id: string; name: string; phone?: string | null };
  canCall?: boolean;
  canMessage?: boolean;
  privacyNote?: string;
}
