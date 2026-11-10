'use client';

import * as React from 'react';
import { type MotionMode, useChanged } from '@/hooks/use-on-twos';
import {
  Sheet,
  Panel,
  SegmentedControl,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Field,
  Input,
  Textarea,
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
  Metric,
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

export type SettingsSection =
  | 'profile'
  | 'workspace'
  | 'notifications'
  | 'appearance'
  | 'motion'
  | 'team'
  | 'danger-zone';

export type SettingsDatasetState = 'populated' | 'loading' | 'empty' | 'error';
export type WorkspaceTargetId = 'prod-atelier' | 'staging-atelier';
export type WorkspaceRegion = 'us-east-1' | 'eu-central-1' | 'ap-northeast-1';
export type WorkspaceCurrency = 'USD' | 'EUR' | 'JPY';
export type RetentionWindow = '30d' | '90d' | '365d';
export type DigestCadence = 'realtime' | 'hourly' | 'daily';
export type ThemePreference = 'system' | 'light' | 'dark';
export type DensityPreference = 'compact' | 'comfortable';
export type MemberRole = 'Owner' | 'Admin' | 'Operator' | 'Auditor';
export type MemberRoleFilter = 'all' | MemberRole;

export interface ProfileSettings {
  displayName: string;
  handle: string;
  email: string;
  roleTitle: string;
  bio: string;
  requireSignedCommits: boolean;
  pgpFingerprint: string;
}

export interface WorkspacePreferences {
  workspaceName: string;
  slug: string;
  region: WorkspaceRegion;
  currency: WorkspaceCurrency;
  retention: RetentionWindow;
  strictSchemaValidation: boolean;
  dualOperatorSignoff: boolean;
}

export interface NotificationSettings {
  channels: {
    webhook: boolean;
    email: boolean;
    pager: boolean;
    slack: boolean;
  };
  webhookUrl: string;
  failureThresholdPct: string;
  digestCadence: DigestCadence;
  quietHoursEnabled: boolean;
  quietHoursWindow: string;
}

export interface AppearanceSettings {
  themeMode: ThemePreference;
  density: DensityPreference;
  showRegistrationMarks: boolean;
  highContrastRules: boolean;
}

export interface MotionSettings {
  mode: MotionMode;
  respectReducedMotion: boolean;
  animateCharts: boolean;
  enableImpactBursts: boolean;
}

export interface WorkspaceMember {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: MemberRole;
  mfaEnabled: boolean;
  status: 'ACTIVE' | 'INVITED';
  lastSeen: string;
  isPrimaryOwner?: boolean;
}

export interface DangerZoneLifecycle {
  signingSecretRevision: number;
  signingSecretMasked: string;
  bufferedTelemetryEvents: number;
  archivedAt: string | null;
}

export interface WorkspaceConfigSnapshot {
  workspaceId: WorkspaceTargetId;
  workspaceCode: string;
  environmentLabel: string;
  revision: number;
  lastSavedAt: string;
  stabilitySpark: number[];
  profile: ProfileSettings;
  workspace: WorkspacePreferences;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
  motion: MotionSettings;
  members: WorkspaceMember[];
  lifecycle: DangerZoneLifecycle;
}

const INITIAL_WORKSPACE_SNAPSHOTS: Record<WorkspaceTargetId, WorkspaceConfigSnapshot> = {
  'prod-atelier': {
    workspaceId: 'prod-atelier',
    workspaceCode: 'ws_live_01H9KOMA88F12',
    environmentLabel: 'Production · US-East',
    revision: 42,
    lastSavedAt: '14:22:08 UTC',
    stabilitySpark: [98, 98, 99, 99, 100, 99, 100, 100, 100, 99, 100, 100],
    profile: {
      displayName: 'Sora Takahashi',
      handle: '@sora.takahashi',
      email: 'sora@atelier-koma.io',
      roleTitle: 'Principal Release Engineer',
      bio: 'Primary release custodian for US-East and EU-Central checkout pipelines. Page via signed webhook before SMS escalation.',
      requireSignedCommits: true,
      pgpFingerprint: '4F91 8C02 D11E 77A0 · ED25519',
    },
    workspace: {
      workspaceName: 'Atelier Koma Production',
      slug: 'atelier-koma-prod',
      region: 'us-east-1',
      currency: 'USD',
      retention: '90d',
      strictSchemaValidation: true,
      dualOperatorSignoff: true,
    },
    notifications: {
      channels: {
        webhook: true,
        email: true,
        pager: true,
        slack: false,
      },
      webhookUrl: 'https://hooks.atelier-koma.io/v2/ops-ledger',
      failureThresholdPct: '15',
      digestCadence: 'realtime',
      quietHoursEnabled: true,
      quietHoursWindow: '22:00–07:00 UTC',
    },
    appearance: {
      themeMode: 'system',
      density: 'compact',
      showRegistrationMarks: true,
      highContrastRules: false,
    },
    motion: {
      mode: 'stepped',
      respectReducedMotion: true,
      animateCharts: true,
      enableImpactBursts: true,
    },
    members: [
      {
        id: 'mem-1',
        name: 'Sora Takahashi',
        handle: '@sora.takahashi',
        email: 'sora@atelier-koma.io',
        role: 'Owner',
        mfaEnabled: true,
        status: 'ACTIVE',
        lastSeen: '2m ago',
        isPrimaryOwner: true,
      },
      {
        id: 'mem-2',
        name: 'Mina Vance',
        handle: '@mina.vance',
        email: 'mina@atelier-koma.io',
        role: 'Admin',
        mfaEnabled: true,
        status: 'ACTIVE',
        lastSeen: '14m ago',
      },
      {
        id: 'mem-3',
        name: 'Kenji Moreau',
        handle: '@kenji.moreau',
        email: 'kenji@atelier-koma.io',
        role: 'Operator',
        mfaEnabled: true,
        status: 'ACTIVE',
        lastSeen: '1h ago',
      },
      {
        id: 'mem-4',
        name: 'Elena Rostova',
        handle: '@elena.rostova',
        email: 'elena@atelier-koma.io',
        role: 'Auditor',
        mfaEnabled: true,
        status: 'ACTIVE',
        lastSeen: '4h ago',
      },
      {
        id: 'mem-5',
        name: 'Devon Okafor',
        handle: '@devon.okafor',
        email: 'devon@atelier-koma.io',
        role: 'Operator',
        mfaEnabled: false,
        status: 'INVITED',
        lastSeen: 'Invite pending',
      },
    ],
    lifecycle: {
      signingSecretRevision: 4,
      signingSecretMasked: 'whsec_f12_live_••••_992a',
      bufferedTelemetryEvents: 14820,
      archivedAt: null,
    },
  },
  'staging-atelier': {
    workspaceId: 'staging-atelier',
    workspaceCode: 'ws_stg_01H9KOMA44Q09',
    environmentLabel: 'Staging · EU-Central',
    revision: 19,
    lastSavedAt: '11:05:40 UTC',
    stabilitySpark: [94, 95, 96, 95, 97, 96, 98, 97, 98, 98, 97, 98],
    profile: {
      displayName: 'Sora Takahashi',
      handle: '@sora.takahashi',
      email: 'sora@atelier-koma.io',
      roleTitle: 'Principal Release Engineer',
      bio: 'Staging verification profile for EU-Central schema rehearsals and replay drills.',
      requireSignedCommits: false,
      pgpFingerprint: '4F91 8C02 D11E 77A0 · ED25519',
    },
    workspace: {
      workspaceName: 'Atelier Koma Staging',
      slug: 'atelier-koma-staging',
      region: 'eu-central-1',
      currency: 'EUR',
      retention: '30d',
      strictSchemaValidation: true,
      dualOperatorSignoff: false,
    },
    notifications: {
      channels: {
        webhook: true,
        email: false,
        pager: false,
        slack: true,
      },
      webhookUrl: 'https://stage-hooks.atelier-koma.io/v2/ops-ledger',
      failureThresholdPct: '25',
      digestCadence: 'hourly',
      quietHoursEnabled: true,
      quietHoursWindow: '20:00–08:00 UTC',
    },
    appearance: {
      themeMode: 'system',
      density: 'compact',
      showRegistrationMarks: true,
      highContrastRules: false,
    },
    motion: {
      mode: 'stepped',
      respectReducedMotion: true,
      animateCharts: true,
      enableImpactBursts: false,
    },
    members: [
      {
        id: 'mem-stg-1',
        name: 'Sora Takahashi',
        handle: '@sora.takahashi',
        email: 'sora@atelier-koma.io',
        role: 'Owner',
        mfaEnabled: true,
        status: 'ACTIVE',
        lastSeen: '5m ago',
        isPrimaryOwner: true,
      },
      {
        id: 'mem-stg-2',
        name: 'Mina Vance',
        handle: '@mina.vance',
        email: 'mina@atelier-koma.io',
        role: 'Admin',
        mfaEnabled: true,
        status: 'ACTIVE',
        lastSeen: '28m ago',
      },
      {
        id: 'mem-stg-3',
        name: 'Kenji Moreau',
        handle: '@kenji.moreau',
        email: 'kenji@atelier-koma.io',
        role: 'Operator',
        mfaEnabled: true,
        status: 'ACTIVE',
        lastSeen: '2h ago',
      },
    ],
    lifecycle: {
      signingSecretRevision: 2,
      signingSecretMasked: 'whsec_f12_stg_••••_31c8',
      bufferedTelemetryEvents: 3410,
      archivedAt: null,
    },
  },
};

function cloneSnapshot(snapshot: WorkspaceConfigSnapshot): WorkspaceConfigSnapshot {
  return {
    ...snapshot,
    stabilitySpark: [...snapshot.stabilitySpark],
    profile: { ...snapshot.profile },
    workspace: { ...snapshot.workspace },
    notifications: {
      ...snapshot.notifications,
      channels: { ...snapshot.notifications.channels },
    },
    appearance: { ...snapshot.appearance },
    motion: { ...snapshot.motion },
    members: snapshot.members.map((m) => ({ ...m })),
    lifecycle: { ...snapshot.lifecycle },
  };
}

interface FieldValidationError {
  section: SettingsSection;
  sectionLabel: string;
  fieldIdSuffix: string;
  fieldLabel: string;
  message: string;
}

function validateSnapshot(draft: WorkspaceConfigSnapshot): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  const nameTrim = draft.profile.displayName.trim();
  if (nameTrim.length < 2) {
    errors.push({
      section: 'profile',
      sectionLabel: '01 · Profile',
      fieldIdSuffix: 'profile-name',
      fieldLabel: 'Operator display name',
      message: 'Display name must be at least 2 characters.',
    });
  }

  const handleTrim = draft.profile.handle.trim();
  if (!/^@[a-z0-9._-]{3,30}$/i.test(handleTrim)) {
    errors.push({
      section: 'profile',
      sectionLabel: '01 · Profile',
      fieldIdSuffix: 'profile-handle',
      fieldLabel: 'Operator handle',
      message:
        'Handle must start with @ followed by 3–30 letters, numbers, dots, underscores, or hyphens.',
    });
  }

  const emailTrim = draft.profile.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    errors.push({
      section: 'profile',
      sectionLabel: '01 · Profile',
      fieldIdSuffix: 'profile-email',
      fieldLabel: 'Primary operator email',
      message: 'Enter a valid operator email address (e.g. name@domain.io).',
    });
  }

  const bioTrim = draft.profile.bio.trim();
  if (bioTrim.length < 10) {
    errors.push({
      section: 'profile',
      sectionLabel: '01 · Profile',
      fieldIdSuffix: 'profile-bio',
      fieldLabel: 'Operator escalation bio',
      message:
        'Escalation bio must be at least 10 characters so on-call responders have routing context.',
    });
  }

  const wsNameTrim = draft.workspace.workspaceName.trim();
  if (wsNameTrim.length < 3) {
    errors.push({
      section: 'workspace',
      sectionLabel: '02 · Workspace',
      fieldIdSuffix: 'ws-name',
      fieldLabel: 'Workspace display name',
      message: 'Workspace display name must be at least 3 characters.',
    });
  }

  const slugTrim = draft.workspace.slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugTrim) || slugTrim.length < 3) {
    errors.push({
      section: 'workspace',
      sectionLabel: '02 · Workspace',
      fieldIdSuffix: 'ws-slug',
      fieldLabel: 'Workspace URL slug',
      message:
        'Slug must be at least 3 characters using lowercase letters, digits, and single hyphens only.',
    });
  }

  const activeChannelCount = Object.values(draft.notifications.channels).filter(Boolean).length;
  if (activeChannelCount === 0) {
    errors.push({
      section: 'notifications',
      sectionLabel: '03 · Notifications',
      fieldIdSuffix: 'notif-ch-webhook',
      fieldLabel: 'Active alert delivery channels',
      message: 'Select at least one alert delivery channel so critical incidents are routed.',
    });
  }

  if (draft.notifications.channels.webhook) {
    const webhookTrim = draft.notifications.webhookUrl.trim();
    let isValidWebhookUrl = false;
    try {
      const parsed = new URL(webhookTrim);
      isValidWebhookUrl = parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch {
      isValidWebhookUrl = false;
    }
    if (!isValidWebhookUrl) {
      errors.push({
        section: 'notifications',
        sectionLabel: '03 · Notifications',
        fieldIdSuffix: 'notif-webhook-url',
        fieldLabel: 'Webhook dispatch endpoint URL',
        message:
          'Webhook endpoint must be a valid https:// URL when Signed HTTPS Webhook delivery is enabled.',
      });
    }
  }

  const thresholdNum = Number(draft.notifications.failureThresholdPct.trim());
  if (
    draft.notifications.failureThresholdPct.trim() === '' ||
    Number.isNaN(thresholdNum) ||
    thresholdNum < 1 ||
    thresholdNum > 50
  ) {
    errors.push({
      section: 'notifications',
      sectionLabel: '03 · Notifications',
      fieldIdSuffix: 'notif-threshold',
      fieldLabel: 'Failure rate alert threshold (%)',
      message: 'Threshold must be a number between 1% and 50%.',
    });
  }

  return errors;
}

function computeDirtySections(
  draft: WorkspaceConfigSnapshot,
  saved: WorkspaceConfigSnapshot,
): Set<SettingsSection> {
  const dirty = new Set<SettingsSection>();

  if (
    draft.profile.displayName !== saved.profile.displayName ||
    draft.profile.handle !== saved.profile.handle ||
    draft.profile.email !== saved.profile.email ||
    draft.profile.roleTitle !== saved.profile.roleTitle ||
    draft.profile.bio !== saved.profile.bio ||
    draft.profile.requireSignedCommits !== saved.profile.requireSignedCommits
  ) {
    dirty.add('profile');
  }

  if (
    draft.workspace.workspaceName !== saved.workspace.workspaceName ||
    draft.workspace.slug !== saved.workspace.slug ||
    draft.workspace.region !== saved.workspace.region ||
    draft.workspace.currency !== saved.workspace.currency ||
    draft.workspace.retention !== saved.workspace.retention ||
    draft.workspace.strictSchemaValidation !== saved.workspace.strictSchemaValidation ||
    draft.workspace.dualOperatorSignoff !== saved.workspace.dualOperatorSignoff
  ) {
    dirty.add('workspace');
  }

  if (
    draft.notifications.channels.webhook !== saved.notifications.channels.webhook ||
    draft.notifications.channels.email !== saved.notifications.channels.email ||
    draft.notifications.channels.pager !== saved.notifications.channels.pager ||
    draft.notifications.channels.slack !== saved.notifications.channels.slack ||
    draft.notifications.webhookUrl !== saved.notifications.webhookUrl ||
    draft.notifications.failureThresholdPct !== saved.notifications.failureThresholdPct ||
    draft.notifications.digestCadence !== saved.notifications.digestCadence ||
    draft.notifications.quietHoursEnabled !== saved.notifications.quietHoursEnabled
  ) {
    dirty.add('notifications');
  }

  if (
    draft.appearance.themeMode !== saved.appearance.themeMode ||
    draft.appearance.density !== saved.appearance.density ||
    draft.appearance.showRegistrationMarks !== saved.appearance.showRegistrationMarks ||
    draft.appearance.highContrastRules !== saved.appearance.highContrastRules
  ) {
    dirty.add('appearance');
  }

  if (
    draft.motion.mode !== saved.motion.mode ||
    draft.motion.respectReducedMotion !== saved.motion.respectReducedMotion ||
    draft.motion.animateCharts !== saved.motion.animateCharts ||
    draft.motion.enableImpactBursts !== saved.motion.enableImpactBursts
  ) {
    dirty.add('motion');
  }

  if (JSON.stringify(draft.members) !== JSON.stringify(saved.members)) {
    dirty.add('team');
  }

  return dirty;
}

/** Scrolls a region into view only when it is off-screen, honouring reduced motion and `cut`. */
function revealIfOffscreen(el: HTMLElement, motion: MotionMode) {
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (rect.top >= 0 && rect.bottom <= viewportHeight) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  el.scrollIntoView({ block: 'start', behavior: reduce || motion === 'cut' ? 'auto' : 'smooth' });
}

const SECTION_LABELS: Record<SettingsSection, string> = {
  profile: '01 · Profile',
  workspace: '02 · Workspace',
  notifications: '03 · Notifications',
  appearance: '04 · Appearance',
  motion: '05 · Motion',
  team: '06 · Team & Roles',
  'danger-zone': '07 · Danger Zone',
};

const WORKSPACE_TARGET_OPTIONS: Array<{ value: WorkspaceTargetId; label: string; unit: string }> = [
  { value: 'prod-atelier', label: 'PROD', unit: 'us-east' },
  { value: 'staging-atelier', label: 'STAGE', unit: 'eu-central' },
];

const DATASET_STATE_OPTIONS: Array<{ value: SettingsDatasetState; label: string; unit: string }> = [
  { value: 'populated', label: 'LIVE', unit: 'fixture' },
  { value: 'loading', label: 'LOAD', unit: 'skel' },
  { value: 'empty', label: 'ZERO', unit: 'empty' },
  { value: 'error', label: 'ERR', unit: '503' },
];

const RETENTION_OPTIONS: Array<{ value: RetentionWindow; label: string; unit: string }> = [
  { value: '30d', label: '30D', unit: 'hot' },
  { value: '90d', label: '90D', unit: 'std' },
  { value: '365d', label: '365D', unit: 'vault' },
];

const DENSITY_OPTIONS: Array<{ value: DensityPreference; label: string; unit: string }> = [
  { value: 'compact', label: 'COMPACT', unit: '1px' },
  { value: 'comfortable', label: 'COMFORT', unit: '2px' },
];

const MAX_WORKSPACE_SEATS = 10;

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function buildBaselineSnapshot(
  targetId: WorkspaceTargetId,
  externalMotion?: MotionMode,
  externalTheme?: 'light' | 'dark',
): WorkspaceConfigSnapshot {
  const snap = cloneSnapshot(INITIAL_WORKSPACE_SNAPSHOTS[targetId]);
  if (externalMotion) {
    snap.motion.mode = externalMotion;
  }
  if (externalTheme) {
    snap.appearance.themeMode = externalTheme;
  }
  return snap;
}

interface CachedRouteDraft {
  workspaceId: WorkspaceTargetId;
  savedByWorkspace: Record<WorkspaceTargetId, WorkspaceConfigSnapshot>;
  draft: WorkspaceConfigSnapshot;
  externalMotion?: MotionMode;
  externalTheme?: 'light' | 'dark';
}

const CLIENT_ROUTE_DRAFT_CACHE = new Map<string, CachedRouteDraft>();

function reconcileCachedSnapshot(
  snap: WorkspaceConfigSnapshot,
  cachedState: CachedRouteDraft,
  externalMotion?: MotionMode,
  externalTheme?: 'light' | 'dark',
): WorkspaceConfigSnapshot {
  const next = cloneSnapshot(snap);
  if (externalMotion !== undefined && externalMotion !== cachedState.externalMotion) {
    next.motion.mode = externalMotion;
  }
  if (externalTheme !== cachedState.externalTheme) {
    next.appearance.themeMode = externalTheme ?? 'system';
  }
  return next;
}

export interface WorkspaceSettingsProps {
  /** Default active settings tab (`'profile'` by default). */
  defaultSection?: SettingsSection;
  /** Default dataset state (`'populated'` by default) for testing loading/empty/error states. */
  defaultDatasetState?: SettingsDatasetState;
  /** Default workspace target (`'prod-atelier'` by default). */
  defaultWorkspaceId?: WorkspaceTargetId;
  /** Alias for `defaultSection`. */
  initialSection?: SettingsSection;
  /** Alias for `defaultDatasetState`. */
  initialDatasetState?: SettingsDatasetState;
  /** Alias for `defaultWorkspaceId`. */
  initialWorkspaceId?: WorkspaceTargetId;
  /** Motion grammar override (`'stepped'` 12fps by default; changing Motion Preferences updates the sheet live). */
  motion?: MotionMode;
  /** Theme override (`'light'` or `'dark'`; changing Appearance updates the sheet live). */
  theme?: 'light' | 'dark';
  /** Additional CSS class names for the root `<Sheet>`. */
  className?: string;
  /** Show interactive sandbox state switcher bar for exploring loading/empty/error states. */
  showSandboxControls?: boolean;
  /** Prefix for deterministic DOM IDs. When omitted, a collision-free React.useId() prefix is generated. */
  idPrefix?: string;
  /** Callback fired whenever unsaved draft state or modified sections change. */
  onDirtyChange?: (isDirty: boolean, dirtySections: SettingsSection[]) => void;
  /**
   * Called once with the new section after every internal section change (tab click, breadcrumb,
   * or validation jump). Never called on mount. Use it to mirror the section into a URL.
   */
  onSectionChange?: (section: SettingsSection) => void;
  /** Optional slot rendered at the top of the sheet (used by the docs showcase for install commands). */
  headerSlot?: React.ReactNode;
  /** Optional slot rendered at the bottom of the sheet. */
  footerSlot?: React.ReactNode;
}

function WorkspaceSettingsInner({
  defaultSection,
  defaultDatasetState,
  defaultWorkspaceId,
  initialSection,
  initialDatasetState,
  initialWorkspaceId,
  motion: externalMotion,
  theme: externalTheme,
  className,
  showSandboxControls = true,
  idPrefix,
  onDirtyChange,
  onSectionChange,
  headerSlot,
  footerSlot,
}: WorkspaceSettingsProps) {
  const autoId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const resolvedIdPrefix = idPrefix ?? `f12-settings-${autoId}`;
  const { toast } = useToast();

  const resolvedDefaultWorkspaceId =
    defaultWorkspaceId ?? initialWorkspaceId ?? 'prod-atelier';
  const resolvedDefaultSection = defaultSection ?? initialSection ?? 'profile';
  const resolvedDefaultDatasetState =
    defaultDatasetState ?? initialDatasetState ?? 'populated';

  const cachedRouteState = idPrefix ? CLIENT_ROUTE_DRAFT_CACHE.get(idPrefix) : undefined;

  const [workspaceId, setWorkspaceId] = React.useState<WorkspaceTargetId>(
    () => cachedRouteState?.workspaceId ?? resolvedDefaultWorkspaceId,
  );
  const [activeSection, setActiveSection] =
    React.useState<SettingsSection>(resolvedDefaultSection);
  // Report each committed section change (never the initial mount) to the optional callback.
  // Comparing against the last reported value keeps StrictMode effect replays from double-firing.
  const onSectionChangeRef = React.useRef(onSectionChange);
  onSectionChangeRef.current = onSectionChange;
  const reportedSectionRef = React.useRef(activeSection);
  React.useEffect(() => {
    if (reportedSectionRef.current === activeSection) return;
    reportedSectionRef.current = activeSection;
    onSectionChangeRef.current?.(activeSection);
  }, [activeSection]);
  const [datasetState, setDatasetState] =
    React.useState<SettingsDatasetState>(resolvedDefaultDatasetState);

  const [savedByWorkspace, setSavedByWorkspace] = React.useState<
    Record<WorkspaceTargetId, WorkspaceConfigSnapshot>
  >(() =>
    cachedRouteState
      ? {
          'prod-atelier': reconcileCachedSnapshot(
            cachedRouteState.savedByWorkspace['prod-atelier'],
            cachedRouteState,
            externalMotion,
            externalTheme,
          ),
          'staging-atelier': reconcileCachedSnapshot(
            cachedRouteState.savedByWorkspace['staging-atelier'],
            cachedRouteState,
            externalMotion,
            externalTheme,
          ),
        }
      : {
          'prod-atelier': buildBaselineSnapshot('prod-atelier', externalMotion, externalTheme),
          'staging-atelier': buildBaselineSnapshot('staging-atelier', externalMotion, externalTheme),
        },
  );

  const [draft, setDraft] = React.useState<WorkspaceConfigSnapshot>(() =>
    cachedRouteState
      ? reconcileCachedSnapshot(
          cachedRouteState.draft,
          cachedRouteState,
          externalMotion,
          externalTheme,
        )
      : buildBaselineSnapshot(resolvedDefaultWorkspaceId, externalMotion, externalTheme),
  );

  const [osTheme, setOsTheme] = React.useState<'light' | 'dark' | undefined>(undefined);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setOsTheme(mql.matches ? 'dark' : 'light');
    update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    mql.addListener?.(update);
    return () => mql.removeListener?.(update);
  }, []);

  const prevExternalMotionRef = React.useRef<MotionMode | undefined>(externalMotion);
  useIsomorphicLayoutEffect(() => {
    if (externalMotion && externalMotion !== prevExternalMotionRef.current) {
      prevExternalMotionRef.current = externalMotion;
      setSavedByWorkspace((prev) => ({
        'prod-atelier': {
          ...prev['prod-atelier'],
          motion: { ...prev['prod-atelier'].motion, mode: externalMotion },
        },
        'staging-atelier': {
          ...prev['staging-atelier'],
          motion: { ...prev['staging-atelier'].motion, mode: externalMotion },
        },
      }));
      setDraft((prev) => ({
        ...prev,
        motion: { ...prev.motion, mode: externalMotion },
      }));
    }
  }, [externalMotion]);

  const prevExternalThemeRef = React.useRef<'light' | 'dark' | undefined>(externalTheme);
  useIsomorphicLayoutEffect(() => {
    if (externalTheme !== prevExternalThemeRef.current) {
      prevExternalThemeRef.current = externalTheme;
      const nextThemeMode: ThemePreference = externalTheme ?? 'system';
      setSavedByWorkspace((prev) => ({
        'prod-atelier': {
          ...prev['prod-atelier'],
          appearance: { ...prev['prod-atelier'].appearance, themeMode: nextThemeMode },
        },
        'staging-atelier': {
          ...prev['staging-atelier'],
          appearance: { ...prev['staging-atelier'].appearance, themeMode: nextThemeMode },
        },
      }));
      setDraft((prev) => ({
        ...prev,
        appearance: { ...prev.appearance, themeMode: nextThemeMode },
      }));
    }
  }, [externalTheme]);

  const savedSnapshot = savedByWorkspace[workspaceId];
  const dirtySections = React.useMemo(
    () => computeDirtySections(draft, savedSnapshot),
    [draft, savedSnapshot],
  );
  const isDirty = dirtySections.size > 0;
  const dirtySectionsKey = React.useMemo(
    () => Array.from(dirtySections).join(','),
    [dirtySections],
  );
  const dirtySectionLabels = React.useMemo(
    () => Array.from(dirtySections).map((sec) => SECTION_LABELS[sec]),
    [dirtySections],
  );

  const onDirtyChangeRef = React.useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  React.useEffect(() => {
    const sections = dirtySectionsKey
      ? (dirtySectionsKey.split(',') as SettingsSection[])
      : [];
    onDirtyChangeRef.current?.(isDirty, sections);
  }, [isDirty, dirtySectionsKey]);

  React.useEffect(() => {
    if (!idPrefix) return;
    if (isDirty) {
      CLIENT_ROUTE_DRAFT_CACHE.set(idPrefix, {
        workspaceId,
        savedByWorkspace: {
          'prod-atelier': cloneSnapshot(savedByWorkspace['prod-atelier']),
          'staging-atelier': cloneSnapshot(savedByWorkspace['staging-atelier']),
        },
        draft: cloneSnapshot(draft),
        externalMotion,
        externalTheme,
      });
    } else {
      CLIENT_ROUTE_DRAFT_CACHE.delete(idPrefix);
    }
  }, [idPrefix, isDirty, workspaceId, savedByWorkspace, draft, externalMotion, externalTheme]);

  const validationErrors = React.useMemo(() => validateSnapshot(draft), [draft]);
  const [showValidationSummary, setShowValidationSummary] = React.useState<boolean>(false);

  const [memberSearch, setMemberSearch] = React.useState<string>('');
  const [memberRoleFilter, setMemberRoleFilter] = React.useState<MemberRoleFilter>('all');
  const [inviteEmail, setInviteEmail] = React.useState<string>('');
  const [inviteName, setInviteName] = React.useState<string>('');
  const [inviteRole, setInviteRole] = React.useState<MemberRole>('Operator');
  const [inviteError, setInviteError] = React.useState<string | undefined>(undefined);

  const [motionPoseCount, setMotionPoseCount] = React.useState<number>(1);
  const motionPoseChanged = useChanged(motionPoseCount);
  const revisionChanged = useChanged(`${workspaceId}-${savedSnapshot.revision}-${isDirty}`);

  const [pendingWorkspaceTarget, setPendingWorkspaceTarget] =
    React.useState<WorkspaceTargetId | null>(null);
  const [pendingNavigationHref, setPendingNavigationHref] = React.useState<string | null>(null);
  const pendingNavigationAnchorRef = React.useRef<HTMLAnchorElement | null>(null);
  const bypassRouteGuardRef = React.useRef<boolean>(false);
  const [memberPendingRemoval, setMemberPendingRemoval] =
    React.useState<WorkspaceMember | null>(null);
  const [dangerDialogMode, setDangerDialogMode] = React.useState<
    'rotate-secret' | 'purge-cache' | 'archive-workspace' | null
  >(null);
  const [archiveConfirmSlug, setArchiveConfirmSlug] = React.useState<string>('');
  const [archiveSlugError, setArchiveSlugError] = React.useState<string | undefined>(undefined);

  const pendingFocusTargetIdRef = React.useRef<string | null>(null);
  // Set alongside a pending focus target when the move should also bring its section tabs into
  // view (breadcrumb navigation from the sheet header to the tab strip below the fold).
  const pendingRevealMotionRef = React.useRef<MotionMode | null>(null);

  React.useEffect(() => {
    const targetId = pendingFocusTargetIdRef.current;
    const revealMotion = pendingRevealMotionRef.current;
    pendingRevealMotionRef.current = null;
    if (!targetId) return;
    pendingFocusTargetIdRef.current = null;
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el && typeof el.focus === 'function') {
        if (revealMotion) {
          el.focus({ preventScroll: true });
          revealIfOffscreen(el.closest<HTMLElement>('[role="tablist"]') ?? el, revealMotion);
        } else {
          el.focus();
        }
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [
    activeSection,
    datasetState,
    isDirty,
    showValidationSummary,
    draft.members.length,
    memberSearch,
    memberRoleFilter,
    draft.lifecycle.signingSecretRevision,
    draft.lifecycle.bufferedTelemetryEvents,
    draft.lifecycle.archivedAt,
    dangerDialogMode,
    memberPendingRemoval,
    pendingWorkspaceTarget,
    pendingNavigationHref,
  ]);

  React.useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  React.useEffect(() => {
    if (!isDirty) return;
    const handleDocumentClickCapture = (event: MouseEvent) => {
      if (
        bypassRouteGuardRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const rawHref = anchor.getAttribute('href');
      if (
        !rawHref ||
        rawHref.startsWith('#') ||
        rawHref.startsWith('mailto:') ||
        rawHref.startsWith('tel:') ||
        rawHref.startsWith('javascript:')
      ) {
        return;
      }
      try {
        const dest = new URL(anchor.href, window.location.href);
        // A same-page link (only the query or hash differs, e.g. a `?section=` tab URL) keeps
        // this block mounted or restores the cached draft, so it needs no guard. A hard
        // reload of the same page is still covered by the `beforeunload` guard above.
        if (
          dest.origin === window.location.origin &&
          dest.pathname === window.location.pathname
        ) {
          return;
        }
      } catch {
        // Guard navigation on parse fallback
      }
      event.preventDefault();
      event.stopPropagation();
      pendingNavigationAnchorRef.current = anchor;
      setPendingNavigationHref(rawHref);
    };
    document.addEventListener('click', handleDocumentClickCapture, true);
    return () => document.removeEventListener('click', handleDocumentClickCapture, true);
  }, [isDirty]);

  const getFieldError = React.useCallback(
    (fieldIdSuffix: string): string | undefined => {
      const found = validationErrors.find((err) => err.fieldIdSuffix === fieldIdSuffix);
      return found?.message;
    },
    [validationErrors],
  );

  const applyWorkspaceSwitch = (nextTarget: WorkspaceTargetId, discardedDraft: boolean) => {
    const nextSaved = savedByWorkspace[nextTarget];
    if (idPrefix) {
      CLIENT_ROUTE_DRAFT_CACHE.delete(idPrefix);
    }
    pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-ws-target-${nextTarget}`;
    setWorkspaceId(nextTarget);
    setDraft(cloneSnapshot(nextSaved));
    setShowValidationSummary(false);
    setMemberSearch('');
    setMemberRoleFilter('all');
    setInviteError(undefined);
    setPendingWorkspaceTarget(null);
    toast({
      status: 'info',
      title: `Switched to ${nextSaved.workspace.workspaceName}`,
      description: discardedDraft
        ? `Discarded unsaved edits and loaded ${nextSaved.environmentLabel} (REV-0${nextSaved.revision}).`
        : `Loaded ${nextSaved.environmentLabel} snapshot (REV-0${nextSaved.revision}).`,
    });
  };

  const handleWorkspaceTargetRequest = (nextTarget: WorkspaceTargetId) => {
    if (nextTarget === workspaceId) return;
    if (isDirty) {
      setPendingWorkspaceTarget(nextTarget);
      return;
    }
    applyWorkspaceSwitch(nextTarget, false);
  };

  const handleSaveChanges = (event?: React.FormEvent) => {
    if (event) event.preventDefault();

    if (validationErrors.length > 0) {
      setShowValidationSummary(true);
      const firstErr = validationErrors[0];
      const targetFieldId = `${resolvedIdPrefix}-${firstErr.fieldIdSuffix}`;
      if (activeSection !== firstErr.section) {
        pendingFocusTargetIdRef.current = targetFieldId;
        setActiveSection(firstErr.section);
      } else {
        pendingFocusTargetIdRef.current = null;
        window.requestAnimationFrame(() => {
          const el = document.getElementById(targetFieldId);
          if (el && typeof el.focus === 'function') {
            el.focus();
          }
        });
      }
      toast({
        status: 'danger',
        title: `Validation failed (${validationErrors.length} ${validationErrors.length === 1 ? 'issue' : 'issues'})`,
        description: `${firstErr.fieldLabel}: ${firstErr.message}`,
      });
      return;
    }

    const nextRevision = savedSnapshot.revision + 1;
    const committed: WorkspaceConfigSnapshot = {
      ...cloneSnapshot(draft),
      revision: nextRevision,
      lastSavedAt: 'Just now (local sandbox)',
    };

    if (idPrefix) {
      CLIENT_ROUTE_DRAFT_CACHE.delete(idPrefix);
    }
    setSavedByWorkspace((prev) => ({
      ...prev,
      [workspaceId]: committed,
    }));
    setDraft(cloneSnapshot(committed));
    setShowValidationSummary(false);

    toast({
      status: 'success',
      title: `Saved configuration REV-0${nextRevision}`,
      description: `Synchronized ${dirtySectionLabels.length || 1} section(s) for ${committed.workspace.workspaceName} in client-side sandbox state.`,
    });
  };

  const handleDiscardChanges = () => {
    if (idPrefix) {
      CLIENT_ROUTE_DRAFT_CACHE.delete(idPrefix);
    }
    setDraft(cloneSnapshot(savedSnapshot));
    setShowValidationSummary(false);
    setInviteError(undefined);
    pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-reset-btn`;
    toast({
      status: 'info',
      title: 'Discarded unsaved changes',
      description: `Reverted all fields to saved snapshot REV-0${savedSnapshot.revision}.`,
    });
  };

  const handleResetDefaults = () => {
    if (idPrefix) {
      CLIENT_ROUTE_DRAFT_CACHE.delete(idPrefix);
    }
    const factory = buildBaselineSnapshot(workspaceId, externalMotion, externalTheme);
    setSavedByWorkspace((prev) => ({
      ...prev,
      [workspaceId]: factory,
    }));
    setDraft(cloneSnapshot(factory));
    setShowValidationSummary(false);
    setMemberSearch('');
    setMemberRoleFilter('all');
    setInviteEmail('');
    setInviteName('');
    setInviteError(undefined);
    pendingFocusTargetIdRef.current = null;
    window.requestAnimationFrame(() => {
      document.getElementById(`${resolvedIdPrefix}-reset-btn`)?.focus();
    });
    toast({
      status: 'warning',
      title: 'Reset to factory defaults',
      description: `Restored ${factory.workspace.workspaceName} to baseline snapshot REV-0${factory.revision}.`,
    });
  };

  const isEmptyDataset = datasetState === 'empty';
  const isLoadingDataset = datasetState === 'loading';
  const isErrorDataset = datasetState === 'error';

  const effectiveMembers = React.useMemo(
    () => (isEmptyDataset ? [] : draft.members),
    [isEmptyDataset, draft.members],
  );

  const handleInviteMember = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanName = inviteName.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setInviteError('Enter a valid email address to send a workspace invitation.');
      const emailEl = document.getElementById(`${resolvedIdPrefix}-invite-email`);
      if (emailEl) emailEl.focus();
      return;
    }

    if (effectiveMembers.length >= MAX_WORKSPACE_SEATS) {
      setInviteError(
        `Workspace seat capacity reached (${MAX_WORKSPACE_SEATS} / ${MAX_WORKSPACE_SEATS} seats). Remove an existing member before sending new invitations.`,
      );
      const emailEl = document.getElementById(`${resolvedIdPrefix}-invite-email`);
      if (emailEl) emailEl.focus();
      return;
    }

    if (effectiveMembers.some((m) => m.email.toLowerCase() === cleanEmail)) {
      setInviteError('That email address is already a member or has a pending invitation.');
      const emailEl = document.getElementById(`${resolvedIdPrefix}-invite-email`);
      if (emailEl) emailEl.focus();
      return;
    }

    const localPart = cleanEmail.split('@')[0].replace(/[^a-z0-9._-]/gi, '');
    const derivedName =
      cleanName.length >= 2
        ? cleanName
        : localPart
            .split(/[._-]/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'New Operator';

    const newMember: WorkspaceMember = {
      id: `mem-${Date.now()}`,
      name: derivedName,
      handle: `@${localPart || 'operator'}`,
      email: cleanEmail,
      role: inviteRole,
      mfaEnabled: false,
      status: 'INVITED',
      lastSeen: 'Invited just now',
    };

    if (isEmptyDataset) {
      setDatasetState('populated');
      setDraft((prev) => ({
        ...prev,
        members: [newMember],
      }));
    } else {
      setDraft((prev) => ({
        ...prev,
        members: [...prev.members, newMember],
      }));
    }
    setInviteEmail('');
    setInviteName('');
    setInviteError(undefined);

    toast({
      status: 'success',
      title: `Invited ${derivedName} (${inviteRole})`,
      description: `Added ${cleanEmail} to ${draft.workspace.workspaceName} draft roster. Click Save changes to commit.`,
    });
  };

  const handleMemberRoleChange = (memberId: string, nextRole: MemberRole) => {
    setDraft((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === memberId && !m.isPrimaryOwner ? { ...m, role: nextRole } : m,
      ),
    }));
  };

  const handleConfirmMemberRemoval = () => {
    if (!memberPendingRemoval) return;
    const removed = memberPendingRemoval;
    setDraft((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== removed.id),
    }));
    setMemberPendingRemoval(null);
    pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-member-search`;
    toast({
      status: 'warning',
      title: `Removed ${removed.name}`,
      description: `${removed.email} was removed from the workspace draft roster.`,
    });
  };

  const targetArchiveSlug =
    savedSnapshot.workspace.slug.trim() ||
    INITIAL_WORKSPACE_SNAPSHOTS[workspaceId].workspace.slug.trim();

  const handleConfirmDangerAction = (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!dangerDialogMode) return;

    if (dangerDialogMode === 'rotate-secret') {
      const nextRev = draft.lifecycle.signingSecretRevision + 1;
      const suffix = nextRev % 2 === 1 ? '77e4' : '992a';
      const nextMasked = `whsec_f12_${workspaceId === 'prod-atelier' ? 'live' : 'stg'}_••••_${suffix}`;
      setDraft((prev) => ({
        ...prev,
        lifecycle: {
          ...prev.lifecycle,
          signingSecretRevision: nextRev,
          signingSecretMasked: nextMasked,
        },
      }));
      setSavedByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: {
          ...prev[workspaceId],
          lifecycle: {
            ...prev[workspaceId].lifecycle,
            signingSecretRevision: nextRev,
            signingSecretMasked: nextMasked,
          },
        },
      }));
      setDangerDialogMode(null);
      pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-danger-rotate-btn`;
      toast({
        status: 'warning',
        title: `Rotated signing secret to v${nextRev}`,
        description: `Active HMAC secret updated to ${nextMasked} (previous key remains valid for 15m grace window).`,
      });
      return;
    }

    if (dangerDialogMode === 'purge-cache') {
      const purgedCount = draft.lifecycle.bufferedTelemetryEvents;
      setDraft((prev) => ({
        ...prev,
        lifecycle: {
          ...prev.lifecycle,
          bufferedTelemetryEvents: 0,
        },
      }));
      setSavedByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: {
          ...prev[workspaceId],
          lifecycle: {
            ...prev[workspaceId].lifecycle,
            bufferedTelemetryEvents: 0,
          },
        },
      }));
      setDangerDialogMode(null);
      pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-danger-rotate-btn`;
      toast({
        status: 'info',
        title: 'Purged buffered telemetry cache',
        description: `Evicted ${purgedCount.toLocaleString()} cached replay events from local workspace storage.`,
      });
      return;
    }

    if (dangerDialogMode === 'archive-workspace') {
      const enteredSlug = archiveConfirmSlug.trim();
      if (!enteredSlug || enteredSlug !== targetArchiveSlug) {
        setArchiveSlugError(
          `Type the exact saved workspace slug "${targetArchiveSlug}" to confirm archival.`,
        );
        const slugInput = document.getElementById(`${resolvedIdPrefix}-archive-confirm-input`);
        if (slugInput) slugInput.focus();
        return;
      }

      if (idPrefix) {
        CLIENT_ROUTE_DRAFT_CACHE.delete(idPrefix);
      }
      const factory = buildBaselineSnapshot(workspaceId, externalMotion, externalTheme);
      const archivedState: WorkspaceConfigSnapshot = {
        ...factory,
        lifecycle: {
          ...factory.lifecycle,
          bufferedTelemetryEvents: 0,
          archivedAt: 'Archived in sandbox session',
        },
      };
      setSavedByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: archivedState,
      }));
      setDraft(cloneSnapshot(archivedState));
      setArchiveConfirmSlug('');
      setArchiveSlugError(undefined);
      setDangerDialogMode(null);
      pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-danger-archive-btn`;
      toast({
        status: 'warning',
        title: `Archived & reset ${factory.workspace.workspaceName}`,
        description:
          'Simulated workspace archive completed. Configuration reset to baseline read-ready posture.',
      });
    }
  };

  const filteredMembers = React.useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return effectiveMembers.filter((m) => {
      if (memberRoleFilter !== 'all' && m.role !== memberRoleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.handle.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    });
  }, [effectiveMembers, memberSearch, memberRoleFilter]);

  const effectiveChannels = React.useMemo(
    () =>
      isEmptyDataset
        ? { webhook: false, email: false, pager: false, slack: false }
        : draft.notifications.channels,
    [isEmptyDataset, draft.notifications.channels],
  );

  const effectiveBufferedEvents = isEmptyDataset
    ? 0
    : draft.lifecycle.bufferedTelemetryEvents;

  const activeChannelList = React.useMemo(() => {
    const list: string[] = [];
    if (effectiveChannels.webhook) list.push('Webhook');
    if (effectiveChannels.email) list.push('Email');
    if (effectiveChannels.pager) list.push('Pager');
    if (effectiveChannels.slack) list.push('Slack');
    return list;
  }, [effectiveChannels]);

  const effectiveThemeMode: ThemePreference =
    externalTheme !== prevExternalThemeRef.current
      ? (externalTheme ?? 'system')
      : draft.appearance.themeMode;
  const sheetTheme: 'light' | 'dark' | undefined =
    effectiveThemeMode === 'system' ? osTheme : effectiveThemeMode;
  const effectiveSheetTheme: 'light' | 'dark' = sheetTheme ?? 'light';

  const effectiveSheetMotion: MotionMode =
    externalMotion && externalMotion !== prevExternalMotionRef.current
      ? externalMotion
      : draft.motion.mode;
  const effectiveChartMotion: MotionMode = draft.motion.animateCharts
    ? effectiveSheetMotion
    : 'cut';

  const postureStatusTag: { status: TagStatus; label: string } = isErrorDataset
    ? { status: 'danger', label: 'SYNC FAULT' }
    : isEmptyDataset
      ? { status: 'neutral', label: 'EMPTY SANDBOX' }
      : validationErrors.length > 0
        ? { status: 'danger', label: `${validationErrors.length} INVALID` }
        : isDirty
          ? { status: 'warning', label: `UNSAVED DRAFT (${dirtySections.size})` }
          : { status: 'success', label: 'SYNCHRONIZED' };

  return (
    <Sheet
      id={`${resolvedIdPrefix}-sheet`}
      motion={effectiveSheetMotion}
      theme={sheetTheme}
      pegs={draft.appearance.showRegistrationMarks}
      data-high-contrast-rules={draft.appearance.highContrastRules ? 'true' : 'false'}
      data-animate-charts={draft.motion.animateCharts ? 'true' : 'false'}
      className={['f12-console', 'f12-settings', className].filter(Boolean).join(' ')}
    >
      {headerSlot}

      {/* ===================================================================== SHEET HEADER */}
      <header className="f12-hd">
        <div className="f12-hd-text">
          <Breadcrumb
            aria-label="Workspace settings hierarchy"
            density="compact"
            items={[
              // Org root: no view above the workspace exists inside this block, so it is
              // context text, not a fake link.
              { label: 'FRAME/12 Control Plane' },
              {
                // Workspace level → its landing section. Only actionable when it would change
                // the view; shows the saved name so unsaved typing doesn't rewrite the path.
                label: savedSnapshot.workspace.workspaceName.trim() || 'Untitled workspace',
                onSelect:
                  activeSection !== 'profile'
                    ? () => {
                        const targetId = `${resolvedIdPrefix}-tabs-tab-profile`;
                        // Move focus before this button unmounts (it turns back into text at the
                        // landing section) so Firefox carries :focus-visible over for keyboard use.
                        document.getElementById(targetId)?.focus({ preventScroll: true });
                        pendingFocusTargetIdRef.current = targetId;
                        pendingRevealMotionRef.current = effectiveSheetMotion;
                        setActiveSection('profile');
                      }
                    : undefined,
              },
              {
                label: SECTION_LABELS[activeSection],
                current: true,
              },
            ]}
          />
          <p className="f12-eyebrow">
            <span>{draft.workspaceCode}</span>
            <Tag status={postureStatusTag.status}>{postureStatusTag.label}</Tag>
            <Badge
              pop={revisionChanged}
              burst={draft.motion.enableImpactBursts && revisionChanged}
            >
              {`REV-0${savedSnapshot.revision}`}
            </Badge>
          </p>
          <h1 className="f12-title">Workspace &amp; Operator Settings</h1>
          <p className="f12-sub" id={`${resolvedIdPrefix}-subtitle`}>
            Quiet operational configuration ledger · Client-side sandbox state (no external network
            mutations) · Last saved {savedSnapshot.lastSavedAt}
          </p>
        </div>

        <div className="f12-stack-pair">
          <div className="f12-row-pair">
            <SegmentedControl
              idPrefix={`${resolvedIdPrefix}-ws-target`}
              ariaLabel="Target workspace environment"
              options={WORKSPACE_TARGET_OPTIONS}
              value={workspaceId}
              onChange={handleWorkspaceTargetRequest}
            />
            {showSandboxControls ? (
              <SegmentedControl
                idPrefix={`${resolvedIdPrefix}-dataset`}
                ariaLabel="Sandbox dataset simulation state"
                options={DATASET_STATE_OPTIONS}
                value={datasetState}
                onChange={(next) => {
                  setDatasetState(next);
                }}
              />
            ) : null}
          </div>
        </div>
      </header>

      {/* ===================================================================== ERROR / EMPTY BANNERS */}
      {isErrorDataset ? (
        <Alert
          id={`${resolvedIdPrefix}-error-banner`}
          status="danger"
          title="Configuration snapshot synchronization fault (Simulated 503)"
          actions={
            <Button
              id={`${resolvedIdPrefix}-retry-sync`}
              variant="secondary"
              size="sm"
              onClick={() => {
                pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-reset-btn`;
                setDatasetState('populated');
                toast({
                  status: 'success',
                  title: 'Control-plane snapshot reconnected',
                  description: `Restored ${draft.workspace.workspaceName} configuration ledger.`,
                });
              }}
            >
              Retry configuration sync
            </Button>
          }
        >
          Simulated lock contention on remote config store{' '}
          <code className="f12-code-inline">{draft.workspaceCode}</code>. Local draft edits remain
          preserved in memory. Retry synchronization to clear the fault state.
        </Alert>
      ) : null}

      {isEmptyDataset ? (
        <EmptyState
          id={`${resolvedIdPrefix}-empty-banner`}
          code="SANDBOX STATE · ZERO PRE-POPULATED ROSTER"
          title="Workspace roster and alert channels are currently empty"
          description="You are viewing the empty dataset simulation state. Populate the default production fixture or invite an operator in the Team & Roles tab."
          action={
            <Button
              id={`${resolvedIdPrefix}-populate-defaults`}
              variant="primary"
              size="sm"
              onClick={() => {
                pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-reset-btn`;
                setDatasetState('populated');
                toast({
                  status: 'info',
                  title: 'Populated default workspace fixture',
                  description: `Loaded ${draft.members.length} team members and routing rules.`,
                });
              }}
            >
              Load sample data
            </Button>
          }
        />
      ) : null}

      {/* ===================================================================== C-01: FOCUSED EXPRESSIVE POSTURE HEADER */}
      <Panel
        cut="C-01"
        className="f12-settings-posture-panel"
        label="Workspace configuration posture and operational summary"
        aria-busy={isLoadingDataset}
      >
        {isLoadingDataset ? (
          <div className="f12-stack-pair" id={`${resolvedIdPrefix}-loading-posture`}>
            <Skeleton width="38%" height={16} />
            <Skeleton width="62%" height={40} />
            <SkeletonText lines={2} />
          </div>
        ) : (
          <div className="f12-stack-pair">
            <div className="f12-row-between">
              <div id={`${resolvedIdPrefix}-posture-metric`} className="f12-stack-pair">
                <Metric
                  headingLevel="h2"
                  label="Configuration Posture & Revision"
                  value={savedSnapshot.revision}
                  format={(n) => (isDirty ? `REV-0${Math.round(n)}*` : `REV-0${Math.round(n)}`)}
                  motion={effectiveChartMotion}
                  note={
                    validationErrors.length > 0
                      ? `${validationErrors.length} VALIDATION ERROR(S)`
                      : isDirty
                        ? `Modified: ${dirtySectionLabels.join(', ')}`
                        : `Signed commits: ${draft.profile.requireSignedCommits ? 'ENFORCED' : 'OPTIONAL'}`
                  }
                />
                <ToneSpark
                  values={draft.stabilitySpark}
                  label="Configuration stability history"
                  motion={effectiveChartMotion}
                />
              </div>

              <div className="f12-console-kv-list" aria-label="Operational posture summary">
                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">Active Seats</span>
                  <span className="f12-console-kv-value" id={`${resolvedIdPrefix}-kpi-seats`}>
                    {`${effectiveMembers.length} / ${MAX_WORKSPACE_SEATS} SEATS`}
                  </span>
                  <span className="f12-mono-note">
                    {isEmptyDataset
                      ? '0 active · 0 invited'
                      : `${effectiveMembers.filter((m) => m.status === 'ACTIVE').length} active · ${effectiveMembers.filter((m) => m.status === 'INVITED').length} invited`}
                  </span>
                </div>

                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">Alert Routing</span>
                  <span className="f12-console-kv-value" id={`${resolvedIdPrefix}-kpi-channels`}>
                    {`${activeChannelList.length} ACTIVE`}
                  </span>
                  <span className="f12-mono-note">
                    {activeChannelList.length > 0
                      ? `${activeChannelList.join(', ')} · >=${draft.notifications.failureThresholdPct}%`
                      : 'No channels selected'}
                  </span>
                </div>

                <div className="f12-console-kv-item">
                  <span className="f12-console-kv-label">Sheet Grammar</span>
                  <span className="f12-console-kv-value" id={`${resolvedIdPrefix}-kpi-grammar`}>
                    {`${draft.motion.mode.toUpperCase()} · ${draft.appearance.density.toUpperCase()}`}
                  </span>
                  <span className="f12-mono-note">
                    {`Theme: ${draft.appearance.themeMode} (${effectiveSheetTheme}) · Region: ${draft.workspace.region}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* ===================================================================== UNSAVED CHANGES & PERSISTENCE BAR */}
      <div
        className="f12-settings-bar"
        id={`${resolvedIdPrefix}-persistence-bar`}
        data-dirty={isDirty ? 'true' : 'false'}
        role="region"
        aria-label="Configuration save, discard, and reset controls"
      >
        <div className="f12-row-pair">
          <Tag status={validationErrors.length > 0 ? 'danger' : isDirty ? 'warning' : 'success'}>
            {validationErrors.length > 0
              ? `${validationErrors.length} VALIDATION ERROR(S)`
              : isDirty
                ? `UNSAVED CHANGES (${dirtySections.size})`
                : 'ALL CHANGES SAVED'}
          </Tag>
          <span className="f12-mono-note" id={`${resolvedIdPrefix}-dirty-status`}>
            {isDirty
              ? `Modified in: ${dirtySectionLabels.join(', ')} · Navigation guard armed (beforeunload + workspace switch)`
              : `Synchronized with in-memory snapshot REV-0${savedSnapshot.revision} (${draft.workspace.workspaceName})`}
          </span>
        </div>

        <div className="f12-row-pair">
          <Button
            id={`${resolvedIdPrefix}-save-btn`}
            type="button"
            variant="primary"
            size="sm"
            disabled={!isDirty && validationErrors.length === 0}
            onClick={() => handleSaveChanges()}
          >
            Save changes
          </Button>
          <Button
            id={`${resolvedIdPrefix}-discard-btn`}
            type="button"
            variant="secondary"
            size="sm"
            disabled={!isDirty}
            onClick={handleDiscardChanges}
          >
            Discard changes
          </Button>
          <Button
            id={`${resolvedIdPrefix}-reset-btn`}
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleResetDefaults}
          >
            Reset to defaults
          </Button>
        </div>
      </div>

      {/* ===================================================================== VALIDATION ERROR SUMMARY */}
      {showValidationSummary && validationErrors.length > 0 ? (
        <Alert
          id={`${resolvedIdPrefix}-validation-alert`}
          status="danger"
          title={`Cannot save configuration — ${validationErrors.length} field validation ${validationErrors.length === 1 ? 'error requires' : 'errors require'} attention`}
        >
          <div className="f12-stack-pair">
            <p className="f12-mono-note">
              Select an issue below to jump directly to the section and focus the invalid control:
            </p>
            <div className="f12-row-pair">
              {validationErrors.map((err) => (
                <Button
                  key={`${err.section}-${err.fieldIdSuffix}`}
                  id={`${resolvedIdPrefix}-jump-${err.fieldIdSuffix}`}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const targetFieldId = `${resolvedIdPrefix}-${err.fieldIdSuffix}`;
                    if (activeSection !== err.section) {
                      pendingFocusTargetIdRef.current = targetFieldId;
                      setActiveSection(err.section);
                    } else {
                      pendingFocusTargetIdRef.current = null;
                      const el = document.getElementById(targetFieldId);
                      if (el && typeof el.focus === 'function') {
                        el.focus();
                      }
                    }
                  }}
                >
                  {`${err.sectionLabel}: ${err.fieldLabel} →`}
                </Button>
              ))}
            </div>
          </div>
        </Alert>
      ) : null}

      {/* ===================================================================== 7 SETTINGS TABS (QUIET OPERATIONAL PRESENTATION) */}
      <Tabs
        id={`${resolvedIdPrefix}-tabs`}
        density="compact"
        value={activeSection}
        onValueChange={(val) => setActiveSection(val as SettingsSection)}
      >
        <TabsList aria-label="Workspace settings sections">
          <TabsTrigger value="profile" id={`${resolvedIdPrefix}-tabs-tab-profile`}>
            {`01 · Profile${dirtySections.has('profile') ? ' •' : ''}`}
          </TabsTrigger>
          <TabsTrigger value="workspace" id={`${resolvedIdPrefix}-tabs-tab-workspace`}>
            {`02 · Workspace${dirtySections.has('workspace') ? ' •' : ''}`}
          </TabsTrigger>
          <TabsTrigger value="notifications" id={`${resolvedIdPrefix}-tabs-tab-notifications`}>
            {`03 · Notifications${dirtySections.has('notifications') ? ' •' : ''}`}
          </TabsTrigger>
          <TabsTrigger value="appearance" id={`${resolvedIdPrefix}-tabs-tab-appearance`}>
            {`04 · Appearance${dirtySections.has('appearance') ? ' •' : ''}`}
          </TabsTrigger>
          <TabsTrigger value="motion" id={`${resolvedIdPrefix}-tabs-tab-motion`}>
            {`05 · Motion${dirtySections.has('motion') ? ' •' : ''}`}
          </TabsTrigger>
          <TabsTrigger value="team" id={`${resolvedIdPrefix}-tabs-tab-team`}>
            {`06 · Team & Roles (${effectiveMembers.length})${dirtySections.has('team') ? ' •' : ''}`}
          </TabsTrigger>
          <TabsTrigger value="danger-zone" id={`${resolvedIdPrefix}-tabs-tab-danger-zone`}>
            07 · Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* =============================================================== TAB 1: PROFILE */}
        <TabsContent value="profile">
          <Panel
            variant="quiet"
            label="Operator profile and signing identity"
            aria-busy={isLoadingDataset}
          >
            {isLoadingDataset ? (
              <div className="f12-stack-scene" id={`${resolvedIdPrefix}-loading-profile`}>
                <Skeleton width="35%" height={18} />
                <div className="f12-console-grid-2">
                  <Skeleton width="100%" height={56} />
                  <Skeleton width="100%" height={56} />
                </div>
                <Skeleton width="100%" height={96} />
              </div>
            ) : (
              <form
                className="f12-stack-scene"
                noValidate
                onSubmit={handleSaveChanges}
                aria-label="Operator profile settings form"
              >
                <div className="f12-row-between">
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <h2 className="f12-console-quiet-title">
                        01 · OPERATOR PROFILE &amp; SIGNING IDENTITY
                      </h2>
                      <Tag status={dirtySections.has('profile') ? 'warning' : 'neutral'}>
                        {dirtySections.has('profile') ? 'MODIFIED' : 'QUIET LEDGER'}
                      </Tag>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Identity metadata stamped onto control-plane audit logs, key rotations, and
                      incident handoffs.
                    </p>
                  </div>
                </div>

                <div className="f12-console-grid-2">
                  <Input
                    id={`${resolvedIdPrefix}-profile-name`}
                    density={draft.appearance.density}
                    label="Operator display name"
                    required
                    value={draft.profile.displayName}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, displayName: e.target.value },
                      }))
                    }
                    error={getFieldError('profile-name')}
                    hint="Shown in audit trail headers and approval signatures"
                  />

                  <Input
                    id={`${resolvedIdPrefix}-profile-handle`}
                    density={draft.appearance.density}
                    label="Operator handle"
                    required
                    value={draft.profile.handle}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, handle: e.target.value },
                      }))
                    }
                    error={getFieldError('profile-handle')}
                    hint="Must start with @ (e.g. @sora.takahashi)"
                  />
                </div>

                <div className="f12-console-grid-2">
                  <Input
                    id={`${resolvedIdPrefix}-profile-email`}
                    density={draft.appearance.density}
                    type="email"
                    label="Primary operator email"
                    required
                    value={draft.profile.email}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, email: e.target.value },
                      }))
                    }
                    error={getFieldError('profile-email')}
                    hint="Receives security notices and break-glass verification codes"
                  />

                  <Select
                    id={`${resolvedIdPrefix}-profile-role-title`}
                    density={draft.appearance.density}
                    label="On-call role classification"
                    value={draft.profile.roleTitle}
                    onValueChange={(val) =>
                      setDraft((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, roleTitle: val },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Principal Release Engineer">
                        Principal Release Engineer
                      </SelectItem>
                      <SelectItem value="Staff Platform Architect">
                        Staff Platform Architect
                      </SelectItem>
                      <SelectItem value="Security Operations Lead">
                        Security Operations Lead
                      </SelectItem>
                      <SelectItem value="Incident Commander">Incident Commander</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  id={`${resolvedIdPrefix}-profile-bio`}
                  density={draft.appearance.density}
                  label="Operator escalation bio & handoff note"
                  required
                  maxLength={240}
                  value={draft.profile.bio}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      profile: { ...prev.profile, bio: e.target.value },
                    }))
                  }
                  error={getFieldError('profile-bio')}
                  hint={`Minimum 10 characters (${draft.profile.bio.length}/240 chars). Included in on-call escalation dispatches.`}
                />

                <div className="f12-row-between">
                  <Switch
                    id={`${resolvedIdPrefix}-profile-signed-commits`}
                    density={draft.appearance.density}
                    label="Require cryptographic signature on configuration commits"
                    hint={`Verified against ED25519 key fingerprint (${draft.profile.pgpFingerprint})`}
                    checked={draft.profile.requireSignedCommits}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        profile: { ...prev.profile, requireSignedCommits: checked },
                      }))
                    }
                  />

                  <Button
                    id={`${resolvedIdPrefix}-profile-save-btn`}
                    type="submit"
                    variant="primary"
                    size="sm"
                  >
                    Save all changes
                  </Button>
                </div>
              </form>
            )}
          </Panel>
        </TabsContent>

        {/* =============================================================== TAB 2: WORKSPACE PREFERENCES */}
        <TabsContent value="workspace">
          <Panel
            variant="quiet"
            label="Workspace preferences, region, and retention policy"
            aria-busy={isLoadingDataset}
          >
            {isLoadingDataset ? (
              <div className="f12-stack-scene" id={`${resolvedIdPrefix}-loading-workspace`}>
                <Skeleton width="42%" height={18} />
                <div className="f12-console-grid-2">
                  <Skeleton width="100%" height={56} />
                  <Skeleton width="100%" height={56} />
                </div>
                <Skeleton width="100%" height={72} />
              </div>
            ) : (
              <form
                className="f12-stack-scene"
                noValidate
                onSubmit={handleSaveChanges}
                aria-label="Workspace preferences form"
              >
                <div className="f12-row-between">
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <h2 className="f12-console-quiet-title">
                        02 · WORKSPACE PREFERENCES &amp; SOVEREIGNTY
                      </h2>
                      <Tag status={dirtySections.has('workspace') ? 'warning' : 'neutral'}>
                        {dirtySections.has('workspace') ? 'MODIFIED' : 'QUIET LEDGER'}
                      </Tag>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Control workspace naming, canonical URL slug, primary deployment region, and
                      audit log retention windows.
                    </p>
                  </div>
                </div>

                <div className="f12-console-grid-2">
                  <Input
                    id={`${resolvedIdPrefix}-ws-name`}
                    density={draft.appearance.density}
                    label="Workspace display name"
                    required
                    value={draft.workspace.workspaceName}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        workspace: { ...prev.workspace, workspaceName: e.target.value },
                      }))
                    }
                    error={getFieldError('ws-name')}
                    hint="Printed in breadcrumbed headers and billing statements"
                  />

                  <Input
                    id={`${resolvedIdPrefix}-ws-slug`}
                    density={draft.appearance.density}
                    label="Workspace URL slug"
                    required
                    value={draft.workspace.slug}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        workspace: { ...prev.workspace, slug: e.target.value },
                      }))
                    }
                    error={getFieldError('ws-slug')}
                    hint="Lowercase letters, digits, and hyphens (e.g. atelier-koma-prod)"
                  />
                </div>

                <div className="f12-console-grid-2">
                  <Select
                    id={`${resolvedIdPrefix}-ws-region`}
                    density={draft.appearance.density}
                    label="Primary control-plane region"
                    value={draft.workspace.region}
                    onValueChange={(val) =>
                      setDraft((prev) => ({
                        ...prev,
                        workspace: { ...prev.workspace, region: val as WorkspaceRegion },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east-1">
                        us-east-1 · N. Virginia (Primary Global)
                      </SelectItem>
                      <SelectItem value="eu-central-1">
                        eu-central-1 · Frankfurt (GDPR Sovereign)
                      </SelectItem>
                      <SelectItem value="ap-northeast-1">
                        ap-northeast-1 · Tokyo (Low-Latency Edge)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    id={`${resolvedIdPrefix}-ws-currency`}
                    density={draft.appearance.density}
                    label="Billing & settlement currency"
                    value={draft.workspace.currency}
                    onValueChange={(val) =>
                      setDraft((prev) => ({
                        ...prev,
                        workspace: { ...prev.workspace, currency: val as WorkspaceCurrency },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($) · United States Dollar</SelectItem>
                      <SelectItem value="EUR">EUR (€) · Eurozone Settlement</SelectItem>
                      <SelectItem value="JPY">JPY (¥) · Japanese Yen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Field
                  id={`${resolvedIdPrefix}-ws-retention-field`}
                  density={draft.appearance.density}
                  label="Audit log & request trace retention window"
                  hint="Duration before immutable exposure-sheet traces roll into cold archival storage"
                >
                  <SegmentedControl
                    idPrefix={`${resolvedIdPrefix}-ws-retention`}
                    ariaLabel="Audit log retention window"
                    options={RETENTION_OPTIONS}
                    value={draft.workspace.retention}
                    onChange={(val) =>
                      setDraft((prev) => ({
                        ...prev,
                        workspace: { ...prev.workspace, retention: val },
                      }))
                    }
                  />
                </Field>

                <div className="f12-stack-pair">
                  <Switch
                    id={`${resolvedIdPrefix}-ws-strict-schema`}
                    density={draft.appearance.density}
                    label="Enforce strict v2 JSON schema validation at ingress"
                    hint="Reject unsigned or deprecated v1 webhook envelopes with HTTP 422 before queueing"
                    checked={draft.workspace.strictSchemaValidation}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        workspace: { ...prev.workspace, strictSchemaValidation: checked },
                      }))
                    }
                  />

                  <Switch
                    id={`${resolvedIdPrefix}-ws-dual-signoff`}
                    density={draft.appearance.density}
                    label="Require dual-operator signoff for production secret rotation"
                    hint="Requires a second Admin or Owner confirmation before revoking primary production keys"
                    checked={draft.workspace.dualOperatorSignoff}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        workspace: { ...prev.workspace, dualOperatorSignoff: checked },
                      }))
                    }
                  />
                </div>

                <div className="f12-row-between">
                  <span className="f12-mono-note">
                    {`Canonical URI: https://control.frame12.dev/${draft.workspace.slug || 'invalid-slug'}`}
                  </span>
                  <Button
                    id={`${resolvedIdPrefix}-ws-save-btn`}
                    type="submit"
                    variant="primary"
                    size="sm"
                  >
                    Save all changes
                  </Button>
                </div>
              </form>
            )}
          </Panel>
        </TabsContent>

        {/* =============================================================== TAB 3: NOTIFICATIONS */}
        <TabsContent value="notifications">
          <Panel
            variant="quiet"
            label="Notification routing, failure thresholds, and digest cadence"
            aria-busy={isLoadingDataset}
          >
            {isLoadingDataset ? (
              <div className="f12-stack-scene" id={`${resolvedIdPrefix}-loading-notifications`}>
                <Skeleton width="40%" height={18} />
                <Skeleton width="100%" height={90} />
                <div className="f12-console-grid-2">
                  <Skeleton width="100%" height={56} />
                  <Skeleton width="100%" height={56} />
                </div>
              </div>
            ) : (
              <form
                className="f12-stack-scene"
                noValidate
                onSubmit={handleSaveChanges}
                aria-label="Notification routing settings form"
              >
                <div className="f12-row-between">
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <h2 className="f12-console-quiet-title">
                        03 · ALERT ROUTING &amp; INCIDENT NOTIFICATIONS
                      </h2>
                      <Tag status={dirtySections.has('notifications') ? 'warning' : 'neutral'}>
                        {dirtySections.has('notifications') ? 'MODIFIED' : 'QUIET LEDGER'}
                      </Tag>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Configure outbound alert channels, error-rate trigger thresholds, and quiet
                      hours suppression.
                    </p>
                  </div>
                </div>

                <Field
                  id={`${resolvedIdPrefix}-notif-channels-group`}
                  density={draft.appearance.density}
                  label="Active alert delivery channels"
                  required
                  hint="Select at least one destination for SLO breach and circuit-breaker dispatches"
                  error={getFieldError('notif-ch-webhook')}
                >
                  <div className="f12-console-grid-2">
                    <Checkbox
                      id={`${resolvedIdPrefix}-notif-ch-webhook`}
                      density={draft.appearance.density}
                      label="Signed HTTPS Webhook"
                      hint="HMAC-SHA256 JSON payload to your ops endpoint"
                      checked={effectiveChannels.webhook}
                      onCheckedChange={(checked) => {
                        if (isEmptyDataset) setDatasetState('populated');
                        setDraft((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            channels: {
                              ...(isEmptyDataset
                                ? { webhook: false, email: false, pager: false, slack: false }
                                : prev.notifications.channels),
                              webhook: checked,
                            },
                          },
                        }));
                      }}
                    />
                    <Checkbox
                      id={`${resolvedIdPrefix}-notif-ch-email`}
                      density={draft.appearance.density}
                      label="Operations Digest Email"
                      hint="Dispatched to ops-digest@atelier-koma.io"
                      checked={effectiveChannels.email}
                      onCheckedChange={(checked) => {
                        if (isEmptyDataset) setDatasetState('populated');
                        setDraft((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            channels: {
                              ...(isEmptyDataset
                                ? { webhook: false, email: false, pager: false, slack: false }
                                : prev.notifications.channels),
                              email: checked,
                            },
                          },
                        }));
                      }}
                    />
                    <Checkbox
                      id={`${resolvedIdPrefix}-notif-ch-pager`}
                      density={draft.appearance.density}
                      label="On-Call Pager Escalation"
                      hint="Immediate wake-up page for Sev-1 5xx spikes"
                      checked={effectiveChannels.pager}
                      onCheckedChange={(checked) => {
                        if (isEmptyDataset) setDatasetState('populated');
                        setDraft((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            channels: {
                              ...(isEmptyDataset
                                ? { webhook: false, email: false, pager: false, slack: false }
                                : prev.notifications.channels),
                              pager: checked,
                            },
                          },
                        }));
                      }}
                    />
                    <Checkbox
                      id={`${resolvedIdPrefix}-notif-ch-slack`}
                      density={draft.appearance.density}
                      label="Incident Room Stream"
                      hint="Posts structured cut cards to #ops-frame12-ledger"
                      checked={effectiveChannels.slack}
                      onCheckedChange={(checked) => {
                        if (isEmptyDataset) setDatasetState('populated');
                        setDraft((prev) => ({
                          ...prev,
                          notifications: {
                            ...prev.notifications,
                            channels: {
                              ...(isEmptyDataset
                                ? { webhook: false, email: false, pager: false, slack: false }
                                : prev.notifications.channels),
                              slack: checked,
                            },
                          },
                        }));
                      }}
                    />
                  </div>
                </Field>

                <div className="f12-console-grid-2">
                  <Input
                    id={`${resolvedIdPrefix}-notif-webhook-url`}
                    density={draft.appearance.density}
                    label="Webhook dispatch endpoint URL"
                    required={effectiveChannels.webhook}
                    disabled={!effectiveChannels.webhook}
                    value={draft.notifications.webhookUrl}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, webhookUrl: e.target.value },
                      }))
                    }
                    error={
                      effectiveChannels.webhook ? getFieldError('notif-webhook-url') : undefined
                    }
                    hint={
                      effectiveChannels.webhook
                        ? 'Must use TLS 1.3 https:// endpoint'
                        : 'Optional while Signed HTTPS Webhook delivery is disabled'
                    }
                  />

                  <Input
                    id={`${resolvedIdPrefix}-notif-threshold`}
                    density={draft.appearance.density}
                    label="Failure rate alert threshold (%)"
                    required
                    value={draft.notifications.failureThresholdPct}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          failureThresholdPct: e.target.value,
                        },
                      }))
                    }
                    error={getFieldError('notif-threshold')}
                    hint="Allowed range: 1% to 50% (pages on-call when 5xx rate exceeds value)"
                  />
                </div>

                <RadioGroup
                  id={`${resolvedIdPrefix}-notif-cadence`}
                  density={draft.appearance.density}
                  label="Incident digest cadence"
                  value={draft.notifications.digestCadence}
                  onValueChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      notifications: {
                        ...prev.notifications,
                        digestCadence: val as DigestCadence,
                      },
                    }))
                  }
                  hint="Controls batching for non-critical [i] informational and [!] warning notices"
                >
                  <RadioGroupItem
                    value="realtime"
                    label="Immediate per-incident cut (0s buffer)"
                    hint="Every state transition dispatches an individual signed event immediately"
                  />
                  <RadioGroupItem
                    value="hourly"
                    label="Hourly exposure-sheet rollup"
                    hint="Consolidates warning drift into a single top-of-hour summary"
                  />
                  <RadioGroupItem
                    value="daily"
                    label="Daily 09:00 UTC ledger summary"
                    hint="Recommended for low-noise staging or archival environments"
                  />
                </RadioGroup>

                <div className="f12-row-between">
                  <Switch
                    id={`${resolvedIdPrefix}-notif-quiet-hours`}
                    density={draft.appearance.density}
                    label={`Enable quiet hours suppression (${draft.notifications.quietHoursWindow})`}
                    hint="Suppresses non-critical digests overnight; Sev-1 [×] danger alerts always bypass quiet hours"
                    checked={draft.notifications.quietHoursEnabled}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, quietHoursEnabled: checked },
                      }))
                    }
                  />

                  <Button
                    id={`${resolvedIdPrefix}-notif-save-btn`}
                    type="submit"
                    variant="primary"
                    size="sm"
                  >
                    Save all changes
                  </Button>
                </div>
              </form>
            )}
          </Panel>
        </TabsContent>

        {/* =============================================================== TAB 4: APPEARANCE */}
        <TabsContent value="appearance">
          <Panel
            variant="quiet"
            label="Theme polarity, operational density, and orthographic rule contrast"
            aria-busy={isLoadingDataset}
          >
            {isLoadingDataset ? (
              <div className="f12-stack-scene" id={`${resolvedIdPrefix}-loading-appearance`}>
                <Skeleton width="38%" height={18} />
                <Skeleton width="100%" height={110} />
                <Skeleton width="100%" height={80} />
              </div>
            ) : (
              <div className="f12-stack-scene">
                <div className="f12-row-between">
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <h2 className="f12-console-quiet-title">
                        04 · APPEARANCE &amp; ORTHOGRAPHIC DENSITY
                      </h2>
                      <Tag status={dirtySections.has('appearance') ? 'warning' : 'neutral'}>
                        {dirtySections.has('appearance') ? 'MODIFIED' : 'LIVE PREVIEW'}
                      </Tag>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Changes to theme polarity and control density apply immediately to this
                      settings sheet so you can evaluate visual fatigue before saving.
                    </p>
                  </div>
                </div>

                <RadioGroup
                  id={`${resolvedIdPrefix}-appearance-theme`}
                  density={draft.appearance.density}
                  label="Sheet theme polarity"
                  value={draft.appearance.themeMode}
                  onValueChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      appearance: {
                        ...prev.appearance,
                        themeMode: val as ThemePreference,
                      },
                    }))
                  }
                  hint="Select Light or Dark to preview directly on this sheet, or System to follow OS polarity"
                >
                  <RadioGroupItem
                    value="system"
                    label="System Default (OS prefers-color-scheme)"
                    hint="Automatically adapts between warm daylight paper and night studio carbon"
                  />
                  <RadioGroupItem
                    value="light"
                    label="Daylight Paper (Warm Cream Sheet · Sumi Ink)"
                    hint="High-legibility editorial paper tokens (--f-paper / --f-ink) for bright studios"
                  />
                  <RadioGroupItem
                    value="dark"
                    label="Night Studio (Carbon Sheet · Bone Ink)"
                    hint="Low-glare dark tokens calibrated for nocturnal on-call operations"
                  />
                </RadioGroup>

                <Field
                  id={`${resolvedIdPrefix}-appearance-density-field`}
                  density={draft.appearance.density}
                  label="Operational control & table density"
                  hint="Compact uses 1px subordinate rules and tight vertical padding; Comfortable uses standard editorial spacing"
                >
                  <SegmentedControl
                    idPrefix={`${resolvedIdPrefix}-appearance-density`}
                    ariaLabel="Operational control density"
                    options={DENSITY_OPTIONS}
                    value={draft.appearance.density}
                    onChange={(val) =>
                      setDraft((prev) => ({
                        ...prev,
                        appearance: { ...prev.appearance, density: val },
                      }))
                    }
                  />
                </Field>

                <div className="f12-stack-pair">
                  <Switch
                    id={`${resolvedIdPrefix}-appearance-reg-marks`}
                    density={draft.appearance.density}
                    label="Show exposure-sheet registration ticks and ruler header"
                    hint="Displays top punch-hole ticks and frame alignment marks along the sheet edge"
                    checked={draft.appearance.showRegistrationMarks}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        appearance: { ...prev.appearance, showRegistrationMarks: checked },
                      }))
                    }
                  />

                  <Switch
                    id={`${resolvedIdPrefix}-appearance-hc-rules`}
                    density={draft.appearance.density}
                    label="Reinforce quiet panel hairlines and status borders with 2px ink rules"
                    hint="Pairs [i] / [+] / [!] / [×] status glyphs with 2px solid, dashed, and double border rules across the sheet"
                    checked={draft.appearance.highContrastRules}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        appearance: { ...prev.appearance, highContrastRules: checked },
                      }))
                    }
                  />
                </div>

                <div
                  className="f12-settings-specimen"
                  id={`${resolvedIdPrefix}-appearance-specimen`}
                  aria-label="Live appearance calibration specimen"
                >
                  <div className="f12-row-between">
                    <span className="f12-console-quiet-title">
                      LIVE CALIBRATION SPECIMEN ({draft.appearance.themeMode.toUpperCase()} ·{' '}
                      {draft.appearance.density.toUpperCase()})
                    </span>
                    <div className="f12-row-pair">
                      <Tag status="success">NOMINAL</Tag>
                      <Tag status="warning">DRIFT</Tag>
                      <Tag status="danger">BREACH</Tag>
                    </div>
                  </div>
                  <p className="f12-mono-note">
                    {`Status glyphs, border patterns (solid / dashed / double), registration pegs (${draft.appearance.showRegistrationMarks ? 'ON' : 'OFF'}), and rule weight (${draft.appearance.highContrastRules ? '2PX REINFORCED' : '1PX QUIET'}) update live on this sheet.`}
                  </p>
                </div>

                <div className="f12-row-between">
                  <span className="f12-mono-note">
                    {`Active theme polarity: ${effectiveSheetTheme.toUpperCase()} (${draft.appearance.themeMode === 'system' ? 'OS prefers-color-scheme' : 'explicit override'})`}
                  </span>
                  <div className="f12-row-pair">
                    <Button
                      id={`${resolvedIdPrefix}-appearance-discard-btn`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!isDirty}
                      onClick={handleDiscardChanges}
                    >
                      Discard changes
                    </Button>
                    <Button
                      id={`${resolvedIdPrefix}-appearance-save-btn`}
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!isDirty && validationErrors.length === 0}
                      onClick={() => handleSaveChanges()}
                    >
                      Save all changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* =============================================================== TAB 5: MOTION PREFERENCES */}
        <TabsContent value="motion">
          <Panel
            variant="quiet"
            label="Motion timing grammar and reduced-motion accessibility"
            aria-busy={isLoadingDataset}
          >
            {isLoadingDataset ? (
              <div className="f12-stack-scene" id={`${resolvedIdPrefix}-loading-motion`}>
                <Skeleton width="40%" height={18} />
                <Skeleton width="100%" height={120} />
                <Skeleton width="100%" height={80} />
              </div>
            ) : (
              <div className="f12-stack-scene">
                <div className="f12-row-between">
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <h2 className="f12-console-quiet-title">
                        05 · MOTION GRAMMAR (ON TWOS · 12FPS VS 60FPS VS CUT)
                      </h2>
                      <Tag status={dirtySections.has('motion') ? 'warning' : 'neutral'}>
                        {dirtySections.has('motion') ? 'MODIFIED' : 'LIVE TIMING'}
                      </Tag>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Configure how state transitions, segmented indicators, and impact badges
                      animate across the sheet.
                    </p>
                  </div>
                </div>

                <RadioGroup
                  id={`${resolvedIdPrefix}-motion-mode`}
                  density={draft.appearance.density}
                  label="Primary animation timing grammar"
                  value={draft.motion.mode}
                  onValueChange={(val) =>
                    setDraft((prev) => ({
                      ...prev,
                      motion: { ...prev.motion, mode: val as MotionMode },
                    }))
                  }
                  hint="Updates the active Sheet motion prop immediately"
                >
                  <RadioGroupItem
                    value="stepped"
                    label="On Twos · 12fps Stepped (83.33ms discrete holds — Default)"
                    hint="Japanese limited-animation timing using CSS steps() with zero tween blur"
                  />
                  <RadioGroupItem
                    value="smooth"
                    label="Continuous · 60fps Interpolated"
                    hint="Standard cubic-bezier easing for comparison against stepped timing"
                  />
                  <RadioGroupItem
                    value="cut"
                    label="Editorial Cut · 0ms Instant"
                    hint="Hard cut between states with zero transition duration"
                  />
                </RadioGroup>

                <div className="f12-stack-pair">
                  <Switch
                    id={`${resolvedIdPrefix}-motion-charts`}
                    density={draft.appearance.density}
                    label="Enable stepped entry choreography on charts and sparklines"
                    hint="Animates posture metrics and stability sparklines when switching workspaces or saving revisions"
                    checked={draft.motion.animateCharts}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        motion: { ...prev.motion, animateCharts: checked },
                      }))
                    }
                  />

                  <Switch
                    id={`${resolvedIdPrefix}-motion-bursts`}
                    density={draft.appearance.density}
                    label="Enable 4-frame radial impact bursts on Expressive badges"
                    hint="Fires a brief sumi-ink burst when primary KPI or revision badges update"
                    checked={draft.motion.enableImpactBursts}
                    onCheckedChange={(checked) =>
                      setDraft((prev) => ({
                        ...prev,
                        motion: { ...prev.motion, enableImpactBursts: checked },
                      }))
                    }
                  />

                  <div
                    id={`${resolvedIdPrefix}-motion-reduced`}
                    className="f12-row-between"
                    role="note"
                    aria-label="OS prefers-reduced-motion accessibility guarantee"
                  >
                    <span className="f12-mono-note">
                      OS <code className="f12-code-inline">prefers-reduced-motion: reduce</code> is
                      always enforced by FRAME/12 and collapses all transitions to 0ms cuts.
                    </span>
                    <Tag status="success">ALWAYS ENFORCED</Tag>
                  </div>
                </div>

                <div
                  className="f12-settings-specimen"
                  id={`${resolvedIdPrefix}-motion-specimen`}
                  data-motion-chart={effectiveChartMotion}
                  aria-label="Interactive motion calibration strip"
                >
                  <div className="f12-row-between">
                    <div className="f12-row-pair">
                      <span className="f12-console-quiet-title">
                        MOTION CALIBRATION STRIP ({draft.motion.mode.toUpperCase()})
                      </span>
                      <Badge
                        pop={motionPoseChanged}
                        burst={draft.motion.enableImpactBursts && motionPoseChanged}
                      >
                        {`POSE #0${motionPoseCount}`}
                      </Badge>
                    </div>
                    <Button
                      id={`${resolvedIdPrefix}-trigger-pose-btn`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setMotionPoseCount((c) => c + 1)}
                    >
                      Trigger test pose
                    </Button>
                  </div>
                  <ToneSpark
                    values={draft.stabilitySpark.map((v, idx) =>
                      idx === draft.stabilitySpark.length - 1
                        ? Number(Math.min(100, v + (motionPoseCount % 3) * 0.4).toFixed(1))
                        : v,
                    )}
                    label="Motion calibration sparkline"
                    motion={effectiveChartMotion}
                  />
                  <p className="f12-mono-note">
                    {draft.motion.mode === 'stepped'
                      ? 'Active grammar: 12fps On Twos (83.33ms per drawing). State updates snap immediately; decorative motion holds discrete poses.'
                      : draft.motion.mode === 'smooth'
                        ? 'Active grammar: 60fps continuous cubic-bezier interpolation.'
                        : 'Active grammar: 0ms hard cut. Zero decorative animation.'}
                  </p>
                </div>

                <div className="f12-row-between">
                  <span className="f12-mono-note">
                    {`Chart choreography: ${effectiveChartMotion.toUpperCase()} · Impact bursts: ${draft.motion.enableImpactBursts ? 'ENABLED' : 'OFF'}`}
                  </span>
                  <div className="f12-row-pair">
                    <Button
                      id={`${resolvedIdPrefix}-motion-discard-btn`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!isDirty}
                      onClick={handleDiscardChanges}
                    >
                      Discard changes
                    </Button>
                    <Button
                      id={`${resolvedIdPrefix}-motion-save-btn`}
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!isDirty && validationErrors.length === 0}
                      onClick={() => handleSaveChanges()}
                    >
                      Save all changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* =============================================================== TAB 6: TEAM & ROLES */}
        <TabsContent value="team">
          <div className="f12-stack-scene">
            <Panel
              variant="quiet"
              label="Invite operator to workspace"
              aria-busy={isLoadingDataset}
            >
              <form
                className="f12-stack-pair"
                noValidate
                onSubmit={handleInviteMember}
                aria-label="Invite workspace member form"
              >
                <div className="f12-row-between">
                  <div className="f12-stack-pair">
                    <div className="f12-row-pair">
                      <h2 className="f12-console-quiet-title">
                        INVITE OPERATOR TO WORKSPACE ROSTER
                      </h2>
                      <Tag status="neutral">SIMULATED INVITE</Tag>
                    </div>
                    <p className="f12-console-quiet-sub">
                      Add an operator to the in-memory workspace roster and assign their RBAC
                      authorization level.
                    </p>
                  </div>
                </div>

                <div className="f12-console-filters">
                  <Input
                    id={`${resolvedIdPrefix}-invite-email`}
                    density={draft.appearance.density}
                    type="email"
                    label="Invitee email address"
                    placeholder="operator@atelier-koma.io"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      if (inviteError) setInviteError(undefined);
                    }}
                    error={inviteError}
                  />

                  <Input
                    id={`${resolvedIdPrefix}-invite-name`}
                    density={draft.appearance.density}
                    label="Display name (optional)"
                    placeholder="Akira Sato"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />

                  <Select
                    id={`${resolvedIdPrefix}-invite-role`}
                    density={draft.appearance.density}
                    label="Assigned role"
                    value={inviteRole}
                    onValueChange={(val) => setInviteRole(val as MemberRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin · Full config &amp; keys</SelectItem>
                      <SelectItem value="Operator">Operator · Routing &amp; replays</SelectItem>
                      <SelectItem value="Auditor">Auditor · Read-only ledger</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    id={`${resolvedIdPrefix}-invite-submit`}
                    type="submit"
                    variant="primary"
                    size="sm"
                  >
                    Send invite
                  </Button>
                </div>
              </form>
            </Panel>

            <Panel
              variant="quiet"
              label="Workspace member directory and role assignments"
              aria-busy={isLoadingDataset}
            >
              {isLoadingDataset ? (
                <div className="f12-stack-pair" id={`${resolvedIdPrefix}-loading-team`}>
                  <Skeleton width="45%" height={18} />
                  <Skeleton width="100%" height={140} />
                </div>
              ) : (
                <div className="f12-stack-pair">
                  <div className="f12-console-toolbar">
                    <div className="f12-stack-pair">
                      <div className="f12-row-pair">
                        <h2 className="f12-console-quiet-title">
                          06 · WORKSPACE MEMBER DIRECTORY &amp; RBAC ROLES
                        </h2>
                        <Tag status={dirtySections.has('team') ? 'warning' : 'neutral'}>
                          {`${filteredMembers.length} OF ${effectiveMembers.length} SHOWN`}
                        </Tag>
                      </div>
                      <p className="f12-console-quiet-sub">
                        Primary Owner role is locked to prevent orphaned workspaces. Role changes
                        and removals are tracked in the unsaved draft bar.
                      </p>
                    </div>

                    <div className="f12-row-pair">
                      <Input
                        id={`${resolvedIdPrefix}-member-search`}
                        density="compact"
                        type="search"
                        label="Filter members"
                        placeholder="Name, handle, email…"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                      />

                      <Select
                        id={`${resolvedIdPrefix}-member-role-filter`}
                        density="compact"
                        label="Filter by role"
                        value={memberRoleFilter}
                        onValueChange={(val) => setMemberRoleFilter(val as MemberRoleFilter)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All roles ({effectiveMembers.length})</SelectItem>
                          <SelectItem value="Owner">Owner</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Operator">Operator</SelectItem>
                          <SelectItem value="Auditor">Auditor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {filteredMembers.length === 0 ? (
                    <EmptyState
                      id={`${resolvedIdPrefix}-member-empty`}
                      code="ROSTER FILTER · 0 MATCHES"
                      title="No workspace members match the current filter"
                      description={
                        isEmptyDataset
                          ? 'The sandbox dataset is currently in empty mode. Populate the default roster or send an invitation above.'
                          : `No members matched "${memberSearch}" with role filter "${memberRoleFilter}".`
                      }
                      action={
                        isEmptyDataset ? (
                          <Button
                            id={`${resolvedIdPrefix}-team-populate-btn`}
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-member-search`;
                              setDatasetState('populated');
                            }}
                          >
                            Populate default roster
                          </Button>
                        ) : (
                          <Button
                            id={`${resolvedIdPrefix}-clear-member-filters`}
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              pendingFocusTargetIdRef.current = `${resolvedIdPrefix}-member-search`;
                              setMemberSearch('');
                              setMemberRoleFilter('all');
                            }}
                          >
                            Reset member filters
                          </Button>
                        )
                      }
                    />
                  ) : (
                    <Table density={draft.appearance.density}>
                      <TableCaption>
                        Workspace operator roster, RBAC role assignments, and 2FA verification
                        status
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col">Operator</TableHead>
                          <TableHead scope="col">Email &amp; Handle</TableHead>
                          <TableHead scope="col">Assigned Role</TableHead>
                          <TableHead scope="col">2FA Posture</TableHead>
                          <TableHead scope="col">Status</TableHead>
                          <TableHead scope="col">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>
                              <strong>{member.name}</strong>
                              <div className="f12-mono-note">{member.lastSeen}</div>
                            </TableCell>
                            <TableCell>
                              <div>{member.email}</div>
                              <code className="f12-code-inline">{member.handle}</code>
                            </TableCell>
                            <TableCell>
                              {member.isPrimaryOwner ? (
                                <Tag status="info">OWNER (PRIMARY)</Tag>
                              ) : (
                                <Select
                                  id={`${resolvedIdPrefix}-role-${member.id}`}
                                  density="compact"
                                  value={member.role}
                                  onValueChange={(val) =>
                                    handleMemberRoleChange(member.id, val as MemberRole)
                                  }
                                >
                                  <SelectTrigger aria-label={`Assigned role for ${member.name}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Owner">Owner</SelectItem>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                    <SelectItem value="Operator">Operator</SelectItem>
                                    <SelectItem value="Auditor">Auditor</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tag status={member.mfaEnabled ? 'success' : 'warning'}>
                                {member.mfaEnabled ? 'HARDWARE 2FA' : 'PENDING 2FA'}
                              </Tag>
                            </TableCell>
                            <TableCell>
                              <Tag status={member.status === 'ACTIVE' ? 'neutral' : 'info'}>
                                {member.status}
                              </Tag>
                            </TableCell>
                            <TableCell>
                              {member.isPrimaryOwner ? (
                                <span className="f12-mono-note">Protected</span>
                              ) : (
                                <Button
                                  id={`${resolvedIdPrefix}-remove-${member.id}`}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setMemberPendingRemoval(member)}
                                >
                                  {member.status === 'INVITED' ? 'Revoke' : 'Remove'}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4}>Total Workspace Seats Allocated</TableCell>
                          <TableCell colSpan={2}>
                            {`${effectiveMembers.length} of ${MAX_WORKSPACE_SEATS} seats (${Math.max(0, MAX_WORKSPACE_SEATS - effectiveMembers.length)} available)`}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  )}
                </div>
              )}
            </Panel>
          </div>
        </TabsContent>

        {/* =============================================================== TAB 7: DANGER ZONE */}
        <TabsContent value="danger-zone">
          <Panel
            variant="quiet"
            label="High-impact workspace lifecycle and destructive actions"
            aria-busy={isLoadingDataset}
          >
            {isLoadingDataset ? (
              <div className="f12-stack-pair" id={`${resolvedIdPrefix}-loading-danger`}>
                <Skeleton width="45%" height={18} />
                <Skeleton width="100%" height={160} />
              </div>
            ) : (
              <div className="f12-stack-scene">
                <Notice
                  status="danger"
                  title="07 · Danger Zone — High-Impact Simulated Operations"
                >
                  Actions in this ledger require explicit confirmation via modal dialog before
                  executing. All effects are scoped strictly to this browser session&apos;s
                  in-memory sandbox state.
                </Notice>

                <div>
                  <div className="f12-settings-danger-row">
                    <div className="f12-stack-pair">
                      <div className="f12-row-pair">
                        <span className="f12-console-quiet-title">
                          ROTATE WORKSPACE WEBHOOK SIGNING SECRET
                        </span>
                        <Tag status="warning">
                          {`SECRET v${draft.lifecycle.signingSecretRevision}`}
                        </Tag>
                      </div>
                      <p className="f12-console-quiet-sub">
                        Current active secret:{' '}
                        <code
                          className="f12-code-inline"
                          id={`${resolvedIdPrefix}-signing-secret-val`}
                        >
                          {draft.lifecycle.signingSecretMasked}
                        </code>
                        . Generates a new HMAC-SHA256 signing key and schedules the previous key
                        for expiration.
                      </p>
                    </div>
                    <Button
                      id={`${resolvedIdPrefix}-danger-rotate-btn`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setDangerDialogMode('rotate-secret')}
                    >
                      Rotate signing secret…
                    </Button>
                  </div>

                  <div className="f12-settings-danger-row">
                    <div className="f12-stack-pair">
                      <div className="f12-row-pair">
                        <span className="f12-console-quiet-title">
                          PURGE BUFFERED TELEMETRY &amp; REPLAY CACHE
                        </span>
                        <Tag status={effectiveBufferedEvents > 0 ? 'info' : 'neutral'}>
                          {`${effectiveBufferedEvents.toLocaleString()} EVENTS`}
                        </Tag>
                      </div>
                      <p className="f12-console-quiet-sub">
                        Immediately evicts all cached webhook replay payloads and dead-letter queue
                        snapshots for{' '}
                        <code className="f12-code-inline">{draft.workspace.workspaceName}</code>.
                      </p>
                    </div>
                    <Button
                      id={`${resolvedIdPrefix}-danger-purge-btn`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={effectiveBufferedEvents === 0}
                      onClick={() => setDangerDialogMode('purge-cache')}
                    >
                      {effectiveBufferedEvents === 0
                        ? 'Cache already empty'
                        : 'Purge telemetry cache…'}
                    </Button>
                  </div>

                  <div className="f12-settings-danger-row">
                    <div className="f12-stack-pair">
                      <div className="f12-row-pair">
                        <span className="f12-console-quiet-title">
                          ARCHIVE &amp; RESET WORKSPACE CONFIGURATION
                        </span>
                        <Tag status="danger">DESTRUCTIVE</Tag>
                        {draft.lifecycle.archivedAt ? (
                          <Tag status="neutral">{draft.lifecycle.archivedAt}</Tag>
                        ) : null}
                      </div>
                      <p className="f12-console-quiet-sub">
                        Requires typing the saved workspace slug (
                        <code className="f12-code-inline">{targetArchiveSlug}</code>) to confirm.
                        Clears custom edits, evicts buffered events, and resets the workspace to
                        factory baseline posture.
                      </p>
                    </div>
                    <Button
                      id={`${resolvedIdPrefix}-danger-archive-btn`}
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setArchiveConfirmSlug('');
                        setArchiveSlugError(undefined);
                        setDangerDialogMode('archive-workspace');
                      }}
                    >
                      Archive &amp; reset workspace…
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      {/* ===================================================================== C-02: NAVIGATION GUARD DIALOG */}
      <Dialog
        open={pendingWorkspaceTarget !== null || pendingNavigationHref !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingWorkspaceTarget(null);
            setPendingNavigationHref(null);
            pendingNavigationAnchorRef.current = null;
          }
        }}
      >
        <DialogContent
          cut="C-02"
          id={`${resolvedIdPrefix}-nav-guard-dialog`}
          style={{ width: 'min(520px, calc(100vw - 32px))' }}
        >
          <DialogHeader>
            <DialogTitle>Unsaved Configuration Changes</DialogTitle>
            <DialogDescription>
              {pendingNavigationHref
                ? `You have unsaved edits in ${dirtySectionLabels.join(', ')}. Leaving ${draft.workspace.workspaceName} for "${pendingNavigationHref}" will discard your current draft.`
                : `You have unsaved edits in ${dirtySectionLabels.join(', ')}. Switching workspace targets will discard your current draft for ${draft.workspace.workspaceName}.`}
            </DialogDescription>
          </DialogHeader>
          <Notice status="warning" title="Navigation guard active">
            Save your changes first if you want to keep them in this workspace&apos;s snapshot, or
            discard the draft to proceed immediately.
          </Notice>
          <DialogFooter>
            <DialogClose
              id={`${resolvedIdPrefix}-nav-guard-stay`}
              type="button"
              variant="secondary"
              size="sm"
            >
              Stay &amp; review changes
            </DialogClose>
            <Button
              id={`${resolvedIdPrefix}-nav-guard-discard`}
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (pendingWorkspaceTarget) {
                  applyWorkspaceSwitch(pendingWorkspaceTarget, true);
                  return;
                }
                if (pendingNavigationHref) {
                  const targetHref = pendingNavigationHref;
                  const anchor = pendingNavigationAnchorRef.current;
                  if (idPrefix) {
                    CLIENT_ROUTE_DRAFT_CACHE.delete(idPrefix);
                  }
                  setDraft(cloneSnapshot(savedSnapshot));
                  setShowValidationSummary(false);
                  setInviteError(undefined);
                  setPendingNavigationHref(null);
                  pendingNavigationAnchorRef.current = null;
                  bypassRouteGuardRef.current = true;
                  window.requestAnimationFrame(() => {
                    if (anchor && anchor.isConnected) {
                      anchor.click();
                    } else if (typeof window !== 'undefined') {
                      window.location.assign(targetHref);
                    }
                    window.setTimeout(() => {
                      bypassRouteGuardRef.current = false;
                    }, 100);
                  });
                }
              }}
            >
              {pendingNavigationHref ? 'Discard draft & leave' : 'Discard draft & switch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== C-03: MEMBER REMOVAL CONFIRMATION DIALOG */}
      <Dialog
        open={memberPendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setMemberPendingRemoval(null);
        }}
      >
        <DialogContent
          cut="C-03"
          id={`${resolvedIdPrefix}-remove-member-dialog`}
          style={{ width: 'min(520px, calc(100vw - 32px))' }}
        >
          <DialogHeader>
            <DialogTitle>
              {memberPendingRemoval?.status === 'INVITED'
                ? 'Revoke Pending Invitation'
                : 'Remove Workspace Operator'}
            </DialogTitle>
            <DialogDescription>
              {memberPendingRemoval
                ? `Confirm removal of ${memberPendingRemoval.name} (${memberPendingRemoval.email}) from ${draft.workspace.workspaceName}.`
                : 'Confirm operator removal.'}
            </DialogDescription>
          </DialogHeader>
          <Notice status="danger" title="Simulated RBAC revocation">
            {memberPendingRemoval
              ? `This removes ${memberPendingRemoval.handle} (${memberPendingRemoval.role}) from the workspace draft roster.`
              : 'This removes the selected operator from the workspace roster.'}
          </Notice>
          <DialogFooter>
            <DialogClose
              id={`${resolvedIdPrefix}-remove-member-cancel`}
              type="button"
              variant="secondary"
              size="sm"
            >
              Cancel
            </DialogClose>
            <Button
              id={`${resolvedIdPrefix}-remove-member-confirm`}
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmMemberRemoval}
            >
              Confirm removal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== C-04: DANGER ZONE CONFIRMATION DIALOG */}
      <Dialog
        open={dangerDialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDangerDialogMode(null);
            setArchiveSlugError(undefined);
          }
        }}
      >
        <DialogContent
          cut="C-04"
          id={`${resolvedIdPrefix}-danger-dialog`}
          style={{ width: 'min(540px, calc(100vw - 32px))' }}
        >
          <DialogHeader>
            <DialogTitle>
              {dangerDialogMode === 'rotate-secret'
                ? 'Confirm Webhook Signing Secret Rotation'
                : dangerDialogMode === 'purge-cache'
                  ? 'Confirm Telemetry Cache Purge'
                  : 'Confirm Workspace Archive & Reset'}
            </DialogTitle>
            <DialogDescription>
              {dangerDialogMode === 'rotate-secret'
                ? `Issue signing secret v${draft.lifecycle.signingSecretRevision + 1} for ${draft.workspace.workspaceName}.`
                : dangerDialogMode === 'purge-cache'
                  ? `Evict ${effectiveBufferedEvents.toLocaleString()} buffered replay events from ${draft.workspace.workspaceName}.`
                  : `Type "${targetArchiveSlug}" below to confirm archiving and resetting ${draft.workspace.workspaceName} in this sandbox session.`}
            </DialogDescription>
          </DialogHeader>

          <form className="f12-stack-pair" noValidate onSubmit={handleConfirmDangerAction}>
            <Notice
              status={dangerDialogMode === 'archive-workspace' ? 'danger' : 'warning'}
              title="Simulated lifecycle operation"
            >
              {dangerDialogMode === 'rotate-secret'
                ? 'Downstream webhook consumers must update their HMAC verification secret within the 15-minute grace window.'
                : dangerDialogMode === 'purge-cache'
                  ? 'Purged replay payloads cannot be re-dispatched from the local cache until new traffic arrives.'
                  : 'All unsaved edits and custom roster changes in this workspace will be reset to baseline.'}
            </Notice>

            {dangerDialogMode === 'archive-workspace' ? (
              <Input
                id={`${resolvedIdPrefix}-archive-confirm-input`}
                density="compact"
                label={`Type "${targetArchiveSlug}" to confirm`}
                required
                value={archiveConfirmSlug}
                onChange={(e) => {
                  setArchiveConfirmSlug(e.target.value);
                  if (archiveSlugError) setArchiveSlugError(undefined);
                }}
                error={archiveSlugError}
                hint={`Enter exact workspace slug (${targetArchiveSlug}) to unlock confirmation`}
              />
            ) : null}

            <DialogFooter>
              <DialogClose
                id={`${resolvedIdPrefix}-danger-dialog-cancel`}
                type="button"
                variant="secondary"
                size="sm"
              >
                Cancel
              </DialogClose>
              <Button
                id={`${resolvedIdPrefix}-danger-dialog-confirm`}
                type="submit"
                variant="primary"
                size="sm"
              >
                {dangerDialogMode === 'rotate-secret'
                  ? 'Rotate secret now'
                  : dangerDialogMode === 'purge-cache'
                    ? 'Purge cache now'
                    : 'Confirm archive & reset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {footerSlot}
    </Sheet>
  );
}

export function WorkspaceSettings(props: WorkspaceSettingsProps) {
  const existingToast = useOptionalToast();
  if (existingToast) {
    return <WorkspaceSettingsInner {...props} />;
  }
  return (
    <ToastProvider>
      <WorkspaceSettingsInner {...props} />
    </ToastProvider>
  );
}
