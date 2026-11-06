'use client';

import * as React from 'react';
import { type MotionMode, useChanged } from '@/hooks/use-on-twos';
import {
  Sheet,
  Scene,
  Panel,
  SegmentedControl,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Field,
  Input,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Tag,
  type TagStatus,
  Alert,
  Notice,
  ToastProvider,
  useToast,
  useOptionalToast,
  Skeleton,
  SkeletonText,
  EmptyState,
  Breadcrumb,
  Pagination,
  Metric,
  ToneAreaChart,
  type ToneAreaDatum,
  ToneBarList,
  type ToneBarItem,
  ToneSpark,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/frame12';

export type ConsoleSection = 'overview' | 'services' | 'api-keys' | 'request-logs';
export type ConsoleDatasetState = 'populated' | 'loading' | 'empty' | 'error';
export type ConsoleTimeRange = '24h' | '7d' | '30d';
export type ConsoleEnvironment = 'prod-us-east-1' | 'staging-eu-central-1';
export type EndpointHealthFilter = 'all' | 'healthy' | 'degraded' | 'canary';
export type EndpointMethodFilter = 'ALL' | 'POST' | 'GET' | 'PUT' | 'DELETE';
export type LogStatusFilter = 'all' | '2xx' | '4xx' | '5xx';
export type ApiKeyScope = 'read_only' | 'dispatch_write' | 'admin';

export interface ConsoleRangeSnapshot {
  range: ConsoleTimeRange;
  label: string;
  windowNote: string;
  totalRequests: number;
  requestDeltaPct: number;
  requestDeltaNote: string;
  errorRateBasisPoints: number; // e.g. 42 => 0.42%
  errorCount: number;
  errorDeltaPp: number;
  errorDeltaNote: string;
  p95LatencyMs: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  latencyDeltaPct: number;
  latencyDeltaNote: string;
  peakCallout: string;
  latencySpark: number[];
  series: ToneAreaDatum[];
  serviceSeries: Record<string, number[]>;
}

export interface ConsoleServiceItem {
  id: string;
  name: string;
  code: string;
  owner: string;
  status: 'healthy' | 'degraded' | 'canary';
  requests24h: number;
  share24h: number;
  p95Ms: number;
  errorRatePct: string;
  pattern: 'dense' | 'hatch' | 'dots';
  spark: number[];
  summary: string;
}

export interface ConsoleEndpointItem {
  id: string;
  serviceId: string;
  serviceName: string;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  route: string;
  owner: string;
  rateLimitRps: number;
  requests24h: number;
  errorRatePct: string;
  p95Ms: number;
  status: 'healthy' | 'degraded' | 'canary';
  schemaVersion: string;
  timeoutMs: number;
  retryPolicy: string;
  description: string;
}

export interface SimulatedApiKey {
  id: string;
  label: string;
  maskedToken: string;
  scope: ApiKeyScope;
  rateTier: string;
  requireHmac: boolean;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'revoked';
}

export interface ConsoleRequestLogItem {
  id: string;
  requestId: string;
  timestamp: string;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  route: string;
  serviceId: string;
  serviceName: string;
  statusCode: number;
  statusClass: '2xx' | '4xx' | '5xx';
  durationMs: number;
  region: string;
  apiKeyId: string;
  idempotencyKey: string;
  tlsMs: number;
  queueMs: number;
  upstreamMs: number;
  requestPayload: string;
  responsePayload: string;
  replayed?: boolean;
}

export const CONSOLE_RANGE_SNAPSHOTS: Record<ConsoleTimeRange, ConsoleRangeSnapshot> = {
  '24h': {
    range: '24h',
    label: '24 Hours',
    windowNote: 'Oct 31, 2026 · 00:00–24:00 UTC',
    totalRequests: 1482900,
    requestDeltaPct: 0.064,
    requestDeltaNote: 'vs prior 24h (1,393,700)',
    errorRateBasisPoints: 42,
    errorCount: 6228,
    errorDeltaPp: -0.18,
    errorDeltaNote: '6,228 non-2xx of 1.48M reqs',
    p95LatencyMs: 38,
    p50LatencyMs: 14,
    p99LatencyMs: 94,
    latencyDeltaPct: -0.191,
    latencyDeltaNote: 'p50 14 ms · p99 94 ms',
    peakCallout: 'Peak 15:00 UTC · 248.4k reqs · 34 ms p95',
    latencySpark: [42, 39, 37, 35, 44, 41, 38, 36],
    series: [
      { label: '00:00', value: 142, compareValue: 134 },
      { label: '03:00', value: 128, compareValue: 125 },
      { label: '06:00', value: 164, compareValue: 152 },
      { label: '09:00', value: 198, compareValue: 184 },
      { label: '12:00', value: 221, compareValue: 205 },
      { label: '15:00', value: 248, compareValue: 229 },
      { label: '18:00', value: 204, compareValue: 192 },
      { label: '21:00', value: 178, compareValue: 173 },
    ],
    serviceSeries: {
      'svc-webhook-dispatch': [62, 56, 72, 87, 97, 109, 90, 79],
      'svc-checkout-session': [43, 38, 49, 59, 66, 74, 61, 55],
      'svc-inventory-ledger': [24, 22, 28, 34, 38, 42, 35, 29],
      'svc-tax-quote': [13, 12, 15, 18, 20, 23, 18, 15],
    },
  },
  '7d': {
    range: '7d',
    label: '7 Days',
    windowNote: 'Oct 25 – Oct 31, 2026 UTC',
    totalRequests: 9840200,
    requestDeltaPct: 0.112,
    requestDeltaNote: 'vs prior 7d (8,849,100)',
    errorRateBasisPoints: 51,
    errorCount: 50185,
    errorDeltaPp: -0.09,
    errorDeltaNote: '50,185 non-2xx of 9.84M reqs',
    p95LatencyMs: 41,
    p50LatencyMs: 15,
    p99LatencyMs: 102,
    latencyDeltaPct: -0.109,
    latencyDeltaNote: 'p50 15 ms · p99 102 ms',
    peakCallout: 'Peak Oct 31 · 1,482.9k reqs · 38 ms p95',
    latencySpark: [46, 45, 43, 44, 41, 40, 38],
    series: [
      { label: 'Oct 25', value: 1290, compareValue: 1180 },
      { label: 'Oct 26', value: 1340, compareValue: 1210 },
      { label: 'Oct 27', value: 1385, compareValue: 1255 },
      { label: 'Oct 28', value: 1410, compareValue: 1270 },
      { label: 'Oct 29', value: 1452, compareValue: 1310 },
      { label: 'Oct 30', value: 1480, compareValue: 1330 },
      { label: 'Oct 31', value: 1483, compareValue: 1394 },
    ],
    serviceSeries: {
      'svc-webhook-dispatch': [568, 590, 609, 620, 639, 651, 652],
      'svc-checkout-session': [387, 402, 416, 423, 436, 444, 445],
      'svc-inventory-ledger': [219, 228, 235, 240, 247, 252, 252],
      'svc-tax-quote': [116, 120, 125, 127, 130, 133, 134],
    },
  },
  '30d': {
    range: '30d',
    label: '30 Days',
    windowNote: 'Oct 02 – Oct 31, 2026 UTC',
    totalRequests: 39410000,
    requestDeltaPct: 0.186,
    requestDeltaNote: 'vs prior 30d (33,229,300)',
    errorRateBasisPoints: 58,
    errorCount: 228578,
    errorDeltaPp: -0.24,
    errorDeltaNote: '228.6k non-2xx of 39.41M reqs',
    p95LatencyMs: 44,
    p50LatencyMs: 16,
    p99LatencyMs: 112,
    latencyDeltaPct: -0.2,
    latencyDeltaNote: 'p50 16 ms · p99 112 ms',
    peakCallout: 'Peak Oct 29–31 · 4,415k reqs · 38 ms p95',
    latencySpark: [52, 50, 48, 47, 45, 44, 42, 41, 39, 38],
    series: [
      { label: 'Oct 04', value: 3520, compareValue: 3010 },
      { label: 'Oct 07', value: 3640, compareValue: 3120 },
      { label: 'Oct 10', value: 3710, compareValue: 3190 },
      { label: 'Oct 13', value: 3820, compareValue: 3260 },
      { label: 'Oct 16', value: 3890, compareValue: 3310 },
      { label: 'Oct 19', value: 3980, compareValue: 3390 },
      { label: 'Oct 22', value: 4090, compareValue: 3460 },
      { label: 'Oct 25', value: 4160, compareValue: 3520 },
      { label: 'Oct 28', value: 4185, compareValue: 3580 },
      { label: 'Oct 31', value: 4415, compareValue: 3640 },
    ],
    serviceSeries: {
      'svc-webhook-dispatch': [1549, 1602, 1632, 1681, 1712, 1751, 1800, 1830, 1841, 1943],
      'svc-checkout-session': [1056, 1092, 1113, 1146, 1167, 1194, 1227, 1248, 1256, 1325],
      'svc-inventory-ledger': [598, 619, 631, 649, 661, 677, 695, 707, 711, 750],
      'svc-tax-quote': [317, 327, 334, 344, 350, 358, 368, 375, 377, 397],
    },
  },
};

// Note: 652,476 + 444,870 + 252,093 + 133,461 === 1,482,900 (reconciled with 24h totalRequests)
export const CONSOLE_SERVICES: ConsoleServiceItem[] = [
  {
    id: 'svc-webhook-dispatch',
    name: 'Webhook Dispatch Engine',
    code: 'SVC-01',
    owner: 'Core Messaging',
    status: 'healthy',
    requests24h: 652476,
    share24h: 0.44,
    p95Ms: 34,
    errorRatePct: '0.21%',
    pattern: 'dense',
    spark: [36, 35, 34, 33, 35, 34, 33, 34],
    summary: 'Signed HMAC-SHA256 outbound event delivery and dead-letter replay queue.',
  },
  {
    id: 'svc-checkout-session',
    name: 'Checkout Session Edge',
    code: 'SVC-02',
    owner: 'Commerce Edge',
    status: 'healthy',
    requests24h: 444870,
    share24h: 0.3,
    p95Ms: 29,
    errorRatePct: '0.14%',
    pattern: 'hatch',
    spark: [31, 30, 29, 28, 30, 29, 28, 29],
    summary: 'Low-latency cart token validation, recovery holdout assignment, and session state.',
  },
  {
    id: 'svc-inventory-ledger',
    name: 'Inventory Ledger Sync',
    code: 'SVC-03',
    owner: 'Fulfillment Ops',
    status: 'degraded',
    requests24h: 252093,
    share24h: 0.17,
    p95Ms: 58,
    errorRatePct: '1.18%',
    pattern: 'dots',
    spark: [44, 47, 52, 61, 64, 59, 57, 58],
    summary: 'Warehouse allocation lock contention in eu-central-1 replica (+14 ms p95 drift).',
  },
  {
    id: 'svc-tax-quote',
    name: 'Customs & Duty Quote API',
    code: 'SVC-04',
    owner: 'Cross-Border',
    status: 'canary',
    requests24h: 133461,
    share24h: 0.09,
    p95Ms: 46,
    errorRatePct: '0.95%',
    pattern: 'dots',
    spark: [49, 48, 47, 46, 47, 45, 46, 46],
    summary: 'HS-tariff harmonization v2.4 canary rollout (15% traffic weight).',
  },
];

// Note: Endpoint 24h volumes sum exactly to each parent service's 24h volume (total 1,482,900)
export const CONSOLE_ENDPOINTS: ConsoleEndpointItem[] = [
  {
    id: 'ep-webhook-dispatch',
    serviceId: 'svc-webhook-dispatch',
    serviceName: 'Webhook Dispatch Engine',
    method: 'POST',
    route: '/v2/webhooks/dispatch',
    owner: 'Core Messaging',
    rateLimitRps: 2500,
    requests24h: 541200,
    errorRatePct: '0.19%',
    p95Ms: 32,
    status: 'healthy',
    schemaVersion: '2026-10-15.v2',
    timeoutMs: 3000,
    retryPolicy: '5 attempts · exponential backoff (1s..60s)',
    description: 'Enqueues and signs an outbound webhook event for immediate delivery.',
  },
  {
    id: 'ep-webhook-replay',
    serviceId: 'svc-webhook-dispatch',
    serviceName: 'Webhook Dispatch Engine',
    method: 'POST',
    route: '/v2/webhooks/replay',
    owner: 'Core Messaging',
    rateLimitRps: 600,
    requests24h: 111276,
    errorRatePct: '0.31%',
    p95Ms: 41,
    status: 'healthy',
    schemaVersion: '2026-10-15.v2',
    timeoutMs: 5000,
    retryPolicy: '3 attempts · idempotent replay token required',
    description: 'Re-dispatches a previously recorded delivery attempt using its original payload hash.',
  },
  {
    id: 'ep-session-create',
    serviceId: 'svc-checkout-session',
    serviceName: 'Checkout Session Edge',
    method: 'POST',
    route: '/v2/sessions',
    owner: 'Commerce Edge',
    rateLimitRps: 2000,
    requests24h: 268400,
    errorRatePct: '0.16%',
    p95Ms: 31,
    status: 'healthy',
    schemaVersion: '2026-09-01.v2',
    timeoutMs: 2000,
    retryPolicy: '2 attempts · edge failover enabled',
    description: 'Creates a signed checkout recovery session with experiment cohort assignment.',
  },
  {
    id: 'ep-session-get',
    serviceId: 'svc-checkout-session',
    serviceName: 'Checkout Session Edge',
    method: 'GET',
    route: '/v2/sessions/:id',
    owner: 'Commerce Edge',
    rateLimitRps: 4000,
    requests24h: 176470,
    errorRatePct: '0.11%',
    p95Ms: 24,
    status: 'healthy',
    schemaVersion: '2026-09-01.v2',
    timeoutMs: 1500,
    retryPolicy: 'Read-through edge cache (TTL 30s)',
    description: 'Reads checkout session state, line items, and intervention attribution.',
  },
  {
    id: 'ep-inventory-reserve',
    serviceId: 'svc-inventory-ledger',
    serviceName: 'Inventory Ledger Sync',
    method: 'PUT',
    route: '/v2/inventory/reserve',
    owner: 'Fulfillment Ops',
    rateLimitRps: 800,
    requests24h: 158900,
    errorRatePct: '1.62%',
    p95Ms: 64,
    status: 'degraded',
    schemaVersion: '2026-10-01.v2',
    timeoutMs: 4000,
    retryPolicy: 'Optimistic lock retry (max 3)',
    description: 'Places a 15-minute SKU reservation hold across regional fulfillment nodes.',
  },
  {
    id: 'ep-inventory-stock',
    serviceId: 'svc-inventory-ledger',
    serviceName: 'Inventory Ledger Sync',
    method: 'GET',
    route: '/v2/inventory/stock',
    owner: 'Fulfillment Ops',
    rateLimitRps: 1500,
    requests24h: 93193,
    errorRatePct: '0.43%',
    p95Ms: 45,
    status: 'healthy',
    schemaVersion: '2026-10-01.v2',
    timeoutMs: 2000,
    retryPolicy: 'Stale-while-revalidate (15s)',
    description: 'Queries real-time available-to-promise inventory counts by warehouse.',
  },
  {
    id: 'ep-customs-quote',
    serviceId: 'svc-tax-quote',
    serviceName: 'Customs & Duty Quote API',
    method: 'POST',
    route: '/v2/customs/quote',
    owner: 'Cross-Border',
    rateLimitRps: 500,
    requests24h: 109200,
    errorRatePct: '1.08%',
    p95Ms: 48,
    status: 'canary',
    schemaVersion: '2026-10-28.v2-canary',
    timeoutMs: 3500,
    retryPolicy: 'Fallback to static tariff schedule on timeout',
    description: 'Computes landed duty, VAT, and brokerage fees for cross-border shipments.',
  },
  {
    id: 'ep-customs-cache',
    serviceId: 'svc-tax-quote',
    serviceName: 'Customs & Duty Quote API',
    method: 'DELETE',
    route: '/v2/customs/cache',
    owner: 'Cross-Border',
    rateLimitRps: 120,
    requests24h: 24261,
    errorRatePct: '0.37%',
    p95Ms: 37,
    status: 'healthy',
    schemaVersion: '2026-10-28.v2',
    timeoutMs: 2500,
    retryPolicy: 'Idempotent purge broadcast',
    description: 'Invalidates cached HS-code tariff lookups for a merchant catalog.',
  },
];

// All credentials below are strictly fictional simulation strings (f12_sim_*)
export const INITIAL_API_KEYS: SimulatedApiKey[] = [
  {
    id: 'key-prod-primary',
    label: 'Primary Webhook Dispatcher',
    maskedToken: 'f12_sim_live_••••_9a4c',
    scope: 'dispatch_write',
    rateTier: 'Burst · 2,000 req/s',
    requireHmac: true,
    createdAt: '2026-09-14',
    lastUsed: 'Oct 31 · 14:58 UTC',
    status: 'active',
  },
  {
    id: 'key-checkout-edge',
    label: 'Storefront Edge Worker',
    maskedToken: 'f12_sim_live_••••_3d81',
    scope: 'dispatch_write',
    rateTier: 'Dedicated · 5,000 req/s',
    requireHmac: true,
    createdAt: '2026-10-02',
    lastUsed: 'Oct 31 · 14:59 UTC',
    status: 'active',
  },
  {
    id: 'key-datadog-exporter',
    label: 'Audit Ledger Read-Only',
    maskedToken: 'f12_sim_read_••••_7e20',
    scope: 'read_only',
    rateTier: 'Standard · 500 req/s',
    requireHmac: false,
    createdAt: '2026-08-19',
    lastUsed: 'Oct 31 · 14:45 UTC',
    status: 'active',
  },
  {
    id: 'key-legacy-migration',
    label: 'Legacy Batch Importer (Q3)',
    maskedToken: 'f12_sim_admin_••••_1b09',
    scope: 'admin',
    rateTier: 'Standard · 500 req/s',
    requireHmac: true,
    createdAt: '2026-07-01',
    lastUsed: 'Oct 12 · 09:14 UTC',
    status: 'revoked',
  },
];

export const INITIAL_REQUEST_LOGS: ConsoleRequestLogItem[] = [
  {
    id: 'log-1',
    requestId: 'req_01J9Z8K4M2',
    timestamp: '14:59:12 UTC',
    method: 'POST',
    route: '/v2/webhooks/dispatch',
    serviceId: 'svc-webhook-dispatch',
    serviceName: 'Webhook Dispatch Engine',
    statusCode: 202,
    statusClass: '2xx',
    durationMs: 28,
    region: 'us-east-1',
    apiKeyId: 'key-prod-primary',
    idempotencyKey: 'idem_ord_9041_a8f',
    tlsMs: 4,
    queueMs: 6,
    upstreamMs: 18,
    requestPayload:
      '{"event":"cart.abandoned","orderId":"ORD-9041","channel":"email","amountUsd":1420}',
    responsePayload: '{"accepted":true,"deliveryId":"dlv_8841a","queuedAt":"14:59:12.028Z"}',
  },
  {
    id: 'log-2',
    requestId: 'req_01J9Z8J9P0',
    timestamp: '14:58:47 UTC',
    method: 'PUT',
    route: '/v2/inventory/reserve',
    serviceId: 'svc-inventory-ledger',
    serviceName: 'Inventory Ledger Sync',
    statusCode: 504,
    statusClass: '5xx',
    durationMs: 4002,
    region: 'eu-central-1',
    apiKeyId: 'key-checkout-edge',
    idempotencyKey: 'idem_sku_4410_lock',
    tlsMs: 5,
    queueMs: 112,
    upstreamMs: 3885,
    requestPayload:
      '{"sku":"F12-INK-PEN-04","warehouse":"FRA-02","quantity":12,"holdSeconds":900}',
    responsePayload:
      '{"error":"upstream_lock_timeout","code":"ERR_LEDGER_LOCK_504","retryable":true}',
  },
  {
    id: 'log-3',
    requestId: 'req_01J9Z8H3T8',
    timestamp: '14:57:31 UTC',
    method: 'POST',
    route: '/v2/sessions',
    serviceId: 'svc-checkout-session',
    serviceName: 'Checkout Session Edge',
    statusCode: 200,
    statusClass: '2xx',
    durationMs: 19,
    region: 'us-east-1',
    apiKeyId: 'key-checkout-edge',
    idempotencyKey: 'idem_sess_7721_c01',
    tlsMs: 3,
    queueMs: 2,
    upstreamMs: 14,
    requestPayload: '{"merchantId":"m_fernwood","cartTotal":980,"currency":"USD","cohort":"on_twos"}',
    responsePayload: '{"sessionId":"cs_live_9042","holdout":false,"expiresIn":1800}',
  },
  {
    id: 'log-4',
    requestId: 'req_01J9Z8G1V4',
    timestamp: '14:56:04 UTC',
    method: 'POST',
    route: '/v2/customs/quote',
    serviceId: 'svc-tax-quote',
    serviceName: 'Customs & Duty Quote API',
    statusCode: 422,
    statusClass: '4xx',
    durationMs: 31,
    region: 'eu-central-1',
    apiKeyId: 'key-checkout-edge',
    idempotencyKey: 'idem_duty_3319_hs',
    tlsMs: 4,
    queueMs: 5,
    upstreamMs: 22,
    requestPayload: '{"origin":"US","destination":"JP","hsCode":"9608.20.INVALID","declaredValue":640}',
    responsePayload:
      '{"error":"invalid_hs_tariff_code","field":"hsCode","expectedPattern":"^\\\\d{4}\\\\.\\\\d{2}$"}',
  },
  {
    id: 'log-5',
    requestId: 'req_01J9Z8E8B2',
    timestamp: '14:54:50 UTC',
    method: 'GET',
    route: '/v2/sessions/:id',
    serviceId: 'svc-checkout-session',
    serviceName: 'Checkout Session Edge',
    statusCode: 200,
    statusClass: '2xx',
    durationMs: 12,
    region: 'us-east-1',
    apiKeyId: 'key-datadog-exporter',
    idempotencyKey: 'idem_read_9044_q',
    tlsMs: 3,
    queueMs: 1,
    upstreamMs: 8,
    requestPayload: '{"sessionId":"cs_live_9044","includeAttribution":true}',
    responsePayload: '{"sessionId":"cs_live_9044","status":"recovered","liftPP":3.6}',
  },
  {
    id: 'log-6',
    requestId: 'req_01J9Z8C2W9',
    timestamp: '14:52:19 UTC',
    method: 'POST',
    route: '/v2/webhooks/replay',
    serviceId: 'svc-webhook-dispatch',
    serviceName: 'Webhook Dispatch Engine',
    statusCode: 429,
    statusClass: '4xx',
    durationMs: 9,
    region: 'us-east-1',
    apiKeyId: 'key-prod-primary',
    idempotencyKey: 'idem_replay_burst_19',
    tlsMs: 3,
    queueMs: 2,
    upstreamMs: 4,
    requestPayload: '{"deliveryId":"dlv_8810c","reason":"endpoint_timeout_retry"}',
    responsePayload:
      '{"error":"rate_limit_exceeded","limitRps":600,"retryAfterSeconds":2}',
  },
  {
    id: 'log-7',
    requestId: 'req_01J9Z8A7Q1',
    timestamp: '14:50:03 UTC',
    method: 'GET',
    route: '/v2/inventory/stock',
    serviceId: 'svc-inventory-ledger',
    serviceName: 'Inventory Ledger Sync',
    statusCode: 200,
    statusClass: '2xx',
    durationMs: 33,
    region: 'us-east-1',
    apiKeyId: 'key-datadog-exporter',
    idempotencyKey: 'idem_stock_us_08',
    tlsMs: 4,
    queueMs: 5,
    upstreamMs: 24,
    requestPayload: '{"warehouse":"EWR-01","skus":["F12-TONE-SHEET","F12-PEG-BAR"]}',
    responsePayload: '{"warehouse":"EWR-01","available":{"F12-TONE-SHEET":480,"F12-PEG-BAR":195}}',
  },
  {
    id: 'log-8',
    requestId: 'req_01J9Z890N5',
    timestamp: '14:48:22 UTC',
    method: 'DELETE',
    route: '/v2/customs/cache',
    serviceId: 'svc-tax-quote',
    serviceName: 'Customs & Duty Quote API',
    statusCode: 401,
    statusClass: '4xx',
    durationMs: 7,
    region: 'us-east-1',
    apiKeyId: 'key-legacy-migration',
    idempotencyKey: 'idem_purge_revoked_01',
    tlsMs: 3,
    queueMs: 1,
    upstreamMs: 3,
    requestPayload: '{"merchantId":"m_fernwood","scope":"hs_chapter_96"}',
    responsePayload:
      '{"error":"revoked_api_key","keyId":"key-legacy-migration","message":"Simulated credential was revoked."}',
  },
  {
    id: 'log-9',
    requestId: 'req_01J9Z874L3',
    timestamp: '14:45:11 UTC',
    method: 'POST',
    route: '/v2/webhooks/dispatch',
    serviceId: 'svc-webhook-dispatch',
    serviceName: 'Webhook Dispatch Engine',
    statusCode: 502,
    statusClass: '5xx',
    durationMs: 618,
    region: 'eu-central-1',
    apiKeyId: 'key-prod-primary',
    idempotencyKey: 'idem_ord_9038_badgw',
    tlsMs: 5,
    queueMs: 14,
    upstreamMs: 599,
    requestPayload: '{"event":"payment.retry_scheduled","orderId":"ORD-9038","attempt":2}',
    responsePayload:
      '{"error":"upstream_bad_gateway","code":"ERR_WEBHOOK_TARGET_502","scheduledRetryInSec":4}',
  },
  {
    id: 'log-10',
    requestId: 'req_01J9Z859D7',
    timestamp: '14:42:08 UTC',
    method: 'POST',
    route: '/v2/customs/quote',
    serviceId: 'svc-tax-quote',
    serviceName: 'Customs & Duty Quote API',
    statusCode: 200,
    statusClass: '2xx',
    durationMs: 42,
    region: 'us-east-1',
    apiKeyId: 'key-checkout-edge',
    idempotencyKey: 'idem_duty_9037_ok',
    tlsMs: 4,
    queueMs: 6,
    upstreamMs: 32,
    requestPayload: '{"origin":"US","destination":"DE","hsCode":"9608.20","declaredValue":1250}',
    responsePayload: '{"dutyUsd":37.5,"vatUsd":244.63,"totalLandedUsd":1532.13,"canary":true}',
  },
  {
    id: 'log-11',
    requestId: 'req_01J9Z832F6',
    timestamp: '14:39:44 UTC',
    method: 'PUT',
    route: '/v2/inventory/reserve',
    serviceId: 'svc-inventory-ledger',
    serviceName: 'Inventory Ledger Sync',
    statusCode: 200,
    statusClass: '2xx',
    durationMs: 49,
    region: 'us-east-1',
    apiKeyId: 'key-checkout-edge',
    idempotencyKey: 'idem_sku_4402_ok',
    tlsMs: 4,
    queueMs: 8,
    upstreamMs: 37,
    requestPayload: '{"sku":"F12-RULED-PAD","warehouse":"EWR-01","quantity":4,"holdSeconds":900}',
    responsePayload: '{"reservationId":"rsv_33019","expiresAt":"14:54:44Z","remainingStock":92}',
  },
  {
    id: 'log-12',
    requestId: 'req_01J9Z811R2',
    timestamp: '14:36:15 UTC',
    method: 'POST',
    route: '/v2/webhooks/dispatch',
    serviceId: 'svc-webhook-dispatch',
    serviceName: 'Webhook Dispatch Engine',
    statusCode: 202,
    statusClass: '2xx',
    durationMs: 26,
    region: 'us-east-1',
    apiKeyId: 'key-prod-primary',
    idempotencyKey: 'idem_ord_9035_ok',
    tlsMs: 4,
    queueMs: 4,
    upstreamMs: 18,
    requestPayload: '{"event":"order.recovered","orderId":"ORD-9035","amountUsd":2150}',
    responsePayload: '{"accepted":true,"deliveryId":"dlv_8792f","queuedAt":"14:36:15.026Z"}',
  },
];

const AUDIT_FEED = [
  {
    id: 'aud-1',
    time: '14:58 UTC',
    actor: 'svc-inventory-ledger',
    summary: 'Replica lock contention alert opened in eu-central-1 (+14 ms p95 drift).',
    status: 'warning' as TagStatus,
    badge: 'DEGRADED',
  },
  {
    id: 'aud-2',
    time: '14:48 UTC',
    actor: 'key-legacy-migration',
    summary: 'Rejected DELETE /v2/customs/cache with revoked credential (401).',
    status: 'danger' as TagStatus,
    badge: 'BLOCKED',
  },
  {
    id: 'aud-3',
    time: '14:20 UTC',
    actor: 'svc-tax-quote',
    summary: 'Canary tariff schedule v2.4 promoted to 15% traffic weight.',
    status: 'info' as TagStatus,
    badge: 'CANARY',
  },
  {
    id: 'aud-4',
    time: '13:55 UTC',
    actor: 'svc-webhook-dispatch',
    summary: 'HMAC-SHA256 key rotation verified across 4 regional edge pop nodes.',
    status: 'success' as TagStatus,
    badge: 'VERIFIED',
  },
];

function statusToTagStatus(status: 'healthy' | 'degraded' | 'canary'): TagStatus {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  return 'info';
}

function statusToLabel(status: 'healthy' | 'degraded' | 'canary'): string {
  if (status === 'healthy') return 'HEALTHY';
  if (status === 'degraded') return 'DEGRADED';
  return 'CANARY';
}

function httpCodeToTagStatus(statusCode: number): TagStatus {
  if (statusCode >= 500) return 'danger';
  if (statusCode >= 400) return 'warning';
  return 'success';
}

function scopeToLabel(scope: ApiKeyScope): string {
  if (scope === 'admin') return 'ADMIN';
  if (scope === 'dispatch_write') return 'DISPATCH_WRITE';
  return 'READ_ONLY';
}

/** Scrolls a region into view only when it is off-screen, honouring reduced motion and `cut`. */
function revealIfOffscreen(el: HTMLElement, motion: MotionMode) {
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (rect.top >= 0 && rect.bottom <= viewportHeight) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  el.scrollIntoView({ block: 'start', behavior: reduce || motion === 'cut' ? 'auto' : 'smooth' });
}

function fmtCompactNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export interface DeveloperConsoleProps {
  defaultSection?: ConsoleSection;
  defaultDatasetState?: ConsoleDatasetState;
  defaultTimeRange?: ConsoleTimeRange;
  defaultEnvironment?: ConsoleEnvironment;
  /** Alias for `defaultSection`. */
  initialSection?: ConsoleSection;
  /** Alias for `defaultDatasetState`. */
  initialDatasetState?: ConsoleDatasetState;
  /** Alias for `defaultTimeRange`. */
  initialTimeRange?: ConsoleTimeRange;
  /** Alias for `defaultEnvironment`. */
  initialEnvironment?: ConsoleEnvironment;
  motion?: MotionMode;
  theme?: 'light' | 'dark';
  idPrefix?: string;
  showSandboxControls?: boolean;
  className?: string;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

const SLO_TARGET_MAX_ERROR_BPS = 50;

function DeveloperConsoleInner({
  defaultSection,
  defaultDatasetState,
  defaultTimeRange,
  defaultEnvironment,
  initialSection,
  initialDatasetState,
  initialTimeRange,
  initialEnvironment,
  motion = 'stepped',
  theme,
  idPrefix,
  showSandboxControls = true,
  className = '',
  headerSlot,
  footerSlot,
}: DeveloperConsoleProps) {
  const { toast } = useToast();
  const reactId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const resolvedIdPrefix = idPrefix ?? `f12-console-${reactId || 'instance'}`;

  // Top-level navigation, environment, time window, and dataset simulation state
  const [activeSection, setActiveSection] = React.useState<ConsoleSection>(
    defaultSection ?? initialSection ?? 'overview',
  );
  const [datasetState, setDatasetState] = React.useState<ConsoleDatasetState>(
    defaultDatasetState ?? initialDatasetState ?? 'populated',
  );
  const [timeRange, setTimeRange] = React.useState<ConsoleTimeRange>(
    defaultTimeRange ?? initialTimeRange ?? '24h',
  );
  const [environment, setEnvironment] = React.useState<ConsoleEnvironment>(
    defaultEnvironment ?? initialEnvironment ?? 'prod-us-east-1',
  );

  // Overview state: selected service for comparison overlay
  const [selectedServiceId, setSelectedServiceId] = React.useState<string>('svc-webhook-dispatch');

  // Services & Endpoints state
  const [endpointSearch, setEndpointSearch] = React.useState('');
  const [endpointHealthFilter, setEndpointHealthFilter] =
    React.useState<EndpointHealthFilter>('all');
  const [endpointMethodFilter, setEndpointMethodFilter] =
    React.useState<EndpointMethodFilter>('ALL');
  const [sheddingByService, setSheddingByService] = React.useState<Record<string, boolean>>({
    'svc-webhook-dispatch': false,
    'svc-checkout-session': false,
    'svc-inventory-ledger': true,
    'svc-tax-quote': false,
  });
  const [inspectedEndpointId, setInspectedEndpointId] = React.useState<string>(
    CONSOLE_ENDPOINTS[0].id,
  );

  // API Keys state
  const [apiKeys, setApiKeys] = React.useState<SimulatedApiKey[]>(INITIAL_API_KEYS);
  const [newKeyLabel, setNewKeyLabel] = React.useState('');
  const [newKeyScope, setNewKeyScope] = React.useState<ApiKeyScope>('dispatch_write');
  const [newKeyTier, setNewKeyTier] = React.useState('Burst · 2,000 req/s');
  const [newKeyHmac, setNewKeyHmac] = React.useState(true);
  const [keyLabelError, setKeyLabelError] = React.useState<string | undefined>(undefined);
  const [lastIssuedKey, setLastIssuedKey] = React.useState<SimulatedApiKey | null>(null);
  const [revokeTargetKey, setRevokeTargetKey] = React.useState<SimulatedApiKey | null>(null);
  const keyInputRef = React.useRef<HTMLInputElement | null>(null);
  const keySeqRef = React.useRef(1);

  // Request Logs state
  const [requestLogs, setRequestLogs] =
    React.useState<ConsoleRequestLogItem[]>(INITIAL_REQUEST_LOGS);
  const [logSearch, setLogSearch] = React.useState('');
  const [logStatusFilter, setLogStatusFilter] = React.useState<LogStatusFilter>('all');
  const [logServiceFilter, setLogServiceFilter] = React.useState<string>('all');
  const [logPage, setLogPage] = React.useState(1);
  const [inspectedLog, setInspectedLog] = React.useState<ConsoleRequestLogItem | null>(null);
  const lastInspectedLogIdRef = React.useRef<string | null>(null);
  const pendingFocusTargetIdRef = React.useRef<string | null>(null);
  // Set alongside a pending focus target when the move should also bring the section tabs into
  // view (breadcrumb navigation from the sheet header to the tab strip below the KPI scene).
  const pendingRevealMotionRef = React.useRef<MotionMode | null>(null);
  const replaySeqRef = React.useRef(1);

  const snapshot = CONSOLE_RANGE_SNAPSHOTS[timeRange];
  const rangeChanged = useChanged(timeRange);
  const isEmptyDataset = datasetState === 'empty';
  const sloWithinBudget = snapshot.errorRateBasisPoints <= SLO_TARGET_MAX_ERROR_BPS;

  const peakPoint = React.useMemo(
    () =>
      snapshot.series.reduce(
        (best, pt) => (pt.value > best.value ? pt : best),
        snapshot.series[0],
      ),
    [snapshot],
  );

  const rangeFooterMetrics = React.useMemo(() => {
    const peakWindowValue =
      snapshot.range === '24h'
        ? `${fmtCompactNumber(peakPoint.value)}k (${peakPoint.label} UTC)`
        : `${fmtCompactNumber(peakPoint.value)}k (${peakPoint.label})`;
    const peakChartNote =
      snapshot.range === '24h'
        ? `peak ${fmtCompactNumber(peakPoint.value)}k at ${peakPoint.label} UTC`
        : `peak ${fmtCompactNumber(peakPoint.value)}k on ${peakPoint.label}`;
    const deliveredPct = ((10000 - snapshot.errorRateBasisPoints) / 100).toFixed(2);
    const deliveredCount = snapshot.totalRequests - snapshot.errorCount;
    const deliveredCountLabel =
      deliveredCount >= 1_000_000
        ? `${(deliveredCount / 1_000_000).toFixed(2)}M`
        : `${(deliveredCount / 1_000).toFixed(1)}k`;
    const deliveredValue = `${deliveredPct}% · ${deliveredCountLabel}`;

    // Partition non-2xx responses into 5xx upstream faults and 4xx client/throttled (401/422/429)
    const errorBreakdown =
      snapshot.range === '24h'
        ? {
            upstream5xx: '0.11% · 1,631',
            client4xx: '0.31% · 4,597',
          }
        : snapshot.range === '7d'
          ? {
              upstream5xx: '0.14% · 13,776',
              client4xx: '0.37% · 36,409',
            }
          : {
              upstream5xx: '0.16% · 63,056',
              client4xx: '0.42% · 165,522',
            };

    return {
      peakWindowValue,
      peakChartNote,
      deliveredValue,
      ...errorBreakdown,
    };
  }, [snapshot, peakPoint]);

  const effectiveServices = React.useMemo<ConsoleServiceItem[]>(
    () =>
      CONSOLE_SERVICES.map((svc) =>
        isEmptyDataset
          ? {
              ...svc,
              requests24h: 0,
              share24h: 0,
              p95Ms: 0,
              errorRatePct: '0.00%',
            }
          : svc,
      ),
    [isEmptyDataset],
  );

  const selectedService =
    effectiveServices.find((s) => s.id === selectedServiceId) ?? effectiveServices[0];
  const degradedServices = effectiveServices.filter((s) => s.status === 'degraded');
  const primaryDegradedService = degradedServices[0] ?? effectiveServices[2];

  const chartData = React.useMemo<ToneAreaDatum[]>(() => {
    if (isEmptyDataset) return [];
    const compareValues = snapshot.serviceSeries[selectedService.id] ?? [];
    return snapshot.series.map((pt, idx) => ({
      ...pt,
      compareValue: compareValues[idx] ?? pt.compareValue,
    }));
  }, [isEmptyDataset, snapshot, selectedService.id]);

  const serviceBarItems = React.useMemo<ToneBarItem[]>(
    () =>
      effectiveServices.map((svc) => ({
        id: svc.id,
        name: `${svc.name} (${svc.code})`,
        value: svc.requests24h,
        formattedValue: isEmptyDataset
          ? `${fmtCompactNumber(svc.requests24h)} · ${svc.errorRatePct} err`
          : svc.status === 'degraded'
            ? `${fmtCompactNumber(svc.requests24h)} · ${svc.errorRatePct} err (!)`
            : svc.status === 'canary'
              ? `${fmtCompactNumber(svc.requests24h)} · ${svc.errorRatePct} err (~1%)`
              : `${fmtCompactNumber(svc.requests24h)} · ${svc.errorRatePct} err`,
        share: svc.share24h,
        pattern: svc.pattern,
      })),
    [effectiveServices, isEmptyDataset],
  );

  const effectiveEndpoints = React.useMemo<ConsoleEndpointItem[]>(
    () =>
      CONSOLE_ENDPOINTS.map((ep) =>
        isEmptyDataset
          ? {
              ...ep,
              requests24h: 0,
              p95Ms: 0,
              errorRatePct: '0.00%',
            }
          : ep,
      ),
    [isEmptyDataset],
  );

  // Filtered endpoints
  const filteredEndpoints = React.useMemo(() => {
    const q = endpointSearch.trim().toLowerCase();
    return effectiveEndpoints.filter((ep) => {
      if (endpointHealthFilter !== 'all' && ep.status !== endpointHealthFilter) return false;
      if (endpointMethodFilter !== 'ALL' && ep.method !== endpointMethodFilter) return false;
      if (!q) return true;
      return (
        ep.route.toLowerCase().includes(q) ||
        ep.serviceName.toLowerCase().includes(q) ||
        ep.owner.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q)
      );
    });
  }, [effectiveEndpoints, endpointSearch, endpointHealthFilter, endpointMethodFilter]);

  const inspectedEndpoint =
    effectiveEndpoints.find((ep) => ep.id === inspectedEndpointId) ??
    filteredEndpoints[0] ??
    effectiveEndpoints[0];

  const effectiveRequestLogs = React.useMemo<ConsoleRequestLogItem[]>(
    () => (isEmptyDataset ? [] : requestLogs),
    [isEmptyDataset, requestLogs],
  );

  // Filtered & paginated request logs
  const filteredLogs = React.useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return effectiveRequestLogs.filter((item) => {
      if (logStatusFilter !== 'all' && item.statusClass !== logStatusFilter) return false;
      if (logServiceFilter !== 'all' && item.serviceId !== logServiceFilter) return false;
      if (!q) return true;
      return (
        item.requestId.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q) ||
        item.idempotencyKey.toLowerCase().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        String(item.statusCode).includes(q)
      );
    });
  }, [effectiveRequestLogs, logSearch, logStatusFilter, logServiceFilter]);

  const LOGS_PER_PAGE = 5;
  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const safeLogPage = Math.min(logPage, totalLogPages);
  const pagedLogs = React.useMemo(() => {
    const start = (safeLogPage - 1) * LOGS_PER_PAGE;
    return filteredLogs.slice(start, start + LOGS_PER_PAGE);
  }, [filteredLogs, safeLogPage]);

  const activeKeyCount = apiKeys.filter((k) => k.status === 'active').length;

  const sectionLabels: Record<ConsoleSection, string> = {
    overview: 'Overview',
    services: 'Services & Endpoints',
    'api-keys': 'API Keys',
    'request-logs': 'Request Logs',
  };

  const envLabel =
    environment === 'prod-us-east-1' ? 'Production (us-east-1)' : 'Staging (eu-central-1)';

  const handleResetSandbox = () => {
    pendingFocusTargetIdRef.current = null;
    setDatasetState('populated');
    setTimeRange('24h');
    setEnvironment('prod-us-east-1');
    setSelectedServiceId('svc-webhook-dispatch');
    setEndpointSearch('');
    setEndpointHealthFilter('all');
    setEndpointMethodFilter('ALL');
    setInspectedEndpointId(CONSOLE_ENDPOINTS[0].id);
    setSheddingByService({
      'svc-webhook-dispatch': false,
      'svc-checkout-session': false,
      'svc-inventory-ledger': true,
      'svc-tax-quote': false,
    });
    setApiKeys(INITIAL_API_KEYS);
    setNewKeyLabel('');
    setNewKeyScope('dispatch_write');
    setNewKeyTier('Burst · 2,000 req/s');
    setNewKeyHmac(true);
    setKeyLabelError(undefined);
    setLastIssuedKey(null);
    setRevokeTargetKey(null);
    setRequestLogs(INITIAL_REQUEST_LOGS);
    setLogSearch('');
    setLogStatusFilter('all');
    setLogServiceFilter('all');
    setLogPage(1);
    setInspectedLog(null);
    window.requestAnimationFrame(() => {
      document.getElementById(`${resolvedIdPrefix}-reset-sandbox`)?.focus();
    });
    toast({
      status: 'info',
      title: 'Sandbox fixtures reset',
      description: 'Restored initial deterministic API keys, endpoints, and request logs.',
    });
  };

  const handleToggleShedding = (svc: ConsoleServiceItem, nextChecked: boolean) => {
    setSheddingByService((prev) => ({ ...prev, [svc.id]: nextChecked }));
    toast({
      status: nextChecked ? 'warning' : 'success',
      title: `${svc.name}: ${nextChecked ? 'Queue shedding enabled' : 'Normal routing restored'}`,
      description: `Simulated circuit-breaker state updated in local memory (${svc.code}).`,
    });
  };

  const handleIssueApiKey = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newKeyLabel.trim();
    if (trimmed.length < 3) {
      setKeyLabelError('Enter a descriptive key label of at least 3 characters.');
      keyInputRef.current?.focus();
      return;
    }
    if (trimmed.length > 40) {
      setKeyLabelError('Key label must be 40 characters or fewer.');
      keyInputRef.current?.focus();
      return;
    }
    const duplicate = apiKeys.some(
      (k) => k.status === 'active' && k.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setKeyLabelError('An active simulated key with this label already exists.');
      keyInputRef.current?.focus();
      return;
    }

    keySeqRef.current += 1;
    const suffix = String(4100 + keySeqRef.current * 37).slice(-4);
    const scopeSegment =
      newKeyScope === 'admin' ? 'admin' : newKeyScope === 'dispatch_write' ? 'live' : 'read';
    const created: SimulatedApiKey = {
      id: `key-sim-${keySeqRef.current}`,
      label: trimmed,
      maskedToken: `f12_sim_${scopeSegment}_••••_${suffix}`,
      scope: newKeyScope,
      rateTier: newKeyTier,
      requireHmac: newKeyHmac,
      createdAt: '2026-10-31',
      lastUsed: 'Never (just issued)',
      status: 'active',
    };

    setApiKeys((prev) => [created, ...prev]);
    setNewKeyLabel('');
    setKeyLabelError(undefined);
    setLastIssuedKey(created);
    toast({
      status: 'success',
      title: 'Simulated API key issued',
      description: `Created ${created.maskedToken} (${scopeToLabel(created.scope)}) in browser memory.`,
    });
  };

  const handleConfirmRevokeKey = () => {
    if (!revokeTargetKey) return;
    const target = revokeTargetKey;
    setApiKeys((prev) =>
      prev.map((k) => (k.id === target.id ? { ...k, status: 'revoked' } : k)),
    );
    if (lastIssuedKey?.id === target.id) {
      setLastIssuedKey(null);
    }
    setRevokeTargetKey(null);
    toast({
      status: 'warning',
      title: 'Simulated API key revoked',
      description: `${target.label} (${target.maskedToken}) marked REVOKED in local state.`,
    });
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(`${resolvedIdPrefix}-copy-key-${target.id}`)?.focus();
      });
    }
  };

  const handleReplayRequest = (logItem: ConsoleRequestLogItem) => {
    replaySeqRef.current += 1;
    const replayId = `req_01J9Z9RPL${replaySeqRef.current}`;
    const associatedKey = apiKeys.find((k) => k.id === logItem.apiKeyId);
    const isKeyRevoked = !associatedKey || associatedKey.status === 'revoked';
    const statusCode = isKeyRevoked ? 401 : logItem.method === 'POST' ? 202 : 200;
    const statusClass: ConsoleRequestLogItem['statusClass'] = isKeyRevoked ? '4xx' : '2xx';
    const durationMs = isKeyRevoked ? 7 : 21;
    const replayedEntry: ConsoleRequestLogItem = {
      ...logItem,
      id: `log-replay-${replaySeqRef.current}`,
      requestId: replayId,
      timestamp: '15:00:04 UTC',
      statusCode,
      statusClass,
      durationMs,
      tlsMs: 3,
      queueMs: isKeyRevoked ? 1 : 3,
      upstreamMs: isKeyRevoked ? 3 : 15,
      responsePayload: isKeyRevoked
        ? `{"replayedFrom":"${logItem.requestId}","error":"revoked_api_key","message":"Credential ${logItem.apiKeyId} was revoked; replay rejected at edge."}`
        : `{"replayedFrom":"${logItem.requestId}","status":"accepted","simulated":true}`,
      replayed: true,
    };
    setRequestLogs((prev) => [replayedEntry, ...prev]);
    setInspectedLog(replayedEntry);
    setLogPage(1);
    if (datasetState === 'empty') {
      setDatasetState('populated');
    }
    toast({
      status: isKeyRevoked ? 'danger' : 'success',
      title: isKeyRevoked
        ? `Replay rejected (${logItem.requestId})`
        : `Replayed ${logItem.requestId}`,
      description: isKeyRevoked
        ? `Recorded simulated replay ${replayId} (401 Unauthorized · revoked credential ${logItem.apiKeyId}).`
        : `Recorded simulated replay ${replayId} (${replayedEntry.statusCode} OK · 21 ms).`,
    });
  };

  React.useEffect(() => {
    if (inspectedLog) {
      lastInspectedLogIdRef.current = inspectedLog.id;
      return;
    }
    const closingLogId = lastInspectedLogIdRef.current;
    if (!closingLogId || typeof document === 'undefined') return;
    lastInspectedLogIdRef.current = null;

    const restore = () => {
      const targetBtn = document.getElementById(
        `${resolvedIdPrefix}-inspect-log-${closingLogId}`,
      );
      const active = document.activeElement;
      const focusLost =
        !active ||
        active === document.body ||
        active === document.documentElement ||
        !active.isConnected;
      if (targetBtn && (focusLost || closingLogId.startsWith('log-replay-'))) {
        targetBtn.focus({ preventScroll: true });
        return;
      }
      if (focusLost) {
        document.getElementById(`${resolvedIdPrefix}-log-search`)?.focus({ preventScroll: true });
      }
    };
    restore();
    const raf = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(raf);
  }, [inspectedLog, resolvedIdPrefix]);

  React.useEffect(() => {
    const targetId = pendingFocusTargetIdRef.current;
    const revealMotion = pendingRevealMotionRef.current;
    pendingRevealMotionRef.current = null;
    if (!targetId || typeof document === 'undefined') return;
    pendingFocusTargetIdRef.current = null;
    const applyFocus = () => {
      const el =
        document.getElementById(targetId) ??
        document.getElementById(`${resolvedIdPrefix}-tab-${activeSection}`);
      el?.focus({ preventScroll: true });
    };
    applyFocus();
    const raf = window.requestAnimationFrame(() => {
      applyFocus();
      const el = document.getElementById(targetId);
      if (revealMotion && el) {
        revealIfOffscreen(el.closest<HTMLElement>('[role="tablist"]') ?? el, revealMotion);
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [
    activeSection,
    datasetState,
    endpointSearch,
    endpointHealthFilter,
    endpointMethodFilter,
    logSearch,
    logStatusFilter,
    logServiceFilter,
    selectedServiceId,
    resolvedIdPrefix,
  ]);

  return (
    <Sheet
      id={`${resolvedIdPrefix}-sheet`}
      autoCut
      pegs
      motion={motion}
      theme={theme}
      className={['f12-console', className].filter(Boolean).join(' ')}
    >
      {/* Top Header & Breadcrumb */}
      <header className="f12-hd">
        <div className="f12-hd-text">
          <Breadcrumb
            aria-label="Console hierarchy"
            density="compact"
            items={[
              // Org root: context text — no org-level view exists inside this block.
              { label: 'Fernwood Relay' },
              {
                // Environment level → its landing section (Overview). Only actionable when it
                // would change the view.
                label: envLabel,
                onSelect:
                  activeSection !== 'overview'
                    ? () => {
                        const targetId = `${resolvedIdPrefix}-tab-overview`;
                        // Move focus before this button unmounts (it turns back into text at the
                        // landing section) so Firefox carries :focus-visible over for keyboard use.
                        document.getElementById(targetId)?.focus({ preventScroll: true });
                        pendingFocusTargetIdRef.current = targetId;
                        pendingRevealMotionRef.current = motion;
                        setActiveSection('overview');
                      }
                    : undefined,
              },
              {
                label: sectionLabels[activeSection],
                current: true,
              },
            ]}
          />
          <p className="f12-eyebrow">
            <span>API &amp; WEBHOOK CONTROL PLANE</span>
            <Tag>v2.4</Tag>
            <Badge status="info" burst={false}>
              SIMULATED LOCAL FIXTURES
            </Badge>
          </p>
          <h1 className="f12-title">Developer Console</h1>
          <p className="f12-sub">
            {snapshot.windowNote} · Simulated credentials (f12_sim_*), circuit breakers, and replays
            execute against deterministic in-memory fixtures.
          </p>
        </div>

        <div className="f12-stack-pair">
          <div
            className="f12-console-toolbar f12-console-hd-toolbar"
            role="group"
            aria-label="Environment and time window"
          >
            <Select
              id={`${resolvedIdPrefix}-env-select`}
              label="Simulated Environment"
              value={environment}
              onValueChange={(v) => setEnvironment(v as ConsoleEnvironment)}
            >
              <SelectTrigger aria-label="Target environment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prod-us-east-1">Production · us-east-1</SelectItem>
                <SelectItem value="staging-eu-central-1">Staging · eu-central-1</SelectItem>
              </SelectContent>
            </Select>

            <SegmentedControl
              idPrefix={`${resolvedIdPrefix}-range`}
              ariaLabel="Telemetry time window"
              value={timeRange}
              onChange={setTimeRange}
              options={[
                { value: '24h', label: '24', unit: 'hrs' },
                { value: '7d', label: '7', unit: 'days' },
                { value: '30d', label: '30', unit: 'days' },
              ]}
            />
          </div>

          {showSandboxControls ? (
            <div
              className="f12-row-pair"
              role="group"
              aria-label="Sandbox dataset state and simulation controls"
            >
              <SegmentedControl
                idPrefix={`${resolvedIdPrefix}-dataset-state`}
                ariaLabel="Dataset simulation state"
                value={datasetState}
                onChange={setDatasetState}
                options={[
                  { value: 'populated', label: 'LIVE', unit: 'fixture' },
                  { value: 'loading', label: 'LOAD', unit: 'skel' },
                  { value: 'empty', label: 'ZERO', unit: 'empty' },
                  { value: 'error', label: 'ERR', unit: '503' },
                ]}
              />
              <Button
                id={`${resolvedIdPrefix}-reset-sandbox`}
                variant="secondary"
                size="sm"
                onClick={handleResetSandbox}
              >
                Reset sandbox
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      {headerSlot}

      {/* Scene 1: Expressive Establishing Shot KPI Panels (C-01, C-02, C-03) */}
      <Scene
        gutter="scene"
        layout="three"
        className="f12-console-kpi-scene"
        aria-busy={datasetState === 'loading'}
      >
        <Panel label="Gateway request volume">
          {datasetState === 'loading' ? (
            <div className="f12-stack-pair" data-testid="console-kpi-skeleton">
              <Skeleton variant="line" width="55%" label="Loading request volume label" />
              <Skeleton variant="metric" width="75%" />
              <SkeletonText lines={2} />
            </div>
          ) : (
            <div className="f12-console-kpi-card">
              <div className="f12-row-between">
                <Tag>THROUGHPUT</Tag>
                <span className="f12-mono-note">{snapshot.windowNote}</span>
              </div>
              <Metric
                big
                headingLevel="h2"
                label="Gateway Request Volume"
                value={isEmptyDataset ? 0 : snapshot.totalRequests}
                format={fmtCompactNumber}
                motion={motion}
                delta={isEmptyDataset ? 0 : snapshot.requestDeltaPct}
                deltaKind="pct"
                comparisonLabel={
                  isEmptyDataset ? 'awaiting first dispatch' : snapshot.requestDeltaNote
                }
              />
              <div className="f12-console-kv-list f12-console-kpi-foot">
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">Peak Interval</span>
                  <span className="f12-console-kv-value">
                    {isEmptyDataset ? '0 reqs' : rangeFooterMetrics.peakWindowValue}
                  </span>
                </div>
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">2xx Delivered</span>
                  <span className="f12-console-kv-value">
                    {isEmptyDataset ? '0.00% · 0' : rangeFooterMetrics.deliveredValue}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel label="Gateway error rate and status">
          {datasetState === 'loading' ? (
            <div className="f12-stack-pair">
              <Skeleton variant="line" width="50%" label="Loading error rate label" />
              <Skeleton variant="metric" width="65%" />
              <SkeletonText lines={2} />
            </div>
          ) : (
            <div className="f12-console-kpi-card">
              <div className="f12-row-between">
                <Tag
                  id={`${resolvedIdPrefix}-slo-status-tag`}
                  status={
                    datasetState === 'error'
                      ? 'danger'
                      : isEmptyDataset
                        ? 'neutral'
                        : sloWithinBudget
                          ? 'success'
                          : 'warning'
                  }
                >
                  {datasetState === 'error'
                    ? 'COLLECTOR 503'
                    : isEmptyDataset
                      ? 'IDLE'
                      : sloWithinBudget
                        ? 'GATEWAY SLO: HEALTHY'
                        : 'GATEWAY SLO: BREACHED'}
                </Tag>
                <span className="f12-mono-note">0.50% non-2xx limit</span>
              </div>
              <Metric
                big
                headingLevel="h2"
                label="Error & Throttle Rate"
                value={isEmptyDataset ? 0 : snapshot.errorRateBasisPoints}
                format={(n) => `${(n / 100).toFixed(2)}%`}
                motion={motion}
                delta={isEmptyDataset ? 0 : snapshot.errorDeltaPp}
                deltaKind="pp"
                comparisonLabel={
                  isEmptyDataset ? 'no failed requests' : snapshot.errorDeltaNote
                }
              />
              <div className="f12-console-kv-list f12-console-kpi-foot">
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">5xx Upstream Faults</span>
                  <span className="f12-console-kv-value">
                    {isEmptyDataset ? '0 (0.00%)' : rangeFooterMetrics.upstream5xx}
                  </span>
                </div>
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">4xx Client &amp; Throttled</span>
                  <span className="f12-console-kv-value">
                    {isEmptyDataset ? '0 (0.00%)' : rangeFooterMetrics.client4xx}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel label="Gateway p95 latency">
          {datasetState === 'loading' ? (
            <div className="f12-stack-pair">
              <Skeleton variant="line" width="52%" label="Loading p95 latency label" />
              <Skeleton variant="metric" width="60%" />
              <Skeleton variant="block" height={74} />
            </div>
          ) : (
            <div className="f12-console-kpi-card">
              <div className="f12-row-between">
                <Tag status="info">EDGE P95</Tag>
                <span className="f12-mono-note">Budget &lt; 65 ms</span>
              </div>
              <Metric
                big
                headingLevel="h2"
                label="p95 Edge Latency"
                value={isEmptyDataset ? 0 : snapshot.p95LatencyMs}
                format={(n) => `${Math.round(n)} ms`}
                motion={motion}
                delta={isEmptyDataset ? 0 : snapshot.latencyDeltaPct}
                deltaKind="pct"
                comparisonLabel={
                  isEmptyDataset ? 'no latency samples' : snapshot.latencyDeltaNote
                }
              />
              {datasetState === 'populated' && (
                <div className="f12-console-kpi-spark">
                  <ToneSpark
                    values={snapshot.latencySpark}
                    label={`${snapshot.label} p95 trend (window ${snapshot.p95LatencyMs} ms)`}
                    rangeKey={snapshot.range}
                    motion={motion}
                  />
                </div>
              )}
            </div>
          )}
        </Panel>
      </Scene>

      {/* Dataset-level Error / Empty states */}
      {datasetState === 'error' && (
        <Alert
          id={`${resolvedIdPrefix}-error-banner`}
          status="danger"
          live="polite"
          title="Upstream telemetry aggregator timeout (ERR_RELAY_UPSTREAM_503)"
          description="Simulated telemetry collector in us-east-1 did not respond within 2,500ms. Cached control-plane configuration remains available below."
          actions={
            <Button
              id={`${resolvedIdPrefix}-retry-telemetry`}
              variant="secondary"
              size="sm"
              onClick={() => {
                pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-dataset-state-populated`;
                setDatasetState('populated');
                toast({
                  status: 'success',
                  title: 'Telemetry stream restored',
                  description: 'Reconnected to simulated us-east-1 collector checkpoint.',
                });
              }}
            >
              Retry telemetry sync
            </Button>
          }
        />
      )}

      {isEmptyDataset && (
        <EmptyState
          id={`${resolvedIdPrefix}-empty-workspace`}
          code="0 TELEMETRY EVENTS"
          title="No API requests recorded in this sandbox window"
          description="This workspace has not dispatched any webhook or checkout session requests in the selected window. This state is expected for newly provisioned sandboxes prior to first key issuance."
          action={
            <Button
              id={`${resolvedIdPrefix}-load-sample-btn`}
              variant="primary"
              size="sm"
              onClick={() => {
                pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-dataset-state-populated`;
                setDatasetState('populated');
                toast({
                  status: 'success',
                  title: 'Sample telemetry loaded',
                  description: 'Populated 1.48M simulated requests across 4 services.',
                });
              }}
            >
              Load sample data
            </Button>
          }
          secondaryAction={
            <Button
              id={`${resolvedIdPrefix}-empty-issue-key-btn`}
              variant="secondary"
              size="sm"
              onClick={() => {
                pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-key-label-input`;
                setDatasetState('populated');
                setActiveSection('api-keys');
              }}
            >
              Issue simulated API key
            </Button>
          }
        />
      )}

      {/* Scene 2: Four Main Console Experiences */}
      <Tabs
        value={activeSection}
        onValueChange={(next) => setActiveSection(next as ConsoleSection)}
      >
        <TabsList aria-label="Developer console sections">
          <TabsTrigger value="overview" id={`${resolvedIdPrefix}-tab-overview`}>
            01 · Overview
          </TabsTrigger>
          <TabsTrigger value="services" id={`${resolvedIdPrefix}-tab-services`}>
            02 · Services &amp; Endpoints
          </TabsTrigger>
          <TabsTrigger value="api-keys" id={`${resolvedIdPrefix}-tab-api-keys`}>
            03 · API Keys ({activeKeyCount})
          </TabsTrigger>
          <TabsTrigger value="request-logs" id={`${resolvedIdPrefix}-tab-request-logs`}>
            04 · Request Logs ({effectiveRequestLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* =============================================================== TAB 1: OVERVIEW */}
        <TabsContent value="overview">
          <div className="f12-stack-scene">
            <Scene gutter="scene" layout="equal" className="f12-console-overview-scene">
              <Panel
                variant="expressive"
                label="Primary request throughput and service overlay"
              >
                {datasetState === 'loading' ? (
                  <div className="f12-stack-pair">
                    <Skeleton variant="line" width="45%" />
                    <Skeleton variant="block" height={240} />
                    <SkeletonText lines={2} />
                  </div>
                ) : (
                  <div className="f12-stack-pair">
                    <div className="f12-row-between">
                      <div className="f12-row-pair">
                        <Tag>REQUEST TRAFFIC (K)</Tag>
                        <Badge status="neutral" burst={false}>
                          {`OVERLAY: ${selectedService.code}`}
                        </Badge>
                      </div>
                      <span className="f12-console-kbd-hint">
                        <kbd>←</kbd> <kbd>→</kbd> Inspect intervals
                      </span>
                    </div>
                    <h2 className="f12-section-title">
                      Gateway Throughput &amp; Selected Service
                    </h2>

                    <p className="f12-console-quiet-sub">
                      {isEmptyDataset ? (
                        <>
                          {`No throughput samples recorded in the selected ${snapshot.label.toLowerCase()} window · Selected overlay = `}
                          <strong>{selectedService.name}</strong> ({selectedService.code}).
                        </>
                      ) : (
                        <>
                          {`Shaded area = Total gateway traffic (${rangeFooterMetrics.peakChartNote}) · Dashed line = `}
                          <strong>{selectedService.name}</strong> ({selectedService.code}).
                        </>
                      )}
                    </p>

                    {isEmptyDataset ? (
                      <EmptyState
                        id={`${resolvedIdPrefix}-chart-empty`}
                        density="compact"
                        code="0 THROUGHPUT SAMPLES"
                        title="No throughput intervals recorded in this window"
                        description="Load sample telemetry or dispatch a simulated request to populate the exposure curve and tabular breakdown."
                      />
                    ) : (
                      <>
                        <ToneAreaChart
                          data={chartData}
                          motion={motion}
                          ariaLabel={`Gateway request throughput over ${snapshot.label} with ${selectedService.name} comparison series`}
                          tableSummary="View tabular throughput and service overlay data"
                          seriesLabel={`Total Gateway (${snapshot.label})`}
                          compareLabel={`${selectedService.name} (${selectedService.code})`}
                          formatValue={(v) => `${fmtCompactNumber(v)}k reqs`}
                        />
                        <div
                          className="f12-console-kv-list"
                          aria-label="Throughput window summary"
                        >
                          <div className="f12-console-kv-item">
                            <span className="f12-console-kv-label">Sampling Resolution</span>
                            <span className="f12-console-kv-value">
                              {`${chartData.length} intervals · ${snapshot.label}`}
                            </span>
                          </div>
                          <div className="f12-console-kv-item">
                            <span className="f12-console-kv-label">Overlay Series</span>
                            <span className="f12-console-kv-value">
                              {`${selectedService.code} · ${Math.round(selectedService.share24h * 100)}% share (${selectedService.errorRatePct} err)`}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Panel>

              <Panel
                variant="quiet"
                label="Ranked service traffic and error status"
              >
                {datasetState === 'loading' ? (
                  <div className="f12-stack-pair">
                    <Skeleton variant="line" width="60%" />
                    <Skeleton variant="block" height={180} />
                    <SkeletonText lines={3} />
                  </div>
                ) : (
                  <div className="f12-stack-pair">
                    <div className="f12-row-between">
                      <span className="f12-console-quiet-title">
                        SERVICE TRAFFIC &amp; HEALTH (1.00% LIMIT)
                      </span>
                      <Badge status={isEmptyDataset ? 'neutral' : 'warning'} burst={false}>
                        {isEmptyDataset
                          ? '0 SAMPLES · IDLE'
                          : `${degradedServices.length} OF ${effectiveServices.length} DEGRADED · 1 NEAR LIMIT`}
                      </Badge>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Select any service row to overlay its traffic on the gateway chart. Service
                      error limit is 1.00% (vs. 0.50% gateway-wide limit).
                    </p>

                    <ToneBarList
                      idPrefix={`${resolvedIdPrefix}-svc-bar`}
                      density="compact"
                      title="24h Traffic & Error Rate by Service"
                      subtitle={
                        isEmptyDataset ? 'Total 0 requests' : 'Total 1,482,900 requests'
                      }
                      items={serviceBarItems}
                      changed={rangeChanged}
                      selectedId={selectedService.id}
                      onSelect={(id) => {
                        if (id) setSelectedServiceId(id);
                      }}
                    />

                    <div className="f12-console-kv-list" aria-label="Selected service telemetry">
                      <div className="f12-console-kv-item">
                        <span className="f12-console-kv-label">{`Selected Service (${selectedService.code})`}</span>
                        <span className="f12-console-kv-value">{selectedService.name}</span>
                      </div>
                      <div className="f12-console-kv-item">
                        <span className="f12-console-kv-label">
                          Service Health (1.00% Limit)
                        </span>
                        <span className="f12-console-kv-value">
                          {isEmptyDataset
                            ? `${selectedService.p95Ms} ms · ${selectedService.errorRatePct} (NO SAMPLES)`
                            : selectedService.status === 'degraded'
                              ? `${selectedService.p95Ms} ms · ${selectedService.errorRatePct} (DEGRADED > 1.0%)`
                              : selectedService.status === 'canary'
                                ? `${selectedService.p95Ms} ms · ${selectedService.errorRatePct} (NEAR LIMIT · CANARY)`
                                : `${selectedService.p95Ms} ms · ${selectedService.errorRatePct} (HEALTHY)`}
                        </span>
                      </div>
                    </div>

                    <div
                      className="f12-console-investigate-bar"
                      role="group"
                      aria-label="Service investigation actions"
                    >
                      <p className="f12-mono-note">{selectedService.summary}</p>
                      <div className="f12-row-pair">
                        {!isEmptyDataset && selectedService.id !== primaryDegradedService.id && (
                          <Button
                            id={`${resolvedIdPrefix}-focus-degraded-svc`}
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const targetId = `int-${resolvedIdPrefix}-svc-bar-${primaryDegradedService.id}`;
                              document
                                .getElementById(targetId)
                                ?.focus({ preventScroll: true });
                              pendingFocusTargetIdRef.current = targetId;
                              setSelectedServiceId(primaryDegradedService.id);
                            }}
                          >
                            {`Overlay ${primaryDegradedService.code} (${primaryDegradedService.errorRatePct} err)`}
                          </Button>
                        )}
                        <Button
                          id={`${resolvedIdPrefix}-investigate-svc-logs`}
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setLogServiceFilter(selectedService.id);
                            setLogStatusFilter('all');
                            setLogSearch('');
                            setLogPage(1);
                            pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-log-search`;
                            setActiveSection('request-logs');
                          }}
                        >
                          {`Inspect ${selectedService.code} logs →`}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            </Scene>

            {/* Quiet Operational Audit Feed at bottom of Overview */}
            <Panel variant="quiet" label="Recent control-plane audit activity">
              <div className="f12-stack-pair">
                <div className="f12-row-between">
                  <div className="f12-row-pair">
                    <span className="f12-console-quiet-title">
                      RECENT CONTROL-PLANE AUDIT LOG
                    </span>
                    <Badge status="neutral" burst={false}>
                      LAST 4 EVENTS
                    </Badge>
                  </div>
                  <Button
                    id={`${resolvedIdPrefix}-overview-goto-logs`}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-log-search`;
                      setActiveSection('request-logs');
                    }}
                  >
                    Inspect request logs →
                  </Button>
                </div>

                <ul className="f12-console-feed" aria-label="Recent control-plane events">
                  {AUDIT_FEED.map((ev) => (
                    <li key={ev.id} className="f12-console-feed-item">
                      <div className="f12-row-pair">
                        <Tag status={ev.status}>{ev.badge}</Tag>
                        <code className="f12-code-inline">{ev.actor}</code>
                        <span>{ev.summary}</span>
                      </div>
                      <span className="f12-mono-note">{ev.time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* =============================================================== TAB 2: SERVICES & ENDPOINTS */}
        <TabsContent value="services">
          <div className="f12-stack-scene">
            {/* Service Health & Circuit-Breaker Matrix (Quiet) */}
            <Panel variant="quiet" label="Service health and simulated circuit breakers">
              <div className="f12-stack-pair">
                <div className="f12-row-between">
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <span className="f12-console-quiet-title">
                        SERVICE FLEET &amp; CIRCUIT-BREAKER CONTROLS
                      </span>
                      <Tag status="neutral">QUIET OPERATIONAL VIEW</Tag>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Toggle simulated queue shedding per service to test degraded-state operational
                      handling without affecting external infrastructure.
                    </p>
                  </div>
                </div>

                <div className="f12-console-grid-2">
                  {effectiveServices.map((svc) => {
                    const shedding = Boolean(sheddingByService[svc.id]);
                    const effectiveStatus = shedding ? 'degraded' : svc.status;
                    return (
                      <div key={svc.id} className="f12-console-kv-item">
                        <div className="f12-row-between">
                          <div className="f12-row-pair">
                            <code className="f12-code-inline">{svc.code}</code>
                            <strong>{svc.name}</strong>
                          </div>
                          <Tag status={statusToTagStatus(effectiveStatus)}>
                            {shedding ? 'SHEDDING' : statusToLabel(effectiveStatus)}
                          </Tag>
                        </div>
                        <p className="f12-mono-note">
                          {`Owner: ${svc.owner} · 24h: ${fmtCompactNumber(svc.requests24h)} reqs · p95: ${svc.p95Ms} ms · Err: ${svc.errorRatePct}`}
                        </p>
                        <Switch
                          id={`${resolvedIdPrefix}-shed-${svc.id}`}
                          density="compact"
                          checked={shedding}
                          onCheckedChange={(next) => handleToggleShedding(svc, next)}
                          label={`Queue shedding (${svc.code})`}
                          hint={svc.summary}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>

            {/* Endpoint Search & Filter Controls (Quiet) */}
            <Panel variant="quiet" label="Endpoint directory filters and table">
              <div className="f12-stack-scene">
                <div className="f12-console-filters" role="search" aria-label="Filter endpoints">
                  <Input
                    id={`${resolvedIdPrefix}-endpoint-search`}
                    label="Search endpoints"
                    density="compact"
                    type="search"
                    placeholder="Filter by route (/v2/...), service, or owner"
                    value={endpointSearch}
                    onChange={(e) => setEndpointSearch(e.target.value)}
                  />

                  <Select
                    id={`${resolvedIdPrefix}-endpoint-method`}
                    label="HTTP method"
                    density="compact"
                    value={endpointMethodFilter}
                    onValueChange={(v) => setEndpointMethodFilter(v as EndpointMethodFilter)}
                  >
                    <SelectTrigger aria-label="HTTP method filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All HTTP methods</SelectItem>
                      <SelectItem value="POST">POST only</SelectItem>
                      <SelectItem value="GET">GET only</SelectItem>
                      <SelectItem value="PUT">PUT only</SelectItem>
                      <SelectItem value="DELETE">DELETE only</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="f12-stack-pair">
                    <span className="f12-console-kv-label">Health status</span>
                    <SegmentedControl
                      idPrefix={`${resolvedIdPrefix}-ep-health`}
                      ariaLabel="Endpoint health status filter"
                      value={endpointHealthFilter}
                      onChange={setEndpointHealthFilter}
                      options={[
                        { value: 'all', label: 'ALL', unit: '8' },
                        { value: 'healthy', label: 'OK', unit: '6' },
                        { value: 'degraded', label: 'DEG', unit: '1' },
                        { value: 'canary', label: 'CAN', unit: '1' },
                      ]}
                    />
                  </div>
                </div>

                {filteredEndpoints.length === 0 ? (
                  <EmptyState
                    id={`${resolvedIdPrefix}-endpoints-empty`}
                    density="compact"
                    code="0 MATCHING ENDPOINTS"
                    title="No endpoints match the current filter criteria"
                    description={`No registered routes matched query "${endpointSearch || '—'}" with method ${endpointMethodFilter} and status ${endpointHealthFilter.toUpperCase()}.`}
                    action={
                      <Button
                        id={`${resolvedIdPrefix}-reset-endpoint-filters`}
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-endpoint-search`;
                          setEndpointSearch('');
                          setEndpointHealthFilter('all');
                          setEndpointMethodFilter('ALL');
                        }}
                      >
                        Reset endpoint filters
                      </Button>
                    }
                  />
                ) : (
                  <Table density="compact">
                    <TableCaption>
                      {`Showing ${filteredEndpoints.length} of ${effectiveEndpoints.length} registered API endpoints (24h volume reconciled to ${isEmptyDataset ? '0' : '1,482,900'} requests).`}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Method &amp; Route</TableHead>
                        <TableHead scope="col">Service &amp; Owner</TableHead>
                        <TableHead scope="col">Rate Limit</TableHead>
                        <TableHead scope="col">24h Volume</TableHead>
                        <TableHead scope="col">p95 / Error</TableHead>
                        <TableHead scope="col">Status</TableHead>
                        <TableHead scope="col">Contract</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEndpoints.map((ep) => {
                        const isSelected = ep.id === inspectedEndpoint.id;
                        return (
                          <TableRow key={ep.id}>
                            <TableCell>
                              <div className="f12-row-pair">
                                <Tag
                                  status={
                                    ep.method === 'DELETE'
                                      ? 'danger'
                                      : ep.method === 'PUT'
                                        ? 'warning'
                                        : ep.method === 'POST'
                                          ? 'info'
                                          : 'neutral'
                                  }
                                >
                                  {ep.method}
                                </Tag>
                                <code className="f12-code-inline f12-nowrap">{ep.route}</code>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="f12-stack-pair">
                                <strong>{ep.serviceName}</strong>
                                <span className="f12-mono-note">{ep.owner}</span>
                              </div>
                            </TableCell>
                            <TableCell>{`${fmtCompactNumber(ep.rateLimitRps)} req/s`}</TableCell>
                            <TableCell>{fmtCompactNumber(ep.requests24h)}</TableCell>
                            <TableCell>{`${ep.p95Ms} ms · ${ep.errorRatePct}`}</TableCell>
                            <TableCell>
                              <Tag status={statusToTagStatus(ep.status)}>
                                {statusToLabel(ep.status)}
                              </Tag>
                            </TableCell>
                            <TableCell>
                              <Button
                                id={`${resolvedIdPrefix}-inspect-ep-${ep.id}`}
                                variant={isSelected ? 'primary' : 'secondary'}
                                size="sm"
                                aria-pressed={isSelected}
                                onClick={() => setInspectedEndpointId(ep.id)}
                              >
                                {isSelected ? 'Selected' : 'Inspect'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}

                {/* Selected Endpoint Metadata Inspector */}
                <div
                  className="f12-console-kv-list"
                  role="region"
                  aria-label="Selected endpoint contract metadata"
                >
                  <div className="f12-console-kv-item">
                    <span className="f12-console-kv-label">Selected Endpoint</span>
                    <span className="f12-console-kv-value">
                      {`${inspectedEndpoint.method} ${inspectedEndpoint.route}`}
                    </span>
                    <span className="f12-mono-note">{inspectedEndpoint.description}</span>
                  </div>
                  <div className="f12-console-kv-item">
                    <span className="f12-console-kv-label">Schema &amp; Timeout Budget</span>
                    <span className="f12-console-kv-value">
                      {`${inspectedEndpoint.schemaVersion} · ${inspectedEndpoint.timeoutMs} ms`}
                    </span>
                    <span className="f12-mono-note">{inspectedEndpoint.retryPolicy}</span>
                  </div>
                  <div className="f12-console-kv-item">
                    <span className="f12-console-kv-label">Trace Correlation</span>
                    <div className="f12-row-pair">
                      <Button
                        id={`${resolvedIdPrefix}-ep-filter-logs`}
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-log-search`;
                          if (datasetState === 'empty') {
                            setDatasetState('populated');
                          }
                          setLogSearch(inspectedEndpoint.route);
                          setLogStatusFilter('all');
                          setLogServiceFilter('all');
                          setLogPage(1);
                          setActiveSection('request-logs');
                        }}
                      >
                        View logs for route →
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* =============================================================== TAB 3: API KEYS */}
        <TabsContent value="api-keys">
          <div className="f12-stack-scene">
            <Notice
              status="info"
              title="Simulated credential vault (f12_sim_*)"
              description="Keys displayed below are deterministic fictional tokens. Issuing or revoking a key mutates local React state only and never transmits secrets over the network."
            />

            {lastIssuedKey && (
              <Alert
                id={`${resolvedIdPrefix}-issued-key-banner`}
                status="success"
                live="polite"
                title={`Simulated key issued: ${lastIssuedKey.label}`}
                description={`Token preview: ${lastIssuedKey.maskedToken} · Scope: ${scopeToLabel(lastIssuedKey.scope)} · Tier: ${lastIssuedKey.rateTier}`}
                onDismiss={() => setLastIssuedKey(null)}
                actions={
                  <Button
                    id={`${resolvedIdPrefix}-copy-issued-key`}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      toast({
                        status: 'info',
                        title: 'Copied simulated token prefix',
                        description: `${lastIssuedKey.maskedToken} copied to simulated clipboard.`,
                      });
                    }}
                  >
                    Copy simulated token
                  </Button>
                }
              />
            )}

            <Scene gutter="scene" layout="split">
              {/* Issue New Simulated Key Form */}
              <Panel variant="quiet" label="Issue simulated API key form">
                <form
                  className="f12-stack-pair"
                  noValidate
                  onSubmit={handleIssueApiKey}
                  aria-label="Issue new simulated API key"
                >
                  <div className="f12-row-between">
                    <span className="f12-console-quiet-title">ISSUE SIMULATED API KEY</span>
                    <Tag status="neutral">CLIENT-SIDE ONLY</Tag>
                  </div>

                  <Field
                    label="Key label"
                    required
                    hint="Descriptive name for audit logs (3–40 characters)."
                    error={keyLabelError}
                  >
                    <Input
                      ref={keyInputRef}
                      id={`${resolvedIdPrefix}-key-label-input`}
                      density="compact"
                      placeholder="e.g. Tokyo Fulfillment Worker"
                      value={newKeyLabel}
                      onChange={(e) => {
                        setNewKeyLabel(e.target.value);
                        if (keyLabelError) setKeyLabelError(undefined);
                      }}
                    />
                  </Field>

                  <RadioGroup
                    name={`${resolvedIdPrefix}-key-scope`}
                    label="Permission scope"
                    value={newKeyScope}
                    onValueChange={(v) => setNewKeyScope(v as ApiKeyScope)}
                  >
                    <RadioGroupItem
                      value="read_only"
                      label="READ_ONLY · Query sessions, stock, and telemetry logs"
                    />
                    <RadioGroupItem
                      value="dispatch_write"
                      label="DISPATCH_WRITE · Enqueue webhooks and reserve inventory"
                    />
                    <RadioGroupItem
                      value="admin"
                      label="ADMIN · Rotate credentials and purge tariff caches"
                    />
                  </RadioGroup>

                  <Select
                    id={`${resolvedIdPrefix}-key-tier`}
                    label="Rate-limit tier"
                    density="compact"
                    value={newKeyTier}
                    onValueChange={setNewKeyTier}
                  >
                    <SelectTrigger aria-label="Rate-limit tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard · 500 req/s">Standard · 500 req/s</SelectItem>
                      <SelectItem value="Burst · 2,000 req/s">Burst · 2,000 req/s</SelectItem>
                      <SelectItem value="Dedicated · 5,000 req/s">Dedicated · 5,000 req/s</SelectItem>
                    </SelectContent>
                  </Select>

                  <Checkbox
                    id={`${resolvedIdPrefix}-key-hmac`}
                    checked={newKeyHmac}
                    onCheckedChange={setNewKeyHmac}
                    label="Enforce HMAC-SHA256 timestamp signature on webhook payloads"
                  />

                  <div className="f12-row-pair">
                    <Button
                      id={`${resolvedIdPrefix}-issue-key-submit`}
                      type="submit"
                      variant="primary"
                    >
                      Issue simulated key
                    </Button>
                    <Button
                      id={`${resolvedIdPrefix}-issue-key-clear`}
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setNewKeyLabel('');
                        setKeyLabelError(undefined);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </form>
              </Panel>

              {/* Active vs Revoked Summary */}
              <Panel variant="quiet" label="Credential security posture">
                <div className="f12-stack-pair">
                  <span className="f12-console-quiet-title">CREDENTIAL POSTURE</span>
                  <Metric
                    variant="quiet"
                    headingLevel="h3"
                    label="Active Signing Keys"
                    value={activeKeyCount}
                    format={(n) => `${Math.round(n)} active`}
                    note={`${apiKeys.length - activeKeyCount} revoked · zero unmasked secrets in DOM`}
                  />
                  <p className="f12-console-quiet-sub">
                    Revoking an active key immediately marks it <code className="f12-code-inline">REVOKED</code>{' '}
                    after modal confirmation. Subsequent simulated requests using a revoked key
                    return <code className="f12-code-inline">401 Unauthorized</code>.
                  </p>
                </div>
              </Panel>
            </Scene>

            {/* API Keys Table */}
            <Panel variant="quiet" label="Issued simulated API keys table">
              <Table density="compact">
                <TableCaption>
                  Simulated API credentials with masked prefixes, permission scopes, and revocation
                  controls.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Label &amp; Key ID</TableHead>
                    <TableHead scope="col">Masked Token</TableHead>
                    <TableHead scope="col">Scope</TableHead>
                    <TableHead scope="col">Rate Tier</TableHead>
                    <TableHead scope="col">Last Used</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((keyItem) => (
                    <TableRow key={keyItem.id}>
                      <TableCell>
                        <div className="f12-stack-pair">
                          <strong>{keyItem.label}</strong>
                          <span className="f12-mono-note">
                            {`${keyItem.id} · Created ${keyItem.createdAt}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="f12-code-inline f12-nowrap">{keyItem.maskedToken}</code>
                      </TableCell>
                      <TableCell>
                        <Tag status={keyItem.scope === 'admin' ? 'warning' : 'neutral'}>
                          {scopeToLabel(keyItem.scope)}
                        </Tag>
                      </TableCell>
                      <TableCell>{keyItem.rateTier}</TableCell>
                      <TableCell>{keyItem.lastUsed}</TableCell>
                      <TableCell>
                        <Tag status={keyItem.status === 'active' ? 'success' : 'danger'}>
                          {keyItem.status === 'active' ? 'ACTIVE' : 'REVOKED'}
                        </Tag>
                      </TableCell>
                      <TableCell>
                        <div className="f12-row-pair">
                          <Button
                            id={`${resolvedIdPrefix}-copy-key-${keyItem.id}`}
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              toast({
                                status: 'info',
                                title: 'Masked prefix copied',
                                description: `${keyItem.maskedToken} copied to simulated clipboard.`,
                              });
                            }}
                          >
                            Copy prefix
                          </Button>
                          {keyItem.status === 'active' && (
                            <Button
                              id={`${resolvedIdPrefix}-revoke-key-${keyItem.id}`}
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.currentTarget.focus();
                                setRevokeTargetKey(keyItem);
                              }}
                            >
                              Revoke…
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </TabsContent>

        {/* =============================================================== TAB 4: REQUEST LOGS */}
        <TabsContent value="request-logs">
          <div className="f12-stack-scene">
            <Panel variant="quiet" label="Request log search, filters, and paginated ledger">
              <div className="f12-stack-scene">
                <div
                  className="f12-console-filters"
                  role="search"
                  aria-label="Filter request logs"
                >
                  <Input
                    id={`${resolvedIdPrefix}-log-search`}
                    label="Search request logs"
                    density="compact"
                    type="search"
                    placeholder="Request ID (req_...), route, or idempotency key"
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                  />

                  <Select
                    id={`${resolvedIdPrefix}-log-service`}
                    label="Service filter"
                    density="compact"
                    value={logServiceFilter}
                    onValueChange={(v) => {
                      setLogServiceFilter(v);
                      setLogPage(1);
                    }}
                  >
                    <SelectTrigger aria-label="Service filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All services (4)</SelectItem>
                      {CONSOLE_SERVICES.map((svc) => (
                        <SelectItem key={svc.id} value={svc.id}>
                          {svc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="f12-stack-pair">
                    <span className="f12-console-kv-label">HTTP status class</span>
                    <SegmentedControl
                      idPrefix={`${resolvedIdPrefix}-log-status`}
                      ariaLabel="HTTP status class filter"
                      value={logStatusFilter}
                      onChange={(next) => {
                        setLogStatusFilter(next);
                        setLogPage(1);
                      }}
                      options={[
                        { value: 'all', label: 'ALL', unit: 'status' },
                        { value: '2xx', label: '2XX', unit: 'ok' },
                        { value: '4xx', label: '4XX', unit: 'client' },
                        { value: '5xx', label: '5XX', unit: 'server' },
                      ]}
                    />
                  </div>
                </div>

                {filteredLogs.length === 0 ? (
                  <EmptyState
                    id={`${resolvedIdPrefix}-logs-empty`}
                    density="compact"
                    code={isEmptyDataset ? '0 RECORDED LOGS' : '0 MATCHING LOGS'}
                    title={
                      isEmptyDataset
                        ? 'No request logs recorded in this empty workspace'
                        : 'No request logs match the active filters'
                    }
                    description={
                      isEmptyDataset
                        ? 'This workspace has zero recorded request traces in the empty dataset state. Load sample telemetry to inspect and replay simulated requests.'
                        : `No recorded requests matched "${logSearch || '—'}" with status filter ${logStatusFilter.toUpperCase()}.`
                    }
                    action={
                      isEmptyDataset ? (
                        <Button
                          id={`${resolvedIdPrefix}-logs-load-sample`}
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-log-search`;
                            setDatasetState('populated');
                          }}
                        >
                          Load sample telemetry
                        </Button>
                      ) : (
                        <Button
                          id={`${resolvedIdPrefix}-clear-log-filters`}
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-log-search`;
                            setLogSearch('');
                            setLogStatusFilter('all');
                            setLogServiceFilter('all');
                            setLogPage(1);
                          }}
                        >
                          Clear log filters
                        </Button>
                      )
                    }
                  />
                ) : (
                  <>
                    <Table density="compact">
                      <TableCaption>
                        {`Showing page ${safeLogPage} of ${totalLogPages} (${filteredLogs.length} matching request log events).`}
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col">Request ID &amp; Time</TableHead>
                          <TableHead scope="col">Method &amp; Route</TableHead>
                          <TableHead scope="col">Service</TableHead>
                          <TableHead scope="col">Status</TableHead>
                          <TableHead scope="col">Latency</TableHead>
                          <TableHead scope="col">Region</TableHead>
                          <TableHead scope="col">Trace</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedLogs.map((logItem) => (
                          <TableRow key={logItem.id}>
                            <TableCell>
                              <div className="f12-stack-pair">
                                <div className="f12-row-pair">
                                  <code className="f12-code-inline f12-nowrap">
                                    {logItem.requestId}
                                  </code>
                                  {logItem.replayed && <Tag status="info">REPLAYED</Tag>}
                                </div>
                                <span className="f12-mono-note">{logItem.timestamp}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="f12-row-pair">
                                <Tag status="neutral">{logItem.method}</Tag>
                                <code className="f12-code-inline f12-nowrap">{logItem.route}</code>
                              </div>
                            </TableCell>
                            <TableCell>{logItem.serviceName}</TableCell>
                            <TableCell>
                              <Tag status={httpCodeToTagStatus(logItem.statusCode)}>
                                {`${logItem.statusCode}`}
                              </Tag>
                            </TableCell>
                            <TableCell>{`${fmtCompactNumber(logItem.durationMs)} ms`}</TableCell>
                            <TableCell>
                              <code className="f12-code-inline">{logItem.region}</code>
                            </TableCell>
                            <TableCell>
                              <Button
                                id={`${resolvedIdPrefix}-inspect-log-${logItem.id}`}
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.currentTarget.focus();
                                  setInspectedLog(logItem);
                                }}
                              >
                                Inspect…
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4}>Filtered Window Summary</TableCell>
                          <TableCell colSpan={3}>
                            {`${filteredLogs.length} events · Page ${safeLogPage}/${totalLogPages}`}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>

                    <div className="f12-row-between">
                      <span className="f12-mono-note">
                        Click &ldquo;Inspect…&rdquo; on any row to view JSON payloads and replay
                        simulated requests.
                      </span>
                      <Pagination
                        aria-label="Request logs pagination"
                        density="compact"
                        page={safeLogPage}
                        totalPages={totalLogPages}
                        onPageChange={setLogPage}
                        showSummary
                      />
                    </div>
                  </>
                )}
              </div>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>

      {footerSlot}

      {/* Modal Dialog 1: Confirm Simulated API Key Revocation */}
      <Dialog
        open={revokeTargetKey !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTargetKey(null);
        }}
      >
        <DialogContent cut="C-04">
          <DialogHeader>
            <DialogTitle>Revoke simulated API key?</DialogTitle>
            <DialogDescription>
              This simulated action marks the credential as revoked in local browser state. Any
              subsequent simulated request using this token will be rejected with HTTP 401
              Unauthorized.
            </DialogDescription>
          </DialogHeader>
          {revokeTargetKey && (
            <div className="f12-console-kv-list">
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">Key Label</span>
                <span className="f12-console-kv-value">{revokeTargetKey.label}</span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">Masked Token</span>
                <span className="f12-console-kv-value">{revokeTargetKey.maskedToken}</span>
              </div>
              <div className="f12-console-kv-item">
                <span className="f12-console-kv-label">Permission Scope</span>
                <span className="f12-console-kv-value">{scopeToLabel(revokeTargetKey.scope)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose id={`${resolvedIdPrefix}-cancel-revoke`} variant="secondary">
              Cancel
            </DialogClose>
            <Button
              id={`${resolvedIdPrefix}-confirm-revoke`}
              variant="primary"
              onClick={handleConfirmRevokeKey}
            >
              Confirm simulated revocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog 2: Request Log Trace Detail & Simulated Replay */}
      <Dialog
        open={inspectedLog !== null}
        onOpenChange={(open) => {
          if (!open) setInspectedLog(null);
        }}
      >
        <DialogContent cut="C-05">
          <DialogHeader>
            <DialogTitle>
              {inspectedLog
                ? `Trace ${inspectedLog.requestId} · ${inspectedLog.method} ${inspectedLog.route}`
                : 'Request Trace Inspector'}
            </DialogTitle>
            <DialogDescription>
              Simulated edge request trace, latency breakdown, and payload inspection.
            </DialogDescription>
          </DialogHeader>
          {inspectedLog && (
            <div className="f12-stack-pair">
              <div className="f12-console-kv-list">
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">HTTP Status &amp; Region</span>
                  <span className="f12-console-kv-value">
                    {`${inspectedLog.statusCode} (${inspectedLog.statusClass.toUpperCase()}) · ${inspectedLog.region}`}
                  </span>
                </div>
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">Latency Breakdown</span>
                  <span className="f12-console-kv-value">
                    {`Total ${inspectedLog.durationMs} ms (TLS ${inspectedLog.tlsMs} ms · Queue ${inspectedLog.queueMs} ms · Upstream ${inspectedLog.upstreamMs} ms)`}
                  </span>
                </div>
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">Idempotency &amp; Key ID</span>
                  <span className="f12-console-kv-value">
                    {`${inspectedLog.idempotencyKey} · ${inspectedLog.apiKeyId}`}
                  </span>
                </div>
              </div>

              <div className="f12-stack-pair">
                <span className="f12-console-kv-label">Request Payload (JSON)</span>
                <pre className="f12-console-code">{inspectedLog.requestPayload}</pre>
              </div>

              <div className="f12-stack-pair">
                <span className="f12-console-kv-label">Response Body (JSON)</span>
                <pre className="f12-console-code">{inspectedLog.responsePayload}</pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose id={`${resolvedIdPrefix}-close-log-dialog`} variant="secondary">
              Close
            </DialogClose>
            {inspectedLog && (
              <Button
                id={`${resolvedIdPrefix}-replay-log-btn`}
                variant="primary"
                onClick={() => handleReplayRequest(inspectedLog)}
              >
                Replay simulated request
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

export function DeveloperConsole(props: DeveloperConsoleProps) {
  const existingToast = useOptionalToast();
  if (existingToast) {
    return <DeveloperConsoleInner {...props} />;
  }
  return (
    <ToastProvider maxVisible={3}>
      <DeveloperConsoleInner {...props} />
    </ToastProvider>
  );
}
