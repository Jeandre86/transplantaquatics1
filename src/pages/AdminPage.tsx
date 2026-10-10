import SortableTable from '../components/SortableTable';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, Award, Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, History, LayoutDashboard, LogOut, Mail, Newspaper, RefreshCw, Search, Settings, Shield, Sparkles, Upload, UsersRound, X } from 'lucide-react';
import PageHeading from '../components/PageHeading';
import PageLoading from '../components/PageLoading';
import EmptyState from '../components/EmptyState';
import Logo from '../components/Logo';
import AdminArticleComposer from '../components/AdminArticleComposer';
import AdminArticleLibrary from '../components/AdminArticleLibrary';
import AdminAdCampaigns from '../components/AdminAdCampaigns';
import AdminMeetsManager, { type AdminMeet } from '../components/AdminMeetsManager';
import AdminHistoricalImport from '../components/AdminHistoricalImport';
import AdminSwimmersManager from '../components/AdminSwimmersManager';
import AdminDataQueries, { type DataQualityQueryPreset } from '../components/AdminDataQueries';
import AdminAboutContent from '../components/AdminAboutContent';
import AdminDataQuality, { getAdminDataQualityIssues } from '../components/AdminDataQuality';
import AdminContactInbox from '../components/AdminContactInbox';
import { useAuth } from '../contexts/AuthContext';
import { hasSupabaseConfig, supabase, describeSupabaseError } from '../lib/supabase';
import { permissionsForRole } from '../lib/adminImports';
import { loadPublicSwimmerDirectory, loadPublicSubmittedResults } from '../lib/swimmerSubmissions';
import { loadClubRecords, type ClubRecord } from '../lib/clubs';

type Tab = 'Overview' | 'Data queries' | 'Imports' | 'Historical archive' | 'Swimmers' | 'Meets and results' | 'Profile claims' | 'Records' | 'Writers' | 'Write article' | 'Article library' | 'Articles' | 'Ads' | 'About page' | 'Contact inbox' | 'Roles and permissions' | 'Activity log' | 'Verify results' | 'Data quality' | 'Clubs' | 'Site settings';
type Batch = { id: string; status: string; progress: string; error_message: string | null; stage_count: number; published_count: number; file_name: string | null; created_at: string; published_at: string | null; meet_catalog_id: string; source_url: string | null };
type Meet = AdminMeet;
type ImportResult = { id: string; swimmer_source_key: string | null; swimmer_name: string; country: string | null; event: string; age_group: string | null; gender: string | null; course: string | null; time_original: string | null; time_ms: number | null; race_status: string; is_relay: boolean; round_name: string | null; placing: string | null; validation_state: string; validation_issues: string[]; review_action: string; linked_swimmer_id: string | null; source_references: unknown[] };
type StagedSwimmer = { id: string; source_key: string; first_name: string; last_name: string; country: string | null; resolved_swimmer_id: string | null; resolution: string };
type AdminNotification = { id: string; event_type: 'new_user' | 'profile_claim'; title: string; message: string; subject_id: string; created_at: string };

const navigationGroups: { label: string; items: { tab: Tab; label: string; icon: typeof LayoutDashboard; countKey?: string }[] }[] = [
  { label: 'Workspace', items: [{ tab: 'Overview', label: 'Overview', icon: LayoutDashboard }] },
  { label: 'Results', items: [
    { tab: 'Verify results', label: 'Verify results', icon: CheckCircle2 },
    { tab: 'Imports', label: 'Import results', icon: Upload },
    { tab: 'Data quality', label: 'Data quality', icon: Sparkles },
    { tab: 'Records', label: 'Record candidates', icon: Award, countKey: 'record_candidates' },
  ] },
  { label: 'Directory', items: [
    { tab: 'Swimmers', label: 'Swimmers', icon: UsersRound },
    { tab: 'Meets and results', label: 'Meets', icon: CalendarDays },
    { tab: 'Clubs', label: 'Clubs', icon: Building2, countKey: 'clubs' },
  ] },
  { label: 'Content', items: [
    { tab: 'Article library', label: 'Articles', icon: Newspaper },
    { tab: 'About page', label: 'Pages', icon: Newspaper },
    { tab: 'Contact inbox', label: 'Contact inbox', icon: Mail },
    { tab: 'Ads', label: 'Campaigns', icon: Newspaper },
  ] },
  { label: 'Settings', items: [
    { tab: 'Roles and permissions', label: 'Team & roles', icon: Shield },
    { tab: 'Site settings', label: 'Site settings', icon: Settings },
    { tab: 'Activity log', label: 'Audit log', icon: History },
  ] },
];

const tabAliases: Record<string, Tab> = {
  overview: 'Overview', verify: 'Verify results', 'verify-results': 'Verify results',
  new: 'Imports', import: 'Imports', imports: 'Imports', 'results-imports': 'Imports',
  archive: 'Imports', 'historical-archive': 'Imports',
  quality: 'Data quality', 'data-quality': 'Data quality', 'data-queries': 'Data queries',
  swimmers: 'Swimmers', meets: 'Meets and results', clubs: 'Clubs',
  claims: 'Swimmers', 'profile-claims': 'Swimmers', records: 'Records',
  articles: 'Article library', content: 'Article library', pages: 'About page', campaigns: 'Ads',
  contact: 'Contact inbox', 'contact-inbox': 'Contact inbox',
  'article-review': 'Articles', 'article-library': 'Article library', 'about-page': 'About page',
  'ads-and-campaigns': 'Ads', writers: 'Writers', team: 'Roles and permissions', members: 'Roles and permissions',
  'roles-and-permissions': 'Roles and permissions', settings: 'Site settings',
  'site-settings': 'Site settings', audit: 'Activity log', 'audit-log': 'Activity log', 'activity-log': 'Activity log',
  editor: 'Write article', 'write-article': 'Write article',
};

const tabQueryValue: Partial<Record<Tab, string>> = {
  Overview: 'overview', 'Verify results': 'verify', Imports: 'new', 'Historical archive': 'archive',
  'Data quality': 'quality', Swimmers: 'swimmers', 'Meets and results': 'meets', Clubs: 'clubs',
  'Profile claims': 'claims', Records: 'records', Articles: 'article-review',
  'Article library': 'articles', 'About page': 'pages', Ads: 'campaigns',
  'Contact inbox': 'contact',
  'Write article': 'editor', 'Roles and permissions': 'team', 'Writers': 'writers',
  'Site settings': 'settings', 'Activity log': 'audit', 'Data queries': 'data-queries',
};
const cardStyle = { border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' };
const inputClass = 'w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const compactCount = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value).toLowerCase();

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = tabAliases[(searchParams.get('tab') ?? 'overview').toLowerCase()] ?? 'Overview';
  const tab = requestedTab;
  const setTab = (next: Tab) => { if (next === 'Profile claims') setSwimmersView('claims'); if (next === 'Verify results') setVerificationPage(0); setSearchParams({ tab: tabQueryValue[next] ?? 'overview' }, { replace: true }); };
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchBusy, setGlobalSearchBusy] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<{ label: string; detail: string; href: string }[]>([]);
  const [verifyTab, setVerifyTab] = useState<'batch' | 'submissions'>('batch');
  const [importView, setImportView] = useState<'new' | 'archive'>(() => ['archive','historical-archive'].includes(searchParams.get('tab') ?? '') ? 'archive' : 'new');
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [archiveImportOpen, setArchiveImportOpen] = useState(false);
  const [swimmersView, setSwimmersView] = useState<'all' | 'claims' | 'unclaimed' | 'duplicates'>(() => searchParams.get('tab') === 'claims' || searchParams.get('tab') === 'profile-claims' ? 'claims' : (searchParams.get('view') as 'all' | 'unclaimed' | 'duplicates') || 'all');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [currentRole, setCurrentRole] = useState('administrator');
  const [currentUserId,setCurrentUserId]=useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [meets, setMeets] = useState<Meet[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [rows, setRows] = useState<ImportResult[]>([]);
  const [stagedSwimmers,setStagedSwimmers]=useState<StagedSwimmer[]>([]);
  const [search, setSearch] = useState('');
  const [swimmerMatches, setSwimmerMatches] = useState<Record<string, { id: string; first_name: string; last_name: string; country: string; gender: string | null }[]>>({});
  const [identityEvidence,setIdentityEvidence]=useState<Record<string,string>>({});
  const [busyRow, setBusyRow] = useState('');
  const [selectedMeetId, setSelectedMeetId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [claimRows, setClaimRows] = useState<Record<string, unknown>[]>([]);
  const [recordRows, setRecordRows] = useState<Record<string, unknown>[]>([]);
  const [activityRows, setActivityRows] = useState<Record<string, unknown>[]>([]);
  const [expandedAuditGroups, setExpandedAuditGroups] = useState<string[]>([]);
  const [auditFilter, setAuditFilter] = useState<'All' | 'Swimmers' | 'Imports' | 'Meets' | 'Content'>('All');
  const [teamView, setTeamView] = useState<'members' | 'permissions'>('members');
  const [qualityView, setQualityView] = useState<'issues' | 'query'>('issues');
  const [qualityQueryPreset, setQualityQueryPreset] = useState<DataQualityQueryPreset | null>(null);
  const [recentActivityRows, setRecentActivityRows] = useState<Record<string, unknown>[]>([]);
  const [verificationRows, setVerificationRows] = useState<Record<string, unknown>[]>([]);
  const [verificationCount, setVerificationCount] = useState(0);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationPage, setVerificationPage] = useState(0);
  const [selectedVerificationIds, setSelectedVerificationIds] = useState<string[]>([]);
  const [allPendingResultsSelected, setAllPendingResultsSelected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [swimmerRows, setSwimmerRows] = useState<Record<string, unknown>[]>([]);
  const [clubRows, setClubRows] = useState<ClubRecord[]>([]);
  const [clubCount, setClubCount] = useState<number | null>(null);
  const [swimmerAdminRpcAvailable, setSwimmerAdminRpcAvailable] = useState(false);
  const [memberRows,setMemberRows]=useState<Record<string,unknown>[]>([]);
  const [memberOverrides,setMemberOverrides]=useState<Record<string,Record<string,boolean>>>({});
  const [accountQuery,setAccountQuery]=useState('');
  const [accountMatches,setAccountMatches]=useState<Record<string,unknown>[]>([]);
  const [newRole,setNewRole]=useState('administrator');
  const [recordEvidence,setRecordEvidence]=useState<Record<string,string>>({});
  const [canManageWriters,setCanManageWriters]=useState(false);
  const [canManageArticles,setCanManageArticles]=useState(false);
  const [canImportResults,setCanImportResults]=useState(false);
  const [canPublishResults,setCanPublishResults]=useState(false);
  const [canReviewClaims,setCanReviewClaims]=useState(false);
  const [canConfirmRecords,setCanConfirmRecords]=useState(false);
  const [canManageRoles,setCanManageRoles]=useState(false);
  const [canManageSwimmers,setCanManageSwimmers]=useState(false);
  const [selectedArticleId,setSelectedArticleId]=useState('');
  const [writerRows,setWriterRows]=useState<Record<string,unknown>[]>([]);
  const [submittedArticles,setSubmittedArticles]=useState<Record<string,unknown>[]>([]);
  const [writerEmail,setWriterEmail]=useState('');
  const [writerDisplayName,setWriterDisplayName]=useState('');
  const [articleNotes,setArticleNotes]=useState<Record<string,string>>({});
  const [notificationRows,setNotificationRows]=useState<AdminNotification[]>([]);
  const [readNotificationIds,setReadNotificationIds]=useState<string[]>([]);
  const [profileMenuOpen,setProfileMenuOpen]=useState(false);
  const auth=useAuth();
  const navigate=useNavigate();
  const unreadNotifications=notificationRows.filter(item=>!readNotificationIds.includes(item.id));

  useEffect(() => {
    if (!searchParams.get('tab')) setSearchParams({ tab: tabQueryValue[requestedTab] ?? 'overview' }, { replace: true });
  }, [requestedTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    loadClubRecords().then(rows => { if (active) { setClubRows(rows); setClubCount(rows.length); } }).catch(() => { if (active) setClubCount(0); });
    return () => { active = false; };
  }, [authorized]);

  useEffect(() => {
    const term = globalSearch.trim().toLocaleLowerCase();
    if (!term) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setGlobalSearchBusy(true);
      try {
        const [profiles, results] = await Promise.all([loadPublicSwimmerDirectory(), loadPublicSubmittedResults()]);
        if (!active) return;
        const matches = [
          ...profiles.filter(profile => `${profile.first_name} ${profile.last_name} ${profile.country ?? ''}`.toLocaleLowerCase().includes(term)).slice(0, 5)
            .map(profile => ({ label: `${profile.first_name} ${profile.last_name}`.trim(), detail: profile.country ?? 'Swimmer', href: `/athletes/${profile.id}` })),
          ...meets.filter(meet => `${meet.name} ${meet.host_city ?? ''} ${meet.host_country ?? ''}`.toLocaleLowerCase().includes(term)).slice(0, 4)
            .map(meet => ({ label: meet.name, detail: [meet.host_city, meet.year].filter(Boolean).join(' · '), href: `/meets/${meet.id}` })),
          ...results.filter(result => `${result.swimmer_name} ${result.event} ${result.submitted_meets?.name ?? ''}`.toLocaleLowerCase().includes(term)).slice(0, 5)
            .map(result => ({ label: `${result.swimmer_name} · ${result.event}`, detail: `${result.time}${result.submitted_meets?.name ? ` · ${result.submitted_meets.name}` : ''}`, href: result.swimmer_id ? `/athletes/${result.swimmer_id}` : '/results' })),
        ];
        setGlobalSearchResults(matches.slice(0, 10));
        setGlobalSearchOpen(true);
      } catch {
        if (active) setGlobalSearchResults([]);
      } finally { if (active) setGlobalSearchBusy(false); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [globalSearch, meets]);

  const load = useCallback(async () => {
    if (!supabase) { setAccessChecked(true); return; }
    setError('');
    const { data: hasAccess, error: permissionError } = await supabase.rpc('has_admin_permission', { p_permission: 'view_admin' });
    if (permissionError) throw permissionError;
    setAuthorized(Boolean(hasAccess));
    setAccessChecked(true);
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setCurrentUserId(currentUser?.id??'');
    if (!hasAccess) return;
    if (currentUser?.id) {
      const [{ data: notifications, error: notificationsError }, { data: receipts, error: receiptsError }] = await Promise.all([
        supabase.from('admin_notifications').select('id,event_type,title,message,subject_id,created_at').order('created_at',{ascending:false}).limit(30),
        supabase.from('admin_notification_reads').select('notification_id').eq('user_id',currentUser.id),
      ]);
      if (notificationsError) throw notificationsError;
      if (receiptsError) throw receiptsError;
      setNotificationRows((notifications ?? []) as AdminNotification[]);
      setReadNotificationIds((receipts ?? []).map(receipt=>String(receipt.notification_id)));
    }
    const [writerPermission,articlePermission,importPermission,publishPermission,claimPermission,recordPermission,rolePermission,swimmerPermission]=await Promise.all([
      supabase.rpc('has_admin_permission',{p_permission:'manage_writers'}),
      supabase.rpc('has_admin_permission',{p_permission:'manage_articles'}),
      supabase.rpc('has_admin_permission',{p_permission:'import_results'}),
      supabase.rpc('has_admin_permission',{p_permission:'publish_results'}),
      supabase.rpc('has_admin_permission',{p_permission:'review_claims'}),
      supabase.rpc('has_admin_permission',{p_permission:'confirm_records'}),
      supabase.rpc('has_admin_permission',{p_permission:'manage_roles'}),
      supabase.rpc('has_admin_permission',{p_permission:'merge_swimmers'}),
    ]);
    for (const permissionResult of [writerPermission,articlePermission,importPermission,publishPermission,claimPermission,recordPermission,rolePermission,swimmerPermission]) {
      if (permissionResult.error) throw permissionResult.error;
    }
    setCanManageWriters(Boolean(writerPermission.data));
    setCanManageArticles(Boolean(articlePermission.data));
    setCanImportResults(Boolean(importPermission.data));
    setCanPublishResults(Boolean(publishPermission.data));
    setCanReviewClaims(Boolean(claimPermission.data));
    setCanConfirmRecords(Boolean(recordPermission.data));
    setCanManageRoles(Boolean(rolePermission.data));
    setCanManageSwimmers(Boolean(swimmerPermission.data));
    const { data: membership } = await supabase.from('admin_memberships').select('role').eq('user_id', currentUser?.id ?? '').maybeSingle();
    setIsOwner(membership?.role === 'owner');
    setCurrentRole(String(membership?.role ?? 'administrator').replaceAll('_', ' '));
    const { data: countsData, error: countError } = await supabase.rpc('admin_dashboard_counts');
    if (countError) throw countError;
    setCounts((countsData ?? {}) as Record<string, number>);
    if (publishPermission.data) {
      const { data: pendingRows, count: pendingCount, error: pendingError } = await supabase.from('swimmer_results')
        .select('id,swimmer_name,event,time,course,age_group,status,created_at,submitted_meets(name,meet_date,course)', { count: 'exact' })
        .in('status', ['swimmer_submitted', 'imported_unverified'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (pendingError) throw pendingError;
      setVerificationRows((pendingRows ?? []) as Record<string, unknown>[]);
      setVerificationCount(pendingCount ?? 0);
    } else {
      setVerificationRows([]);
      setVerificationCount(0);
    }
    const meetResponse = await supabase.from('meet_catalog').select('id,catalog_key,category,category_order,series_id,series_name,name,year,edition_number,host_city,host_country,meet_date,end_date,status,source_url').order('category_order').order('year',{ascending:false});
    if (meetResponse.error) throw meetResponse.error;
    setMeets(meetResponse.data ?? []);
    if (importPermission.data) {
      const {data:batchRows,error:batchError}=await supabase.from('admin_import_batches').select('id,status,progress,error_message,stage_count,published_count,file_name,created_at,published_at,meet_catalog_id,source_url').order('created_at',{ascending:false}).limit(100);
      if (batchError) throw batchError;
      setBatches(batchRows ?? []);
    } else setBatches([]);
    const { data: recentActivities } = await supabase.from('admin_activity_log').select('id,action,target_type,target_id,details,created_at').order('created_at', { ascending: false }).limit(4);
    setRecentActivityRows((recentActivities ?? []) as Record<string, unknown>[]);
    setLastUpdated(new Date());
    setSelectedMeetId(current => current || meetResponse.data?.find(meet => meet.year === 2027)?.id || '');
  }, []);

  useEffect(() => {
    if (!authorized || !currentUserId || !supabase) return;
    const refreshNotifications = async () => {
      const db = supabase!;
      const [{ data: notifications }, { data: receipts }] = await Promise.all([
        db.from('admin_notifications').select('id,event_type,title,message,subject_id,created_at').order('created_at',{ascending:false}).limit(30),
        db.from('admin_notification_reads').select('notification_id').eq('user_id',currentUserId),
      ]);
      setNotificationRows((notifications ?? []) as AdminNotification[]);
      setReadNotificationIds((receipts ?? []).map(receipt=>String(receipt.notification_id)));
    };
    const interval = window.setInterval(() => { void refreshNotifications().catch(()=>undefined); }, 30_000);
    return () => window.clearInterval(interval);
  }, [authorized,currentUserId]);

  const openNotification = async (notification: AdminNotification) => {
    if (!readNotificationIds.includes(notification.id) && supabase && currentUserId) {
      const { error: readError } = await supabase.from('admin_notification_reads').upsert({ notification_id: notification.id, user_id: currentUserId, read_at: new Date().toISOString() }, { onConflict: 'notification_id,user_id' });
      if (readError) { setError(describeSupabaseError(readError)); return; }
      setReadNotificationIds(current => current.includes(notification.id) ? current : [...current, notification.id]);
    }
    setProfileMenuOpen(false);
    setTab(notification.event_type === 'profile_claim' ? 'Profile claims' : 'Swimmers');
  };

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    setAccessChecked(false);
    void load().catch(reason => setError(describeSupabaseError(reason))).finally(() => setAccessChecked(true));
  }, [load]);

  const openBatch = async (batch: Batch) => {
    if (!supabase) return;
    setTab('Imports'); setImportView('new'); setImportWizardOpen(true);
    setBusy(true); setError(''); setNotice(''); setSelectedBatch(batch); setSwimmerMatches({});
    try {
      const [{ data, error: queryError },{data:swimmers,error:swimmerError}] = await Promise.all([
        supabase.from('admin_import_results').select('id,swimmer_source_key,swimmer_name,country,event,age_group,gender,course,time_original,time_ms,race_status,is_relay,round_name,placing,validation_state,validation_issues,review_action,linked_swimmer_id,source_references').eq('batch_id',batch.id).order('swimmer_name').limit(2000),
        supabase.from('admin_import_swimmers').select('id,source_key,first_name,last_name,country,resolved_swimmer_id,resolution').eq('batch_id',batch.id).limit(2000),
      ]);
      if (queryError) throw queryError;
      if (swimmerError) throw swimmerError;
      setRows((data ?? []) as ImportResult[]);
      setStagedSwimmers((swimmers??[]) as StagedSwimmer[]);
    } catch (reason) { setError(describeSupabaseError(reason)); } finally { setBusy(false); }
  };

  const bootstrap = async () => {
    if (!supabase) return;
    setBusy(true); setError('');
    try { const { error: rpcError } = await supabase.rpc('bootstrap_first_owner'); if (rpcError) throw rpcError; setNotice('Your account is now the initial Owner.'); await load(); }
    catch (reason) { setError(describeSupabaseError(reason)); } finally { setBusy(false); }
  };

  const startImport = async (file: File) => {
    if (!supabase || !selectedMeetId) return;
    const extension = file.name.toLowerCase().split('.').pop();
    setBusy(true); setError(''); setNotice('');
    let batchId: string | null = null;
    try {
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      const sourceHash=Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
      const { data: createdBatchId, error: createError } = await supabase.rpc('admin_start_meet_import', { p_meet_catalog_id: selectedMeetId, p_source_type: extension === 'json' ? 'json' : 'upload', p_source_url: null, p_file_name: file.name, p_source_sha256: sourceHash });
      if (createError) throw createError;
      batchId = String(createdBatchId);
      const {data:existingBatch,error:existingError}=await supabase.from('admin_import_batches').select('id,status,progress,error_message,stage_count,published_count,file_name,created_at,published_at,meet_catalog_id,source_url').eq('id',batchId).single();
      if(existingError)throw existingError;
      if(existingBatch.status==='published'||existingBatch.status==='rolled_back'){
        setNotice(existingBatch.status==='published'?'This exact source file has already been published. The existing import was opened instead of making a duplicate.':'This source was previously rolled back. Start a new import after changing the source file if it should be processed again.');
        await load();await openBatch(existingBatch as Batch);return;
      }
      if(Number(existingBatch.stage_count)>0){setNotice('This exact source file has already been staged. The existing review batch was opened instead of creating duplicate rows.');await load();await openBatch(existingBatch as Batch);return;}
      const path = `${batchId}/${sourceHash}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('admin-imports').upload(path,file,{upsert:false,contentType:file.type || undefined});
      if (uploadError && !/already exists|duplicate|409/i.test(uploadError.message)) throw uploadError;
      const { data: staged, error: stageError } = await supabase.functions.invoke('admin-importer',{body:{batchId,path}});
      if (stageError) throw stageError;
      if (staged?.error) throw new Error(staged.error);
      setNotice(`${staged?.rows ?? 0} rows parsed and staged for review from ${file.name}. The source file is stored privately.`);
      await load();
      const batch = (await supabase.from('admin_import_batches').select('id,status,progress,error_message,stage_count,published_count,file_name,created_at,published_at,meet_catalog_id,source_url').eq('id',batchId).single()).data as Batch;
      if (batch) await openBatch(batch);
    } catch (reason) {
      const message=describeSupabaseError(reason);
      if(batchId) await supabase.rpc('admin_set_import_progress',{p_batch_id:batchId,p_status:'failed',p_progress:'Source parsing failed',p_error:message});
      setError(message);
      await load().catch(()=>undefined);
    } finally { setBusy(false); }
  };

  const findMatches = async (row: ImportResult) => {
    if (!supabase) return;
    const fullName = row.swimmer_name.trim();
    const { data, error: queryError } = await supabase.rpc('admin_find_swimmers', { p_query: fullName, p_country: row.country });
    if (queryError) { setError(describeSupabaseError(queryError)); return; }
    setSwimmerMatches(current => ({ ...current, [row.id]: (data ?? []) as typeof current[string] }));
  };

  const createUnclaimedAndApprove = async (row:ImportResult) => {
    if(!supabase||!selectedBatch||!row.swimmer_source_key)return;
    const staged=stagedSwimmers.find(item=>item.source_key===row.swimmer_source_key);
    if(!staged){setError('No staged swimmer identity was captured for this row.');return;}
    setBusyRow(row.id);setError('');
    try{
      const {data:profileId,error:createError}=await supabase.rpc('admin_create_import_swimmer',{p_staged_swimmer_id:staged.id});if(createError)throw createError;
      await reviewRow(row,'publish',String(profileId),'New unclaimed profile created from official source data; it is not linked to an account.');
    }catch(reason){setError(describeSupabaseError(reason));}finally{setBusyRow('');}
  };

  const linkExistingAndApprove=async(row:ImportResult,profileId:string,evidence:string)=>{
    if(!supabase||!row.swimmer_source_key)return;
    const staged=stagedSwimmers.find(item=>item.source_key===row.swimmer_source_key);
    if(!staged){setError('No staged swimmer identity was captured for this row.');return;}
    setBusyRow(row.id);setError('');
    try{
      const {error:linkError}=await supabase.rpc('admin_link_import_swimmer',{p_staged_swimmer_id:staged.id,p_profile_id:profileId,p_evidence:evidence});if(linkError)throw linkError;
      await reviewRow(row,'publish',profileId,evidence);
    }catch(reason){setError(describeSupabaseError(reason));}finally{setBusyRow('');}
  };

  const reviewRow = async (row: ImportResult, action: 'publish' | 'skip', swimmerId?: string, evidence?:string) => {
    if (!supabase) return;
    setBusyRow(row.id); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('admin_review_import_result',{p_result_id:row.id,p_action:action,p_swimmer_id:swimmerId ?? null,p_issue:evidence??null});
      if (rpcError) throw rpcError;
      setNotice(action === 'skip' ? 'Result skipped.' : 'Result approved for publication review.');
      if (selectedBatch) await openBatch(selectedBatch);
    } catch (reason) { setError(describeSupabaseError(reason)); } finally { setBusyRow(''); }
  };

  const publishBatch = async () => {
    if (!supabase || !selectedBatch) return;
    setBusy(true); setError('');
    try { const { data, error: rpcError } = await supabase.rpc('admin_publish_import_batch',{p_batch_id:selectedBatch.id}); if (rpcError) throw rpcError; setNotice(`${data ?? 0} reviewed source rows published. Non-swimming, relay and non-finish rows remain in the official meet history.`); await load(); const b=batches.find(item=>item.id===selectedBatch.id); if (b) await openBatch({...b,status:'published'}); }
    catch (reason) { setError(describeSupabaseError(reason)); } finally { setBusy(false); }
  };

  const exportBatchJson=()=>{
    if(!selectedBatch)return;
    const exportPayload={schema_version:1,exported_at:new Date().toISOString(),meet:meets.find(meet=>meet.id===selectedBatch.meet_catalog_id)??null,source:{source_url:selectedBatch.source_url,file_name:selectedBatch.file_name,created_at:selectedBatch.created_at,batch_id:selectedBatch.id},swimmers:stagedSwimmers,results:rows};
    const blob=new Blob([JSON.stringify(exportPayload,null,2)],{type:'application/json'});const href=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=href;anchor.download=`wtg-import-${selectedBatch.id}.json`;anchor.click();URL.revokeObjectURL(href);
  };

  const loadTabData = async (target: Tab) => {
    if (!supabase || !authorized) return;
    if (target === 'Swimmers' || target === 'Data quality') {
      const pageSize = 500;
      const data: Record<string, unknown>[] = [];
      let offset = 0;
      let queryError: { code?: string; message: string } | null = null;
      while (true) {
        const page = await supabase.rpc('admin_list_swimmer_profiles').order('id', { ascending: true }).range(offset, offset + pageSize - 1);
        if (page.error) { queryError = page.error; break; }
        const rows = (page.data ?? []) as Record<string, unknown>[];
        data.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
      if (queryError?.code === 'PGRST202') {
        // Keep the admin list usable while the privileged directory migration
        // is being applied. The public directory intentionally omits private
        // account and club fields, which remain available through the admin RPC.
        const publicRows: Record<string, unknown>[] = [];
        for (let publicOffset = 0; ; publicOffset += pageSize) {
          const { data: pageRows, error: publicError } = await supabase.rpc('get_public_swimmer_directory').range(publicOffset, publicOffset + pageSize - 1);
          if (publicError) throw queryError;
          const page = (pageRows ?? []) as Record<string, unknown>[];
          publicRows.push(...page);
          if (page.length < pageSize) break;
        }
        setSwimmerAdminRpcAvailable(false);
        setSwimmerRows(publicRows.map((row: Record<string, unknown>) => ({ ...row, club_name: row.club_name ?? null, account_id: null })));
        setNotice('Showing the public swimmer details while the admin directory database function is unavailable. Apply the admin swimmer directory migration to restore account and club details.');
        return;
      }
      if (queryError) throw queryError;

      // The public Athletes page is backed by athletes joined to swimmer_profiles.
      // Reconcile its full ID set with the admin RPC so a profile cannot appear
      // publicly while being absent from the admin search/list.
      let publicProfiles: Awaited<ReturnType<typeof loadPublicSwimmerDirectory>> = [];
      try {
        publicProfiles = await loadPublicSwimmerDirectory();
      } catch {
        // The admin RPC remains the source of truth if the public directory
        // endpoint is unavailable during a database migration.
      }
      const adminIds = new Set(data.map(row => String(row.id ?? '')));
      const missingFromAdmin = publicProfiles
        .filter(profile => !adminIds.has(profile.id))
        .map(profile => ({
          ...profile,
          date_of_birth: null,
          club_name: profile.club_name ?? null,
          account_id: null,
          is_account_holder: false,
          is_claimed: false,
          source_key: null,
          source_keys: [],
          identity_review_required: false,
          admin_directory_reconciled: true,
        } as unknown as Record<string, unknown>));
      const reconciledData = [...data, ...missingFromAdmin]
        .sort((left, right) => String(left.last_name ?? '').localeCompare(String(right.last_name ?? ''))
          || String(left.first_name ?? '').localeCompare(String(right.first_name ?? '')));
      setSwimmerAdminRpcAvailable(true);
      setSwimmerRows(reconciledData);
      if (missingFromAdmin.length) {
        setNotice(`${missingFromAdmin.length} athlete${missingFromAdmin.length === 1 ? '' : 's'} missing from the admin directory were added from the public athlete list. These rows are read-only until the admin directory database function is reconciled.`);
      }
      return;
    }
    const query = target === 'Profile claims'
      ? supabase.from('profile_claims').select('id,swimmer_profile_id,claimant_id,evidence,status,created_at,reviewer_note').order('created_at',{ascending:false}).limit(100)
      : target === 'Records'
        ? supabase.from('admin_record_candidates').select('id,status,old_time_ms,new_time_ms,improvement_ms,reviewer_note,created_at,imported_performance_id,baseline_record_id,imported_official_performances(swimmer_name,event,age_group,gender,course,time_original,meet_catalog_id,source_metadata)').order('created_at',{ascending:false}).limit(100)
        : target === 'Activity log'
          ? supabase.from('admin_activity_log').select('id,action,target_type,target_id,batch_id,details,created_at').order('created_at',{ascending:false}).limit(100)
          : null;
    if (target === 'Verify results') {
      setVerificationLoading(true);
      try {
        if (canPublishResults) {
          const { data: pendingRows, count, error: pendingError } = await supabase.from('swimmer_results')
            .select('id,swimmer_name,event,time,course,age_group,status,created_at,submitted_meets(name,meet_date,course)', { count: 'exact' })
            .in('status', ['swimmer_submitted', 'imported_unverified'])
            .order('created_at', { ascending: false })
            .range(verificationPage * 100, verificationPage * 100 + 99);
          if (pendingError) throw pendingError;
          setVerificationRows((pendingRows ?? []) as Record<string, unknown>[]);
          setVerificationCount(count ?? 0);
        } else {
          setVerificationRows([]);
          setVerificationCount(0);
        }
        if (canImportResults) {
          const { data: batchRows, error: batchError } = await supabase.from('admin_import_batches')
            .select('id,status,progress,error_message,stage_count,published_count,file_name,created_at,published_at,meet_catalog_id,source_url')
            .order('created_at', { ascending: false }).limit(100);
          if (batchError) throw batchError;
          setBatches((batchRows ?? []) as Batch[]);
        } else setBatches([]);
      } finally { setVerificationLoading(false); }
      return;
    }
    if(target==='Roles and permissions'){
      if(!isOwner){setMemberRows([]);return;}
      const {data,error:roleError}=await supabase.rpc('admin_list_members');if(roleError)throw roleError;setMemberRows((data??[]) as Record<string,unknown>[]);
      const {data:overrideData,error:overrideError}=await supabase.from('admin_permission_overrides').select('user_id,permission,allowed');if(overrideError)throw overrideError;
      const grouped:Record<string,Record<string,boolean>>={};for(const row of overrideData??[]){grouped[row.user_id]??={};grouped[row.user_id][row.permission]=row.allowed;}
      setMemberOverrides(grouped);return;
    }
    if(target==='Writers'){
      if(!canManageWriters){setWriterRows([]);return;}
      const [{data,error:writerError},{data:pendingWriters}] = await Promise.all([
        supabase.rpc('admin_list_writers'),
        supabase.from('site_writers').select('user_id,email,display_name,status,created_at').eq('status','invited').order('created_at',{ascending:false}),
      ]);
      if(writerError)throw writerError;
      const writerById=new Map<string,Record<string,unknown>>(((data??[]) as Record<string,unknown>[]).map(writer=>[String(writer.user_id),writer]));
      for(const pending of (pendingWriters??[]) as Record<string,unknown>[]){
        const id=String(pending.user_id);
        writerById.set(id,{...(writerById.get(id)??{}),...pending,article_count:writerById.get(id)?.article_count??0,draft_count:writerById.get(id)?.draft_count??0,submitted_count:writerById.get(id)?.submitted_count??0,published_count:writerById.get(id)?.published_count??0});
      }
      setWriterRows([...writerById.values()].sort((left,right)=>String(right.created_at??'').localeCompare(String(left.created_at??''))));return;
    }
    if(target==='Articles'){
      if(!canManageArticles){setSubmittedArticles([]);return;}
      const {data,error:articleError}=await supabase.from('site_articles').select('id,title,slug,excerpt,body,category,access,author_name,author_id,cover_image,tags,status,is_featured,submitted_at,created_at').in('status',['submitted','changes_requested']).order('submitted_at',{ascending:false}).limit(100);
      if(articleError)throw articleError;setSubmittedArticles((data??[]) as Record<string,unknown>[]);return;
    }
    if (!query) return;
    const {data,error:queryError}=await query;
    if (queryError) throw queryError;
    if(target==='Profile claims')setClaimRows(data as Record<string,unknown>[]);
    if(target==='Records')setRecordRows(data as Record<string,unknown>[]);
    if(target==='Activity log')setActivityRows(data as Record<string,unknown>[]);
  };

  const inviteWriter=async()=>{
    if(!supabase)return;setBusy(true);setError('');setNotice('');
    try{
      const {data,error:inviteError}=await supabase.functions.invoke('writer-workflow',{body:{action:'invite_writer',email:writerEmail,displayName:writerDisplayName}});
      if(inviteError){
        const context='context' in inviteError ? inviteError.context : null;
        if(context instanceof Response){
          let message='';
          try{const body=await context.clone().json();message=typeof body?.error==='string'?body.error:'';}catch{/* Keep the SDK error when the function did not return JSON. */}
          if(message)throw new Error(message);
        }
        throw inviteError;
      }
      if(data?.error)throw new Error(String(data.error));
      setNotice(data?.message??'Writer invitation sent.');setWriterEmail('');setWriterDisplayName('');await loadTabData('Writers');
    }catch(reason){setError(describeSupabaseError(reason));}finally{setBusy(false);}
  };

  const moderateArticle=async(articleId:string,action:'publish'|'request_changes'|'reject',featured=false)=>{
    if(!supabase)return;setBusyRow(articleId);setError('');setNotice('');
    try{
      const {error:moderationError}=await supabase.rpc('admin_moderate_article',{p_article_id:articleId,p_action:action,p_featured:featured,p_note:articleNotes[articleId]??null});if(moderationError)throw moderationError;
      setNotice(action==='publish'?`Article published${featured?' as a feature article':''}.`:action==='request_changes'?'Revision request sent to the writer.':'Article declined.');await loadTabData('Articles');
    }catch(reason){setError(describeSupabaseError(reason));}finally{setBusyRow('');}
  };

  const searchAdminAccounts=async(value:string)=>{
    setAccountQuery(value);setAccountMatches([]);
    if(!supabase||value.trim().length<3)return;
    const {data,error:searchError}=await supabase.rpc('admin_search_accounts',{p_query:value.trim()});
    if(searchError){setError(describeSupabaseError(searchError));return;}
    setAccountMatches((data??[]) as Record<string,unknown>[]);
  };
  const addAdminMember=async(userId:string,email:string)=>{
    if(!supabase)return;setBusy(true);setError('');
    try{const {error:rpcError}=await supabase.rpc('admin_set_membership',{p_user_id:userId,p_role:newRole,p_active:true});if(rpcError)throw rpcError;setNotice(`${email} added as ${newRole.replaceAll('_',' ')}.`);setAccountQuery('');setAccountMatches([]);await loadTabData('Roles and permissions');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusy(false);}
  };
  const changeAdminRole=async(userId:string,role:string,active:boolean)=>{
    if(!supabase)return;setBusy(true);setError('');
    try{const {error:rpcError}=await supabase.rpc('admin_set_membership',{p_user_id:userId,p_role:role,p_active:active});if(rpcError)throw rpcError;setNotice('Admin role updated.');await loadTabData('Roles and permissions');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusy(false);}
  };
  const changeAdminPermission=async(userId:string,permission:string,allowed:boolean)=>{
    if(!supabase)return;setBusy(true);setError('');
    try{const {error:rpcError}=await supabase.rpc('admin_set_permission',{p_user_id:userId,p_permission:permission,p_allowed:allowed});if(rpcError)throw rpcError;setNotice('Permission override updated.');await loadTabData('Roles and permissions');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusy(false);}
  };
  const decideClaim=async(claimId:string,decision:string)=>{
    if(!supabase)return;setBusyRow(claimId);setError('');
    try{const {error:rpcError}=await supabase.rpc('admin_review_profile_claim',{p_claim_id:claimId,p_decision:decision,p_note:null});if(rpcError)throw rpcError;setNotice(`Profile claim marked ${decision.replaceAll('_',' ')}.`);await loadTabData('Profile claims');await load();}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusyRow('');}
  };
  const reviewDashboardResult=async(resultId:string,status:'verified'|'rejected',note?:string)=>{
    if(!supabase)return;setBusyRow(resultId);setError('');setNotice('');
    try{const {error:rpcError}=await supabase.rpc('admin_set_submitted_result_status',{p_result_id:resultId,p_status:status,p_note:note??null});if(rpcError)throw rpcError;setNotice(status==='verified'?'Result verified.':'Result rejected with the selected reason.');await load();if(tab==='Verify results')await loadTabData('Verify results');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusyRow('');}
  };
  const verifyDashboardResults=async(targetRows=verificationRows)=>{
    if(!supabase||!targetRows.length)return;setBusy(true);setError('');setNotice('');
    try{const responses=await Promise.all(targetRows.map(row=>supabase!.rpc('admin_set_submitted_result_status',{p_result_id:String(row.id),p_status:'verified',p_note:null})));const failure=responses.find(response=>response.error);if(failure?.error)throw failure.error;setNotice(`${targetRows.length} result${targetRows.length===1?'':'s'} verified.`);await load();if(tab==='Verify results')await loadTabData('Verify results');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusy(false);}
  };
  const toggleVerificationResult=(resultId:string,selected:boolean)=>setSelectedVerificationIds(current=>allPendingResultsSelected
    ? selected ? current.filter(id=>id!==resultId) : current.includes(resultId) ? current : [...current,resultId]
    : selected ? current.includes(resultId) ? current : [...current,resultId] : current.filter(id=>id!==resultId));
  const toggleVisibleVerificationResults=(selected:boolean)=>{
    const visibleIds=visiblePendingVerificationRows.map(row=>String(row.id));
    setSelectedVerificationIds(current=>allPendingResultsSelected
      ? selected ? current.filter(id=>!visibleIds.includes(id)) : [...new Set([...current,...visibleIds])]
      : selected ? [...new Set([...current,...visibleIds])] : current.filter(id=>!visibleIds.includes(id)));
  };
  const verifySelectedResults=async()=>{
    if(!supabase||!canPublishResults||!selectedPendingVerificationCount)return;
    const resultCount=selectedPendingVerificationCount;
    const targetDescription=allPendingResultsSelected?'all pending results':'the selected results';
    if(!window.confirm(`Verify ${targetDescription} (${resultCount.toLocaleString()} results)? This will mark them as verified and make them eligible for public rankings.`))return;
    setBusy(true);setError('');setNotice('');
    try{
      const {data,error:rpcError}=await supabase.rpc('admin_bulk_verify_results',{
        p_result_ids:selectedVerificationIds,
        p_all_pending:allPendingResultsSelected,
      });
      if(rpcError)throw rpcError;
      setNotice(`${Number(data??0).toLocaleString()} results verified.`);
      setSelectedVerificationIds([]);setAllPendingResultsSelected(false);setVerificationPage(0);
      await load();if(tab==='Verify results')await loadTabData('Verify results');
    }catch(reason){setError(describeSupabaseError(reason));}
    finally{setBusy(false);}
  };
  const checkWTGRecords=async()=>{
    if(!supabase||!selectedMeetId)return;setBusy(true);setError('');
    try{const {data,error:rpcError}=await supabase.rpc('admin_check_wtg_records',{p_meet_catalog_id:selectedMeetId});if(rpcError)throw rpcError;setNotice(`${data??0} potential, equalled or review-needed record candidates created. No record has been automatically confirmed.`);await loadTabData('Records');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusy(false);}
  };
  const confirmWTGRecord=async(candidateId:string)=>{
    if(!supabase)return;const evidence=recordEvidence[candidateId]??'';setBusyRow(candidateId);setError('');
    try{const {error:rpcError}=await supabase.rpc('admin_confirm_record_candidate',{p_candidate_id:candidateId,p_evidence:evidence,p_note:null});if(rpcError)throw rpcError;setNotice('Record confirmation was published with its official evidence.');await loadTabData('Records');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusyRow('');}
  };

  useEffect(() => { void loadTabData(tab).catch(reason=>setError(describeSupabaseError(reason))); },[tab,authorized,isOwner,canManageWriters,canManageArticles,canImportResults,canPublishResults,currentUserId,verificationPage]);
  useEffect(() => {
    if (canPublishResults && (!canImportResults || (!verificationLoading && batches.length === 0 && verificationCount > 0))) setVerifyTab('submissions');
    else if (canImportResults && !canPublishResults) setVerifyTab('batch');
    else if (canImportResults && canPublishResults && !verificationLoading && batches.length > 0 && verificationCount === 0) setVerifyTab('batch');
  }, [batches.length, canImportResults, canPublishResults, verificationCount, verificationLoading]);
  useEffect(() => { if (!authorized || tab !== 'Swimmers' || !canReviewClaims || !supabase) return; let active=true; void (async()=>{const {data,error:claimError}=await supabase!.from('profile_claims').select('id,swimmer_profile_id,claimant_id,evidence,status,created_at,reviewer_note').order('created_at',{ascending:false}).limit(100); if(!active)return; if(claimError)setError(describeSupabaseError(claimError)); else setClaimRows((data??[]) as Record<string,unknown>[]);})(); return ()=>{active=false;}; },[authorized,tab,canReviewClaims]);
  const filteredRows = useMemo(() => rows.filter(row => `${row.swimmer_name} ${row.country ?? ''} ${row.event}`.toLowerCase().includes(search.toLowerCase())),[rows,search]);
  const world2027 = meets.find(meet => meet.year === 2027 && meet.category === 'World Transplant Games');
  const selectedMeet = meets.find(meet => meet.id === selectedMeetId);
  const recentYear = new Date().getFullYear() - 1;
  const pendingMeetImports = meets.filter(meet => meet.year >= recentYear && meet.status !== 'cancelled' && !batches.some(batch => batch.meet_catalog_id === meet.id && batch.published_count > 0));
  const visiblePendingVerificationRows = verificationRows.filter(row => ['swimmer_submitted','imported_unverified'].includes(String(row.status)));
  const selectedPendingVerificationCount = allPendingResultsSelected
    ? Math.max(0, verificationCount - selectedVerificationIds.length)
    : selectedVerificationIds.length;
  const allVisiblePendingResultsSelected = visiblePendingVerificationRows.length > 0 && visiblePendingVerificationRows.every(row => allPendingResultsSelected
    ? !selectedVerificationIds.includes(String(row.id))
    : selectedVerificationIds.includes(String(row.id)));
  const totalProfiles = Number(counts.swimmer_profiles ?? 0);
  const claimedProfiles = Number(counts.claimed_profiles ?? 0);
  const dataQualityCount = useMemo(() => getAdminDataQualityIssues(swimmerRows).length, [swimmerRows]);
  const claimedPercent = totalProfiles ? Math.round((claimedProfiles / totalProfiles) * 100) : 0;
  const claimedRate = totalProfiles ? ((claimedProfiles / totalProfiles) * 100).toFixed(1) : '0.0';
  const dashboardDate = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const gamesStart = world2027?.meet_date ? new Date(`${world2027.meet_date}T00:00:00`) : null;
  const daysUntilGames = gamesStart && Number.isFinite(gamesStart.getTime()) ? Math.max(0, Math.ceil((gamesStart.getTime() - Date.now()) / 86_400_000)) : null;

  const filteredActivityRows = useMemo(() => activityRows.filter(row => {
    if (auditFilter === 'All') return true;
    const target = String(row.target_type ?? '').toLowerCase();
    const action = String(row.action ?? '').toLowerCase();
    if (auditFilter === 'Swimmers') return target.includes('swimmer') || target.includes('claim') || action.includes('profile') || action.includes('swimmer');
    if (auditFilter === 'Imports') return target.includes('import') || target.includes('result') || action.includes('import') || action.includes('result');
    if (auditFilter === 'Meets') return target.includes('meet') || action.includes('meet');
    return target.includes('article') || target.includes('content') || target.includes('campaign') || action.includes('article') || action.includes('campaign') || action.includes('content');
  }), [activityRows, auditFilter]);
  const auditGroups = useMemo(() => {
    const groups: Record<string, unknown>[][] = [];
    for (const row of filteredActivityRows) {
      const previous = groups.at(-1);
      const last = previous?.at(-1);
      const sameAction = last && last.action === row.action && last.target_type === row.target_type;
      const closeInTime = last && row.created_at && last.created_at && Math.abs(new Date(String(last.created_at)).getTime() - new Date(String(row.created_at)).getTime()) <= 120_000;
      if (sameAction && closeInTime) previous!.push(row);
      else groups.push([row]);
    }
    return groups;
  }, [filteredActivityRows]);
  const exportAuditCsv = () => {
    const fields = ['action', 'target_type', 'target_id', 'batch_id', 'details', 'created_at'];
    const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [fields.join(','), ...filteredActivityRows.map(row => fields.map(field => csvCell(typeof row[field] === 'object' ? JSON.stringify(row[field]) : row[field])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'admin-audit-log.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  const sectionDescriptions: Record<Tab, string> = {
    Overview: 'A live summary of swimmers, results, publishing and review activity.',
    'Data queries': 'Query swimmer and result data, review duplicate profiles and merge confirmed swimmer records.',
    'Data quality': 'Review data-quality issues detected from the swimmer directory. Editing and bulk fixes require supported admin update endpoints.',
    'Verify results': 'Review results awaiting verification and open their existing import or submission workflows.',
    Clubs: 'Club approvals are unavailable until the admin club review endpoint exists.',
    'Site settings': 'Site settings are unavailable until the supported settings keys and update endpoint exist.',
    Imports: 'Upload official meet files, resolve identities and publish reviewed results.',
    'Historical archive': 'Import the full swimmers.json archive across all historical meets in one operation.',
    Swimmers: 'Review swimmer profiles and account connections.',
    'Meets and results': 'Manage meet editions and their published results.',
    'Profile claims': 'Review requests to connect public swimmer profiles to accounts.',
    Records: 'Compare verified WTG swims with record baselines and review candidates.',
    Writers: 'Invite and manage contributors for From the Pool Deck.',
    'Write article': 'Draft, preview and publish a story from the admin account.',
    'Article library': 'Find, edit, archive, restore or delete any article on the site.',
    'About page': 'Edit the overview and all public About page sections.',
    'Contact inbox': 'Read and organise messages sent through the public Contact Us form.',
    Ads: 'Manage advertisers, campaign dates, placements, rates and invoice status.',
    Articles: 'Review submitted stories and choose how each article goes live.',
    'Roles and permissions': 'Control access to platform management tools.',
    'Activity log': 'Review recent administrative actions and changes.',
  };

  const managementHeader = <header className="sticky top-0 z-40 border-b border-[var(--navy-light)] bg-[var(--navy)]/95 backdrop-blur">
    <div className="mx-auto flex min-h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-3"><Link to="/" aria-label="Transplant Aquatics home"><Logo size="md" light /></Link><span className="border border-[var(--accent)]/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">Admin</span></div>
      <div className="relative mx-auto hidden min-w-0 max-w-2xl flex-1 md:block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input type="search" value={globalSearch} onChange={event=>{setGlobalSearch(event.target.value);if(!event.target.value.trim()){setGlobalSearchResults([]);setGlobalSearchOpen(false);setGlobalSearchBusy(false);}}} onFocus={()=>{if(globalSearch.trim())setGlobalSearchOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setGlobalSearchOpen(false);}} placeholder="Search swimmers, meets or results" aria-label="Search swimmers, meets or results" className="h-10 w-full border border-[var(--navy-light)] bg-[var(--navy-mid)] pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--accent)]" />
        {globalSearchOpen&&<div className="absolute left-0 right-0 top-full z-50 mt-1 border border-[var(--navy-light)] bg-[var(--navy-mid)] p-1 shadow-xl">{globalSearchBusy?<p className="px-3 py-3 text-xs text-white/55">Searching…</p>:globalSearchResults.length?globalSearchResults.map((result,index)=><button key={`${result.href}-${result.label}-${index}`} type="button" onClick={()=>{setGlobalSearchOpen(false);setGlobalSearch('');navigate(result.href);}} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[var(--navy)]"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{result.label}</span><span className="block truncate text-xs text-white/50">{result.detail}</span></span><ArrowRight size={14} className="shrink-0 text-[var(--accent)]" /></button>):<p className="px-3 py-3 text-xs text-white/55">No matching records found.</p>}</div>}
      </div>
      <Link to="/" className="ml-auto hidden shrink-0 text-xs font-semibold text-white/65 hover:text-[var(--accent)] sm:inline">View site</Link>
      <div className="relative"><button type="button" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={()=>setProfileMenuOpen(open=>!open)} className="flex items-center gap-2 border border-[var(--navy-light)] px-2 py-1.5 text-left transition-colors hover:border-[var(--accent)]"><span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--navy-light)] bg-[var(--navy-mid)] font-mono text-xs font-bold text-[var(--accent)]">{auth.user?.avatarInitials ?? 'AD'}{unreadNotifications.length>0&&<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] text-[var(--navy)]">{unreadNotifications.length>9?'9+':unreadNotifications.length}</span>}</span><span className="hidden text-left sm:block"><span className="block text-xs font-semibold text-white">{auth.user?.firstName} {auth.user?.lastName}</span><span className="block text-[10px] capitalize text-white/45">{currentRole}</span></span><ChevronDown size={14} className="text-white/50" /></button>
        {profileMenuOpen&&<div role="menu" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-[var(--navy-light)] bg-[var(--navy-mid)] p-2 shadow-xl"><div className="flex items-center justify-between border-b border-[var(--navy-light)] px-3 py-2"><span className="text-sm font-semibold text-white">Notifications</span><span className="font-mono text-[10px] text-[var(--accent)]">{unreadNotifications.length} unread</span></div>{notificationRows.length?<div className="max-h-80 overflow-y-auto">{notificationRows.slice(0,8).map(item=><button key={item.id} type="button" role="menuitem" onClick={()=>void openNotification(item)} className={`flex w-full gap-3 border-b border-[var(--navy-light)] px-3 py-3 text-left last:border-0 hover:bg-[var(--navy)] ${readNotificationIds.includes(item.id)?'opacity-65':''}`}><Bell size={14} className={`mt-0.5 shrink-0 ${readNotificationIds.includes(item.id)?'text-white/35':'text-[var(--accent)]'}`} /><span className="min-w-0"><span className="block text-xs font-semibold text-white">{item.title}</span><span className="mt-1 block text-xs text-white/60">{item.message}</span><span className="mt-1 block font-mono text-[9px] text-white/35">{new Date(item.created_at).toLocaleString()}</span></span></button>)}</div>:<p className="px-3 py-5 text-xs text-white/50">New user sign-ups and profile claims will appear here.</p>}<button type="button" role="menuitem" onClick={()=>{auth.logout();navigate('/login');}} className="mt-2 flex w-full items-center gap-2 border-t border-[var(--navy-light)] px-3 py-3 text-left text-xs font-semibold text-white/75 hover:text-[var(--accent)]"><LogOut size={14} />Log out</button></div>}
      </div>
    </div>
  </header>;

  if (!hasSupabaseConfig) return <>{managementHeader}<PageHeading eyebrow="Administration" title="Admin" /><section className="mx-auto max-w-7xl px-4 py-10"><EmptyState title="Database connection required" subtitle="Configure Supabase before opening the admin workspace." onDark /></section></>;

  if (!accessChecked || auth.isLoading) return <>{managementHeader}<PageLoading /></>;

  if (!authorized) return <>{managementHeader}<main className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="max-w-2xl border p-6 text-white" style={cardStyle}>
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">Management access</p><h1 className="mt-2 text-2xl font-bold">Admin access required</h1>
    <p className="mt-2 text-sm leading-6 text-white/65">This account does not have permission to open the management console. Contact an Owner if you need access. The first signed-in account can become the initial Owner only when admin access has not yet been set up.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-3">{auth.isLoggedIn && <button type="button" onClick={()=>void bootstrap()} disabled={busy} className="inline-flex border border-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent)] disabled:opacity-50">{busy?'Checking setup…':'First-time owner setup'}</button>}</div>
  </div></main></>;

  return <>
    {managementHeader}
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
      <aside className="border-b border-[var(--navy-light)] bg-[#071a2b] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-[236px] lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <nav aria-label="Admin dashboard sections" className="grid gap-4 px-2.5 pb-4 pt-5 lg:block lg:space-y-4 lg:px-2.5 lg:py-5">
          {navigationGroups.map(group=>{
            const visibleItems=group.items.filter(item=>{
              if (item.tab==='Imports') return canImportResults;
              if (item.tab==='Meets and results') return canImportResults;
              if (item.tab==='Verify results') return canPublishResults || canImportResults;
              if (item.tab==='Clubs') return false;
              if (item.tab==='Records') return true;
              if (item.tab==='Swimmers') return canManageSwimmers || canReviewClaims;
              if (item.tab==='Roles and permissions') return canManageRoles || canManageWriters;
              if (['Article library','About page','Ads'].includes(item.tab)) return canManageArticles;
              return true;
            });
            return visibleItems.length?<div key={group.label} className="col-span-full lg:col-span-1">{group.label!=='Workspace'&&<p className="px-3 pb-1.5 pt-1 font-medium text-xs text-white/50">{group.label}</p>}<div className="grid gap-1">{visibleItems.map(item=>{const Icon=item.icon;const active=tab===item.tab || (item.tab==='Swimmers'&&tab==='Profile claims') || (item.tab==='Imports'&&tab==='Historical archive') || (item.tab==='Article library'&&['Articles','Write article'].includes(tab)) || (item.tab==='Roles and permissions'&&tab==='Writers');const count=item.tab==='Verify results'?verificationCount:item.tab==='Data quality'?(counts.data_issues==null?dataQualityCount:Number(counts.data_issues)):item.tab==='Clubs'?(clubCount??Number(counts.clubs??0)):item.countKey?Number(counts[item.countKey]??0):0;return <button key={item.tab} type="button" onClick={()=>{setTab(item.tab);if(item.tab==='Imports')setImportView('new');setError('');setNotice('');}} aria-current={active?'page':undefined} className={`flex h-9 items-center gap-3 rounded px-3 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8ab4f8] focus-visible:outline-offset-1 ${active?'bg-[#263744] text-white':'text-white/75 hover:bg-white/5 hover:text-white'}`}><Icon size={16} strokeWidth={1.8} className={active?'shrink-0 text-[var(--accent)]':'shrink-0 text-white/50'} /><span className="min-w-0 flex-1">{item.label}</span>{count>0&&<span className="min-w-5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold text-[var(--navy)]">{compactCount(count)}</span>}</button>;})}</div></div>:null;
          })}
        </nav>
        <div className="hidden border-t border-[var(--navy-light)] px-5 py-4 lg:block"><p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Signed in as</p><p className="mt-1 truncate text-xs text-white/70">{auth.user?.email}</p></div>
      </aside>
      <main className="min-w-0 flex-1">
        {tab!=='Overview' && <div className="border-b border-[var(--navy-light)] bg-[var(--navy-mid)] px-4 py-6 sm:px-7 sm:py-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">Management / {tab==='Roles and permissions'||tab==='Writers'?'Team & roles':['Article library','Articles','Write article'].includes(tab)?'Articles':tab==='About page'?'Pages':tab==='Ads'?'Campaigns':tab}</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{tab==='Roles and permissions'||tab==='Writers'?'Team & roles':['Article library','Articles','Write article'].includes(tab)?'Articles':tab==='About page'?'Pages':tab==='Ads'?'Campaigns':tab}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{tab==='Roles and permissions'||tab==='Writers'?'Who can use the admin, and what each role can do.':sectionDescriptions[tab]}</p></div><div className="flex items-center gap-3"><span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected</span><button type="button" onClick={()=>void load().catch(reason=>setError(describeSupabaseError(reason)))} disabled={busy} aria-label="Refresh admin dashboard" className="inline-flex h-9 w-9 items-center justify-center border border-[var(--navy-light)] text-white/60 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"><RefreshCw size={15} className={busy?'animate-spin':''} /></button></div></div></div>}
        <section className="px-4 py-5 sm:px-7 sm:py-7">
          {error && <div role="alert" className="mb-4 border border-red-300/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>}
          {notice && <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[120] flex max-w-[min(28rem,calc(100vw-2.5rem))] items-start gap-3 border border-[var(--accent)]/50 bg-[var(--navy-mid)] px-4 py-3 text-sm text-white shadow-2xl"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--accent)]"/><span>{notice}</span><button type="button" onClick={()=>setNotice('')} aria-label="Dismiss notification" className="ml-auto text-white/50 hover:text-white"><X size={15}/></button></div>}
        {tab==='Write article' && <AdminArticleComposer userId={currentUserId} authorName={`${auth.user?.firstName??''} ${auth.user?.lastName??''}`.trim()||'Transplant Aquatics'} initialArticleId={selectedArticleId} onInitialEditLoaded={()=>setSelectedArticleId('')} cardStyle={cardStyle} inputClass={inputClass} onError={setError} onNotice={setNotice} />}
        {tab==='Article library' && <><div className="mb-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setTab('Articles')} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/70">Review submissions{counts.articles_in_review!=null?` · ${Number(counts.articles_in_review)}`:''}</button><button type="button" onClick={()=>setTab('Write article')} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)]">＋ New article</button></div><AdminArticleLibrary onEdit={id=>{setSelectedArticleId(id);setTab('Write article');}} onError={setError} onNotice={setNotice} /></>}
        {tab==='Ads' && <AdminAdCampaigns cardStyle={cardStyle} inputClass={inputClass} onError={setError} onNotice={setNotice} />}
        {tab==='Data queries' && <AdminDataQueries cardStyle={cardStyle} canMerge={canManageSwimmers} swimmers={swimmerRows} />}
        {tab==='Data quality' && <><div className="mb-5 flex gap-5 border-b border-[var(--navy-light)]" role="tablist" aria-label="Data quality tools"><button type="button" role="tab" aria-selected={qualityView==='issues'} onClick={()=>setQualityView('issues')} className={`border-b-2 px-1 py-2.5 text-sm ${qualityView==='issues'?'border-[var(--accent)] font-semibold text-white':'border-transparent text-white/55'}`}>Issues</button><button type="button" role="tab" aria-selected={qualityView==='query'} onClick={()=>setQualityView('query')} className={`border-b-2 px-1 py-2.5 text-sm ${qualityView==='query'?'border-[var(--accent)] font-semibold text-white':'border-transparent text-white/55'}`}>Query builder</button></div>{qualityView==='query'?<AdminDataQueries cardStyle={cardStyle} canMerge={canManageSwimmers} swimmers={swimmerRows} preset={qualityQueryPreset} />:<AdminDataQuality swimmers={swimmerRows} onOpenQueries={preset=>{setQualityQueryPreset(preset??null);setQualityView('query');}} />}</>}
        {tab==='Clubs' && <section className="border" style={cardStyle}><div className="border-b border-[var(--navy-light)] px-5 py-4"><h2 className="font-bold text-white">Clubs</h2><p className="mt-1 text-xs text-white/55">Directory records currently available on the site.</p></div>{clubRows.length ? clubRows.map(club=><Link key={club.id} to={`/clubs/${club.slug || club.id}`} className="flex flex-wrap items-center gap-3 border-b border-[var(--navy-light)] px-5 py-4 last:border-0 hover:bg-[var(--navy)]"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{club.name}</span><span className="mt-1 block text-xs text-white/50">{[club.city,club.country].filter(Boolean).join(' · ') || 'Location not listed'}</span></span><ArrowRight size={15} className="text-[var(--accent)]" /></Link>) : <div className="p-5"><EmptyState title="No clubs found" subtitle="No public club directory records are available yet." onDark /></div>}</section>}
        {tab==='Site settings' && <div className="border p-5" style={cardStyle}><EmptyState title="Site settings are not available yet" subtitle="No supported admin settings keys and save endpoint are present in the current app. This section stays read-only until they exist." onDark /></div>}
        {tab==='Verify results' && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--navy-light)] pb-4"><div><h2 className="text-xl font-bold text-white">Verify results</h2><p className="mt-1 text-sm text-white/55">Review imported meet batches or swimmer-submitted results with the existing verification actions.</p></div>{canImportResults&&canPublishResults&&batches.length>0?<div className="inline-flex border border-[var(--navy-light)] p-0.5" role="tablist" aria-label="Verification queues"><button type="button" role="tab" aria-selected={verifyTab==='batch'} onClick={()=>setVerifyTab('batch')} className={`px-3 py-2 text-xs font-semibold ${verifyTab==='batch'?'bg-[var(--accent)] text-[var(--navy)]':'text-white/60'}`}>By meet batch</button><button type="button" role="tab" aria-selected={verifyTab==='submissions'} onClick={()=>setVerifyTab('submissions')} className={`px-3 py-2 text-xs font-semibold ${verifyTab==='submissions'?'bg-[var(--accent)] text-[var(--navy)]':'text-white/60'}`}>Swimmer submissions</button></div>:<span className="text-xs text-white/45">{verifyTab==='batch'?'Import batches':'Swimmer submissions'}</span>}</div>
          {verificationLoading ? <section className="border p-5 text-sm text-white/55" style={cardStyle}>Loading verification queue…</section> : verifyTab==='batch' ? <section className="border" style={cardStyle}><div className="border-b border-[var(--navy-light)] px-5 py-4"><h3 className="font-bold text-white">Recent import batches</h3><p className="mt-1 text-xs text-white/50">Open a batch to review its staged swims and flagged rows before publication.</p></div>{batches.length ? batches.slice(0,20).map(batch=>{const meet=meets.find(item=>item.id===batch.meet_catalog_id);return <article key={batch.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--navy-light)] px-5 py-4 last:border-0"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{meet?.name??batch.file_name??'Meet import'}</span><span className="mt-1 block text-xs text-white/50">{batch.stage_count.toLocaleString()} swims · {batch.source_url?'URL import':'file import'} · {new Date(batch.created_at).toLocaleDateString('en-ZA')} · {batch.status.replaceAll('_',' ')}</span>{batch.error_message&&<span className="mt-1 block text-xs text-amber-200">{batch.error_message}</span>}</span><button type="button" onClick={()=>{setTab('Imports');void openBatch(batch);}} className="border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">Review batch</button></article>}) : <div className="p-5"><EmptyState title="No import batches yet" subtitle="Start an import to review a meet batch here." onDark /></div>}</section>
            : <section className="border" style={cardStyle}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-light)] px-5 py-4"><div><h3 className="font-bold text-white">Swimmer submissions</h3><p className="mt-1 text-xs text-white/50">Official imports are labeled separately from results submitted by swimmers.</p></div><div className="flex flex-wrap items-center gap-2"><label className="inline-flex items-center gap-2 px-2 py-2 text-xs text-white/70"><input type="checkbox" checked={allVisiblePendingResultsSelected} onChange={event=>toggleVisibleVerificationResults(event.target.checked)} className="accent-[var(--accent)]" />Select page</label><button type="button" disabled={!verificationCount||busy} onClick={()=>{setAllPendingResultsSelected(true);setSelectedVerificationIds([]);}} className="border border-white/25 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Select all {verificationCount.toLocaleString()}</button>{selectedPendingVerificationCount>0&&<><button type="button" disabled={busy} onClick={()=>void verifySelectedResults()} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40">Verify selected ({selectedPendingVerificationCount.toLocaleString()})</button><button type="button" disabled={busy} onClick={()=>{setAllPendingResultsSelected(false);setSelectedVerificationIds([]);}} className="border border-white/25 px-3 py-2 text-xs text-white/70 disabled:opacity-40">Clear</button></>}</div></div>{verificationRows.filter(row=>['swimmer_submitted','imported_unverified'].includes(String(row.status))).length ? verificationRows.filter(row=>['swimmer_submitted','imported_unverified'].includes(String(row.status))).map(row=>{const meet=row.submitted_meets as {name?:string;meet_date?:string;course?:string}|null;const id=String(row.id);return <article key={id} className="border-b border-[var(--navy-light)] px-5 py-4 last:border-0"><div className="flex flex-wrap items-center gap-3"><input type="checkbox" checked={allPendingResultsSelected ? !selectedVerificationIds.includes(id) : selectedVerificationIds.includes(id)} onChange={event=>toggleVerificationResult(id,event.target.checked)} aria-label={`Select ${String(row.swimmer_name)} ${String(row.event)}`} className="accent-[var(--accent)]" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{String(row.swimmer_name)} · {String(row.event)} <span className="font-mono text-[10px] font-normal text-white/45">{String(row.course??'')}</span></p><p className="mt-1 text-xs text-white/55">{meet?.name??'Meet details not supplied'} · {row.status==='swimmer_submitted'?'submitted by swimmer':'imported result'} · {String(row.time??'—')}</p></div><button type="button" disabled={busyRow===id} onClick={()=>void reviewDashboardResult(id,'verified')} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40">Verify</button></div><fieldset className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><legend className="mb-2 text-xs text-white/60">Reject reason</legend>{[['time_mismatch','Time mismatch'],['missing_evidence','Missing evidence'],['wrong_swimmer','Wrong swimmer'],['duplicate','Duplicate'],['other','Other']].map(([value,label])=><label key={value} className="inline-flex items-center gap-1.5 text-xs text-white/65"><input type="radio" name={`reject-${id}`} value={value} checked={rejectionReasons[id]===value} onChange={()=>setRejectionReasons(current=>({...current,[id]:value}))} className="accent-[var(--accent)]" />{label}</label>)}<button type="button" disabled={busyRow===id||!rejectionReasons[id]} onClick={()=>void reviewDashboardResult(id,'rejected',rejectionReasons[id])} className="border border-red-300/40 px-3 py-1.5 text-xs text-red-200 disabled:opacity-40">Reject result</button></fieldset></article>}) : <div className="p-5"><EmptyState title="No results are waiting for verification" subtitle="New swimmer submissions and unverified imported results will appear here." onDark /></div>}{verificationCount>0&&<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--navy-light)] px-5 py-3"><p className="text-xs text-white/45">Showing {verificationPage*100+1}–{Math.min((verificationPage+1)*100,verificationCount)} of {verificationCount.toLocaleString()} results to verify.</p><div className="flex gap-2"><button type="button" disabled={verificationPage===0||verificationLoading} onClick={()=>setVerificationPage(page=>Math.max(0,page-1))} className="border border-[var(--navy-light)] px-3 py-1.5 text-xs text-white/70 disabled:opacity-35">Previous</button><button type="button" disabled={(verificationPage+1)*100>=verificationCount||verificationLoading} onClick={()=>setVerificationPage(page=>page+1)} className="border border-[var(--navy-light)] px-3 py-1.5 text-xs text-white/70 disabled:opacity-35">Next</button></div></div>}</section>}
        </div>}
        {tab==='Overview' && <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-white/65">{dashboardDate} <span className="text-white/35">·</span> data updated {lastUpdated ? 'just now' : 'recently'}</p>
            {canImportResults && <button type="button" onClick={()=>setTab('Imports')} className="inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] hover:bg-white"><Upload size={16}/>Import results</button>}
          </div>
          <div className="mb-8 flex items-start gap-3 border-l-2 border-[var(--accent)] bg-[var(--navy-mid)] px-4 py-3.5 text-sm text-white/75">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--accent)]"/>
            <p><strong className="text-white">{verificationCount} {verificationCount===1?'result needs':'results need'} verifying.</strong> {Number(counts.pending_claims??0)+Number(counts.record_candidates??0)+Number(counts.articles_in_review??0)===0 ? 'Nothing else is waiting: no profile claims, record candidates or articles to review.' : 'Also waiting: '+Number(counts.pending_claims??0)+' profile claims, '+Number(counts.record_candidates??0)+' record candidates and '+Number(counts.articles_in_review??0)+' articles to review.'}</p>
          </div>

          {Number(counts.published_results??0)===0 && verificationCount>0 && <button type="button" onClick={()=>setTab('Verify results')} className="mb-5 flex w-full items-center justify-between gap-3 border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-left text-sm text-amber-100"><span>All {verificationCount.toLocaleString()} imported swims are waiting for verification.</span><span className="inline-flex shrink-0 items-center gap-1 font-semibold">Verify results <ArrowRight size={14}/></span></button>}

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Awaiting verification', value: verificationCount.toLocaleString(), tab: 'Verify results' as Tab },
              { label: 'Data issues', value: counts.data_issues == null ? '—' : Number(counts.data_issues).toLocaleString(), tab: 'Data quality' as Tab },
              { label: 'Needs a decision', value: (Number(counts.pending_claims??0)+Number(counts.record_candidates??0)+Number(counts.articles_in_review??0)).toLocaleString(), tab: 'Profile claims' as Tab },
              { label: 'New accounts · 7 days', value: counts.new_accounts_7_days == null ? '—' : Number(counts.new_accounts_7_days).toLocaleString(), tab: 'Swimmers' as Tab },
            ].map(card=><button key={card.label} type="button" onClick={()=>setTab(card.tab)} className="border p-4 text-left transition-colors hover:border-[var(--accent)]" style={cardStyle}><span className="block text-xs text-white/55">{card.label}</span><strong className="mt-2 block font-mono text-2xl text-white">{card.value}</strong></button>)}
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.92fr)]">
            <div className="min-w-0 space-y-6">
              <section className="border" style={cardStyle}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-light)] px-5 py-4 sm:px-6">
                  <div><h2 className="text-lg font-bold text-white">Results to verify</h2><p className="mt-0.5 text-sm text-white/55">Check each swim against the official meet sheet.</p></div>
                  {verificationRows.length>0 && canPublishResults && <button type="button" disabled={busy} onClick={()=>void verifyDashboardResults()} className="border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:border-[var(--accent)] disabled:opacity-40">Verify all {verificationRows.length}</button>}
                </div>
                {verificationRows.length ? <div>{verificationRows.map(row=>{
                  const meet=row.submitted_meets as {name?:string;meet_date?:string;course?:string}|null;
                  const course=String(row.course??meet?.course??'').trim();
                  const meetDate=meet?.meet_date?new Date(String(meet.meet_date)+'T00:00:00').toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'}):'';
                  return <article key={String(row.id)} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--navy-light)] px-5 py-3.5 last:border-0 sm:px-6">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{String(row.swimmer_name??'Swimmer')} · {String(row.event??'Event')} <span className="font-mono text-[10px] font-normal text-white/50">{course}</span></p><p className="mt-0.5 truncate text-xs text-white/55">{meet?.name??'Meet details not supplied'}{meetDate?' · '+meetDate:''} · {row.status==='swimmer_submitted'?'submitted by swimmer':'official import'}</p></div>
                    <span className="shrink-0 font-mono text-base font-bold text-white">{String(row.time??'—')}</span>
                    {canPublishResults && <div className="flex shrink-0 items-center gap-1.5"><button type="button" disabled={busyRow===String(row.id)} onClick={()=>void reviewDashboardResult(String(row.id),'rejected')} aria-label={'Reject '+String(row.swimmer_name??'swimmer')+"'s "+String(row.event??'result')} title="Reject result" className="flex size-8 items-center justify-center border border-white/20 text-white/70 hover:border-red-300/60 hover:text-red-200 disabled:opacity-40"><X size={15}/></button><button type="button" disabled={busyRow===String(row.id)} onClick={()=>void reviewDashboardResult(String(row.id),'verified')} className="inline-flex h-8 items-center gap-1.5 bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--navy)] hover:bg-white disabled:opacity-40"><Check size={14}/>Verify</button></div>}
                  </article>;
                })}{verificationCount>verificationRows.length&&<p className="border-t border-[var(--navy-light)] px-5 py-2 text-xs text-white/45 sm:px-6">Showing the latest {verificationRows.length} of {verificationCount} results to verify.</p>}</div> : <p className="px-5 py-8 text-sm text-white/55 sm:px-6">No results are waiting for verification.</p>}
              </section>

              {canImportResults && <section className="border" style={cardStyle}>
                <div className="flex items-center justify-between gap-3 border-b border-[var(--navy-light)] px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-white">Verify by meet</h2><p className="mt-0.5 text-sm text-white/55">Latest import batches waiting for review.</p></div><button type="button" onClick={()=>setTab('Verify results')} className="text-sm font-semibold text-[var(--accent)]">View all</button></div>
                {batches.filter(batch=>!['published','rolled_back'].includes(batch.status)).slice(0,4).length ? batches.filter(batch=>!['published','rolled_back'].includes(batch.status)).slice(0,4).map(batch=>{const meet=meets.find(item=>item.id===batch.meet_catalog_id);return <button type="button" key={batch.id} onClick={()=>{setTab('Imports');void openBatch(batch);}} className="flex w-full items-center justify-between gap-3 border-b border-[var(--navy-light)] px-5 py-3 text-left last:border-0 sm:px-6"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{meet?.name??batch.file_name??'Meet import'}</span><span className="block text-xs text-white/50">{batch.stage_count.toLocaleString()} swims · {batch.status.replaceAll('_',' ')}</span></span><ArrowRight size={15} className="shrink-0 text-[var(--accent)]" /></button>}) : <p className="px-5 py-6 text-sm text-white/50 sm:px-6">No meet batches are waiting for review.</p>}
              </section>}

              <section className="border" style={cardStyle}>
                <div className="flex items-center justify-between gap-3 border-b border-[var(--navy-light)] px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-white">Recent activity</h2><button type="button" onClick={()=>setTab('Activity log')} className="text-sm font-semibold text-[var(--accent)] hover:underline">Full audit log</button></div>
                {recentActivityRows.length ? <div className="px-5 sm:px-6">{recentActivityRows.map((item,index)=>{
                  const date=item.created_at?new Date(String(item.created_at)):null;
                  const day=date&&date.toDateString()===new Date().toDateString()?'Today':date?.toLocaleDateString('en-ZA',{day:'numeric',month:'short'})??'Recent';
                  const time=date?.toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit',hour12:false})??'';
                  const action=String(item.action??'admin_update').replaceAll('_',' ');
                  const summary=action.startsWith('profile claim approved')?'You approved a swimmer profile claim':'You '+action;
                  return <div key={String(item.id??index)} className="flex items-center gap-3 border-b border-[var(--navy-light)] py-3 last:border-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/60"><Activity size={15}/></span><span className="min-w-0 flex-1"><span className="block text-[10px] text-white/45">{day}</span><span className="mt-0.5 block truncate text-sm text-white/80">{summary}</span></span><span className="shrink-0 font-mono text-[10px] text-white/45">{time}</span></div>;
                })}</div> : <p className="px-5 py-7 text-sm text-white/55 sm:px-6">Admin actions will appear here as the team works.</p>}
              </section>
            </div>

            <aside className="space-y-6">
              <section className="border p-5 sm:p-6" style={cardStyle}>
                <h2 className="text-lg font-bold text-white">Profile claims</h2><p className="mt-1 text-sm leading-5 text-white/55">Swimmers who have taken ownership of their profile.</p>
                <p className="mt-5 flex items-baseline gap-2"><strong className="font-mono text-4xl font-bold text-white">{claimedProfiles.toLocaleString()}</strong><span className="text-sm text-white/55">of {totalProfiles.toLocaleString()} claimed ({claimedRate}%)</span></p>
                <div className="mt-3 h-1.5 bg-white/10"><div className="h-full bg-[var(--accent)]" style={{width:claimedPercent+'%'}}/></div>
                <Link to="/join" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline">Invite swimmers to claim <ArrowRight size={15}/></Link>
              </section>

              <section className="border p-5 sm:p-6" style={cardStyle}>
                <h2 className="text-lg font-bold text-white">Site at a glance</h2>
                <div className="mt-4 divide-y divide-[var(--navy-light)] border-t border-[var(--navy-light)]">
                  {[['Public results',counts.published_results],['Athlete profiles',counts.swimmer_profiles],['Claimed profiles',counts.claimed_profiles],['Registered accounts',counts.registered_accounts],['Published articles',counts.published_articles]].map(([label,value])=><div key={String(label)} className="flex items-center justify-between gap-3 py-3"><span className="text-sm text-white/65">{String(label)}</span><strong className="font-mono text-base font-bold text-white">{Number(value??0).toLocaleString()}</strong></div>)}
                </div>
                {Number(counts.published_articles??0)===0&&<p className="mt-1 text-xs leading-4 text-white/45">No articles yet. The News page shows its “coming soon” state until one is published.</p>}
              </section>

              <button type="button" onClick={()=>setTab('Data quality')} className="w-full border p-5 text-left transition-colors hover:border-[var(--accent)] sm:p-6" style={cardStyle}><span className="flex items-center justify-between gap-3"><span className="text-lg font-bold text-white">Data quality summary</span><ArrowRight size={15} className="text-[var(--accent)]"/></span><span className="mt-2 block text-sm text-white/55">Directory checks are available for duplicate names, capitalization and missing country details.</span><span className="mt-3 block font-mono text-xs text-white/40">Result-level checks need backend support.</span></button>

              <section className="border p-5 sm:p-6" style={cardStyle}>
                <p className="text-sm font-semibold text-[var(--accent)]">System</p><h2 className="mt-2 text-lg font-bold text-white">Next World Games · {world2027?.host_city??'Leuven'}, {world2027?.host_country??'Belgium'}</h2>
                <div className="mt-3 space-y-1 text-xs text-white/50"><p>Last backup · Not reported</p><p>Last import · {batches[0]?.created_at ? new Date(batches[0].created_at).toLocaleString('en-ZA') : 'No import recorded'}</p></div>
                <p className="mt-1 text-sm text-white/60">{world2027?.meet_date?new Date(String(world2027.meet_date)+'T00:00:00').toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):'1 Aug'}{world2027?.end_date?'–'+new Date(String(world2027.end_date)+'T00:00:00').toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''} {world2027?.year??2027} · {daysUntilGames===null?'dates to be confirmed':daysUntilGames+' days away'}</p>
                <p className="mt-4 text-sm leading-5 text-white/65">Results import opens when the official files are published.</p>
              </section>
            </aside>
          </div>
        </>}
        {tab==='Historical archive' && <div className="space-y-5">
          <div className="border p-5 sm:p-6" style={cardStyle}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Bulk import · all meets</p>
            <h1 className="mt-1 text-xl font-bold text-white">Historical swimmers archive</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">Import the complete historical dataset in one operation. This page has no meet selector; it creates or refreshes archive-imported swimmer profiles and eligible historical results. Profiles created through Join or Profile are kept separate from archive updates.</p>
          </div>
          <AdminHistoricalImport cardStyle={cardStyle} onNotice={setNotice} onError={setError} onImported={()=>void load()} />
        </div>}
        {tab==='Imports' && <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--navy-light)]">
            <div className="flex gap-1" role="tablist" aria-label="Import type"><button type="button" role="tab" aria-selected={importView==='new'} onClick={()=>{setImportView('new');setSearchParams({tab:'new'},{replace:true});setImportWizardOpen(false);}} className={`border-b-2 px-3 py-2.5 text-sm ${importView==='new'?'border-[var(--accent)] font-semibold text-white':'border-transparent text-white/55'}`}>New meet</button><button type="button" role="tab" aria-selected={importView==='archive'} onClick={()=>{setImportView('archive');setSearchParams({tab:'archive'},{replace:true});setArchiveImportOpen(false);}} className={`border-b-2 px-3 py-2.5 text-sm ${importView==='archive'?'border-[var(--accent)] font-semibold text-white':'border-transparent text-white/55'}`}>Historical archive <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">{batches.length}</span></button></div>
            {importView==='new'&&<button type="button" onClick={()=>setImportWizardOpen(open=>!open)} className="mb-2 inline-flex items-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"><Upload size={15}/>{importWizardOpen?'Close import':'Start import'}</button>}
          </div>
          {importView==='new' ? <>
            {!importWizardOpen ? <section className="border p-6 sm:p-8" style={cardStyle}><h2 className="text-lg font-bold text-white">{pendingMeetImports.length} {pendingMeetImports.length===1?'meet is':'meets are'} waiting for results</h2><p className="mt-1 text-sm text-white/55">{pendingMeetImports.length ? pendingMeetImports.map(meet=>meet.name).join(', ')+'.' : 'All recent meets have results staged or published.'}</p>{pendingMeetImports.length>0&&<div className="mt-5 flex flex-wrap gap-2">{pendingMeetImports.map(meet=><button key={meet.id} type="button" onClick={()=>{setSelectedMeetId(meet.id);setImportWizardOpen(true);}} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/75 hover:border-[var(--accent)] hover:text-[var(--accent)]">{meet.name} · {meet.year}</button>)}</div>}{pendingMeetImports.length>0&&<button type="button" onClick={()=>{setSelectedMeetId(pendingMeetImports[0].id);setImportWizardOpen(true);}} className="mt-5 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)]">Start import</button>}</section> : <>
              <div className="border p-5 sm:p-6" style={cardStyle}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Official swimming results</p><h2 className="mt-1 text-xl font-bold text-white">Create an import</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Files enter private staging first. CSV and version 1 JSON can be parsed now; PDF, spreadsheet and arbitrary website extraction will be identified as unsupported until their parsers are configured.</p></div><span className="font-mono text-xs uppercase text-white/50">Never invent missing profile or medical details</span></div>
                <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs uppercase tracking-widest text-white/60">Meet<select value={selectedMeetId} onChange={event=>setSelectedMeetId(event.target.value)} className={`${inputClass} mt-2 normal-case tracking-normal`}>{meets.map(meet=><option key={meet.id} value={meet.id}>{meet.name} · {meet.year}</option>)}</select></label><label className="text-xs uppercase tracking-widest text-white/60">Official results URL (coming soon)<input value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="HTTPS source URL" className={`${inputClass} mt-2`} disabled /></label></div>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-3 border border-[var(--navy-light)] px-4 py-3 text-sm font-semibold text-white hover:border-[var(--accent)]"><span>{busy?'Importing…':'Upload official source file'}</span><input type="file" accept=".csv,.json,.pdf,.xls,.xlsx,application/json,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={busy} onChange={(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(file)void startImport(file);event.target.value='';}} /></label>
              </div>
              <div className="border p-5" style={cardStyle}><h2 className="mb-4 font-bold text-white">Recent imports</h2>{batches.length?<div className="divide-y divide-[var(--navy-light)]">{batches.slice(0,8).map(batch=><button key={batch.id} onClick={()=>void openBatch(batch)} className={`flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left ${selectedBatch?.id===batch.id?'text-[var(--accent)]':'hover:bg-[var(--navy)]'}`}><span><span className="block text-sm font-semibold text-white">{meets.find(meet=>meet.id===batch.meet_catalog_id)?.name??batch.file_name??'Meet import'}</span><span className="mt-1 block text-xs text-white/50">{batch.stage_count.toLocaleString()} swims · {new Date(batch.created_at).toLocaleDateString('en-ZA')}</span></span><span className="font-mono text-xs uppercase text-[var(--accent)]">{batch.status.replaceAll('_',' ')}</span></button>)}</div>:<p className="text-sm text-white/55">No imports have been created yet.</p>}</div>
            </>}
            {selectedBatch && <div className="border p-5" style={cardStyle}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Review staged results</h2><p className="mt-1 text-xs text-white/55">{selectedBatch.progress} · {rows.length} rows</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportBatchJson} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white">Export version 1 JSON</button><button type="button" disabled={busy||rows.some(row=>row.review_action==='pending')} onClick={()=>void publishBatch()} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40">Publish approved results</button>{isOwner&&selectedBatch.status==='published'&&<button type="button" className="border border-red-300/40 px-3 py-2 text-xs font-bold text-red-200" onClick={async()=>{if(!supabase)return;setBusy(true);try{const {error:rpcError}=await supabase.rpc('admin_rollback_import_batch',{p_batch_id:selectedBatch.id});if(rpcError)throw rpcError;setNotice('The batch was rolled back. Independently changed results are preserved.');await load();}catch(e){setError(describeSupabaseError(e));}finally{setBusy(false);}}}>Roll back batch</button>}</div></div><input className={`${inputClass} mt-4 max-w-sm`} placeholder="Filter staged swimmers or events" value={search} onChange={event=>setSearch(event.target.value)} />
              {rows.length===0?<div className="mt-4"><EmptyState title="No rows staged" subtitle="This import contains no parseable result rows yet." onDark /></div>:<div className="mt-4 space-y-3">{filteredRows.map(row=><article key={row.id} className="border border-[var(--navy-light)] bg-[var(--navy)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-white">{row.swimmer_name} <span className="font-normal text-white/55">· {row.country||'Country not supplied'}</span></div><p className="mt-1 text-sm text-[var(--accent)]">{row.event} · {row.gender||'Gender unknown'} · {row.age_group||'Age group unknown'} · {row.course||'Course unknown'}</p><p className="mt-1 font-mono text-sm text-white">{row.time_original||row.race_status} <span className="text-white/45">{row.round_name||''} {row.placing?`· ${row.placing}`:''}</span></p>{row.validation_issues?.length>0&&<p className="mt-2 text-xs text-amber-200">{row.validation_issues.join(' · ')}</p>}<p className="mt-2 font-mono text-[10px] uppercase text-white/45">{row.validation_state} · {row.is_relay?'Relay':'Individual'} · {row.review_action}</p></div><div className="flex flex-wrap gap-2">{row.race_status!=='OK'||row.is_relay?<button disabled={busyRow===row.id} onClick={()=>void reviewRow(row,'publish')} className="border border-[var(--accent)]/50 px-3 py-2 text-xs font-semibold text-[var(--accent)]">Approve official row</button>:<button disabled={busyRow===row.id} onClick={()=>void findMatches(row)} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white">Find profile</button>}<button disabled={busyRow===row.id} onClick={()=>void reviewRow(row,'skip')} className="px-3 py-2 text-xs text-white/55">Skip</button></div></div>{swimmerMatches[row.id]&&<div className="mt-3 border-t border-[var(--navy-light)] pt-3"><p className="mb-2 text-xs text-white/55">Profile suggestions are advisory only; a name match alone never confirms identity.</p>{swimmerMatches[row.id].length?swimmerMatches[row.id].map(match=><div key={match.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="text-sm text-white">{match.first_name} {match.last_name} · {match.country}</span><input aria-label={`Identity evidence for ${match.first_name} ${match.last_name}`} value={identityEvidence[row.id]??''} onChange={event=>setIdentityEvidence(current=>({...current,[row.id]:event.target.value}))} placeholder="Source evidence confirming identity" className="min-w-48 border border-[var(--navy-light)] bg-[var(--navy-mid)] px-2 py-1.5 text-xs text-white placeholder:text-white/40" /><button disabled={(identityEvidence[row.id]??'').trim().length<12} onClick={()=>void linkExistingAndApprove(row,match.id,identityEvidence[row.id]??'')} className="text-xs font-bold text-[var(--accent)] disabled:opacity-40">Verify, link and approve →</button></div>):stagedSwimmers.some(item=>item.source_key===row.swimmer_source_key&&item.country)?<button disabled={busyRow===row.id} onClick={()=>void createUnclaimedAndApprove(row)} className="mt-2 text-xs font-bold text-[var(--accent)]">Create unclaimed profile and approve →</button>:<p className="text-sm text-white/50">No possible profile match. A country is needed before an unclaimed profile can be created.</p>}</div>}</article>)}</div>}</div>}
          </> : <>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/55">Historical import batches and their current review state.</p><button type="button" onClick={()=>setArchiveImportOpen(open=>!open)} className="border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">{archiveImportOpen?'Close archive import':'Import historical archive'}</button></div>
            <section className="border" style={cardStyle}><div className="grid grid-cols-[minmax(0,1.4fr)_1fr_0.5fr_0.7fr_1fr] gap-3 border-b border-[var(--navy-light)] px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-white/45"><span>Meet</span><span>Source</span><span className="text-right">Swims</span><span>Imported</span><span className="text-right">Status</span></div>{batches.length ? batches.map(batch=>{const meet=meets.find(item=>item.id===batch.meet_catalog_id);return <button key={batch.id} type="button" onClick={()=>void openBatch(batch)} className="grid w-full grid-cols-[minmax(0,1.4fr)_1fr_0.5fr_0.7fr_1fr] items-center gap-3 border-b border-[var(--navy-light)] px-5 py-3 text-left last:border-0 hover:bg-[var(--navy)]"><span className="truncate text-sm font-semibold text-white">{meet?.name??batch.file_name??'Historical import'}</span><span className="truncate text-sm text-white/55">{batch.source_url?'Official results URL':batch.file_name??'Archive scan'}</span><span className="text-right font-mono text-sm text-white">{batch.stage_count.toLocaleString()}</span><span className="text-sm text-white/55">{new Date(batch.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})}</span><span className="text-right text-xs text-amber-300">{batch.status.replaceAll('_',' ')}</span></button>}) : <div className="p-5"><EmptyState title="No historical imports yet" subtitle="Older meet imports will appear here once they are staged." onDark /></div>}</section>
            {archiveImportOpen&&<AdminHistoricalImport cardStyle={cardStyle} onNotice={setNotice} onError={setError} onImported={()=>void load()} />}
          </>}
        </div>}
        {tab==='Swimmers' && <><div className="mb-5 flex flex-wrap gap-5 border-b border-[var(--navy-light)]" role="tablist" aria-label="Swimmer profile views">{([['all','All'],['claims','Claims pending'],['unclaimed','Unclaimed'],['duplicates','Possible duplicates']] as const).map(([view,label])=><button key={view} type="button" role="tab" aria-selected={swimmersView===view} onClick={()=>{setSwimmersView(view);setSearchParams(view==='claims'?{tab:'claims'}:{tab:'swimmers',view});}} className={`border-b-2 px-1 py-2.5 text-sm ${swimmersView===view?'border-[var(--accent)] font-semibold text-white':'border-transparent text-white/55'}`}>{label}<span className={`ml-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] ${swimmersView===view?'bg-[var(--accent)] text-[var(--navy)]':'bg-white/10 text-white/60'}`}>{view==='all'?swimmerRows.length.toLocaleString():view==='claims'?Number(counts.pending_claims??0).toLocaleString():view==='unclaimed'?Math.max(0,swimmerRows.filter(row=>!row.account_id&&!row.is_claimed).length).toLocaleString():String(new Set(swimmerRows.map(row=>`${row.first_name} ${row.last_name}`.trim().toLowerCase()).filter(name=>name&&swimmerRows.filter(row=>`${row.first_name} ${row.last_name}`.trim().toLowerCase()===name).length>1)).size)}</span></button>)}</div>{swimmersView==='claims'?<div className="border" style={cardStyle}>{claimRows.filter(claim=>claim.status==='pending').length?claimRows.filter(claim=>claim.status==='pending').map(claim=><article key={String(claim.id)} className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--navy-light)] px-5 py-4 last:border-0"><div><p className="text-sm font-semibold text-white">Profile claim · {String(claim.swimmer_profile_id).slice(0,8)}</p><p className="mt-1 text-xs text-white/50">Submitted {new Date(String(claim.created_at)).toLocaleDateString('en-ZA')}</p><p className="mt-2 text-sm leading-5 text-white/70">{String(claim.evidence)}</p></div><div className="flex flex-wrap gap-2">{(['approved','rejected','disputed','correction_requested','removal_requested'] as const).map(decision=><button key={decision} disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),decision)} className={`border px-3 py-2 text-xs font-semibold ${decision==='approved'?'border-[var(--accent)] bg-[var(--accent)] text-[var(--navy)]':'border-[var(--navy-light)] text-white/75'}`}>{decision.replaceAll('_',' ')}</button>)}</div></article>):<div className="p-5"><EmptyState title="No claims waiting" subtitle="When swimmers request a profile claim, it will appear here for review." onDark /></div>}</div>:<AdminSwimmersManager swimmers={swimmerRows} canManage={canManageSwimmers && swimmerAdminRpcAvailable} onChanged={()=>loadTabData('Swimmers')} view={swimmersView} />}</>}
        {tab==='Meets and results' && <AdminMeetsManager meets={meets} batchSummary={batches.map(({id,meet_catalog_id,status,published_count})=>({id,meet_catalog_id,status,published_count}))} cardStyle={cardStyle} inputClass={inputClass} onError={setError} onNotice={setNotice} onRefresh={() => void load().catch(reason => setError(describeSupabaseError(reason)))} onAddResults={meetId => { setSelectedMeetId(meetId); setSelectedBatch(null); setTab('Imports'); }} onOpenBatch={batchId => { const batch = batches.find(item => item.id === batchId); if (batch) { setTab('Imports'); void openBatch(batch); } }} />}
        {tab==='Profile claims' && <div className="border p-5" style={cardStyle}><h2 className="mb-4 font-bold text-white">Profile claim queue</h2>{claimRows.length?claimRows.map(claim=><article key={String(claim.id)} className="mb-3 border border-[var(--navy-light)] bg-[var(--navy)] p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">{String(claim.status)} · swimmer {String(claim.swimmer_profile_id).slice(0,8)}</p><p className="mt-2 text-sm text-white">Claimant {String(claim.claimant_id)}</p><p className="mt-2 text-sm leading-6 text-white/70">{String(claim.evidence)}</p><p className="mt-2 text-xs text-white/40">{String(claim.created_at)}</p>{claim.status==='pending'&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'approved')} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)]">Approve and link account</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'rejected')} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70">Reject</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'disputed')} className="border border-amber-300/40 px-3 py-2 text-xs text-amber-200">Dispute</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'correction_requested')} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70">Request correction</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'removal_requested')} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70">Request removal</button></div>}</article>):<EmptyState title="No pending claims" subtitle="Verified users can submit an identity claim for a published swimmer profile." onDark />}</div>}
        {tab==='Records' && <div className="border p-5" style={cardStyle}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">WTG record candidates</h2><p className="mt-2 text-sm text-white/55">Candidates compare event, age, gender, category and course against the sourced WTG baseline. Missing eligibility or baseline data needs manual review.</p></div><button disabled={!canConfirmRecords||busy||selectedMeet?.status!=='completed'} onClick={()=>void checkWTGRecords()} title={!canConfirmRecords?'Your admin role can view candidates but cannot run record checks.':undefined} className="border border-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--accent)] disabled:opacity-40">{canConfirmRecords?'Check for WTG records':'Record checker access required'}</button></div>{selectedMeet?.status!=='completed'&&<p className="mt-3 text-xs text-white/45">Record checks are enabled after the selected Games edition is marked completed. The 2027 Leuven Games are still upcoming.</p>}{recordRows.length?recordRows.map(item=>{const performance=item.imported_official_performances as Record<string,unknown>|null;return <article key={String(item.id)} className="mt-4 border border-[var(--navy-light)] bg-[var(--navy)] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">{String(item.status).replaceAll('_',' ')}</p><h3 className="mt-1 font-semibold text-white">{String(performance?.swimmer_name??'Swimmer/team needs review')} · {String(performance?.event??'Unknown event')}</h3><p className="mt-1 text-xs text-white/55">{String(performance?.age_group??'Age unknown')} · {String(performance?.gender??'Gender unknown')} · {String(performance?.course??'Course unknown')} · new {String(performance?.time_original??'—')}</p><p className="mt-1 text-xs text-white/50">Baseline {String(item.baseline_record_id??'not found')} · {item.old_time_ms==null?'time unavailable':`${Number(item.old_time_ms)/1000}s`} · improvement {item.improvement_ms==null?'—':`${Number(item.improvement_ms)/1000}s`}</p></div></div>{['potential_record','equalled'].includes(String(item.status))&&canConfirmRecords&&<div className="mt-4 flex flex-wrap gap-2"><input value={recordEvidence[String(item.id)]??''} onChange={event=>setRecordEvidence(current=>({...current,[String(item.id)]:event.target.value}))} className="min-w-64 flex-1 border border-[var(--navy-light)] bg-[var(--navy-mid)] px-3 py-2 text-xs text-white placeholder:text-white/40" placeholder="Official WTG confirmation evidence URL or reference" /><button disabled={busyRow===item.id||(recordEvidence[String(item.id)]??'').trim().length<12} onClick={()=>void confirmWTGRecord(String(item.id))} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40">Confirm official record</button></div>}</article>}):<div className="mt-5"><EmptyState title="No record candidates" subtitle="After a completed WTG meet has published official swimming results, run the record checker here." onDark /></div>}</div>}
        {tab==='Roles and permissions' && <><div className="mb-5 flex gap-6 border-b border-[var(--navy-light)]" role="tablist" aria-label="Team sections"><button type="button" role="tab" aria-selected={teamView==='members'} onClick={()=>setTeamView('members')} className={`border-b-2 px-1 py-2.5 text-sm ${teamView==='members'?'border-[var(--accent)] font-semibold text-white':'border-transparent text-white/55'}`}>Members <span className="ml-1 rounded-full bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--navy)]">{memberRows.length}</span></button><button type="button" role="tab" aria-selected={teamView==='permissions'} onClick={()=>setTeamView('permissions')} className={`border-b-2 px-1 py-2.5 text-sm ${teamView==='permissions'?'border-[var(--accent)] font-semibold text-white':'border-transparent text-white/55'}`}>Roles & permissions</button></div>{teamView==='permissions'?<section className="border" style={cardStyle}><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] text-xs text-white/55"><th className="px-5 py-3">Permission</th><th className="px-4 py-3 text-center">Owner</th><th className="px-4 py-3 text-center">Admin</th><th className="px-4 py-3 text-center">Verifier</th><th className="px-4 py-3 text-center">Writer</th></tr></thead><tbody>{[['publish_results','Verify results'],['import_results','Import results'],['merge_swimmers','Merge and edit swimmers'],['manage_articles','Write articles'],['publish_articles','Publish articles'],['manage_roles','Manage team and settings']].map(([permission,label])=><tr key={permission} className="border-b border-[var(--navy-light)] last:border-0"><td className="px-5 py-3 text-white">{label}</td>{(['owner','administrator','results_editor','writer'] as const).map(role=>{const allowed=role==='writer'?permission==='manage_articles':permissionsForRole(role).includes(permission);return <td key={role} className={`px-4 py-3 text-center ${allowed?'text-[var(--accent)]':'text-white/30'}`}>{allowed?'✓':'—'}</td>;})}</tr>)}</tbody></table></div></section>:<div className="border p-5" style={cardStyle}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-white">Roles and permissions</h2><p className="mt-1 text-sm text-white/60">Manage admin access and capabilities.</p></div>{canManageWriters&&<button type="button" onClick={()=>setTab('Writers')} className="border border-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">Writer accounts →</button>}</div>{isOwner?<><p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">Owner has full access. Administrators manage platform data; Results editors need a separate publication permission; Claim reviewers cannot change times or roles.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={accountQuery} onChange={event=>void searchAdminAccounts(event.target.value)} placeholder="Search registered accounts by email" className={inputClass} /><select value={newRole} onChange={event=>setNewRole(event.target.value)} className={inputClass}><option value="administrator">Administrator</option><option value="results_editor">Results editor</option><option value="claim_reviewer">Claim reviewer</option><option value="owner">Owner</option></select></div>{accountMatches.map(account=><button key={String(account.user_id)} disabled={busy} onClick={()=>void addAdminMember(String(account.user_id),String(account.email))} className="mt-2 flex w-full justify-between border border-[var(--navy-light)] px-3 py-2 text-left text-sm text-white hover:border-[var(--accent)]"><span>{String(account.email)}</span><span className="text-[var(--accent)]">Add as {newRole.replaceAll('_',' ')} →</span></button>)}<div className="mt-5 space-y-2">{memberRows.map(member=><div key={String(member.user_id)} className="flex flex-wrap items-center justify-between gap-3 border border-[var(--navy-light)] bg-[var(--navy)] p-3"><div><p className="text-sm font-semibold text-white">{String(member.email)}</p><p className="mt-1 font-mono text-[10px] uppercase text-white/45">{String(member.role)} · {member.is_active?'active':'inactive'}</p></div><div className="flex flex-wrap items-center gap-2"><select disabled={member.user_id===currentUserId} defaultValue={String(member.role)} onChange={event=>void changeAdminRole(String(member.user_id),event.target.value,Boolean(member.is_active))} className="border border-[var(--navy-light)] bg-[var(--navy-mid)] px-2 py-2 text-xs text-white"><option value="owner">Owner</option><option value="administrator">Administrator</option><option value="results_editor">Results editor</option><option value="claim_reviewer">Claim reviewer</option></select>{member.user_id!==currentUserId&&<button onClick={()=>void changeAdminRole(String(member.user_id),String(member.role),!Boolean(member.is_active))} className="border border-[var(--navy-light)] px-2 py-2 text-xs text-white/70">{member.is_active?'Deactivate':'Reactivate'}</button>}</div>{member.role!=='owner'&&<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{['publish_results','rollback_imports','merge_swimmers','review_claims','confirm_records','manage_writers','manage_articles'].map(permission=>{const userId=String(member.user_id);const role=String(member.role);const isAllowed=memberOverrides[userId]?.[permission]??permissionsForRole(role).includes(permission);return <label key={permission} className="inline-flex items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={isAllowed} disabled={userId===currentUserId||busy} onChange={event=>void changeAdminPermission(userId,permission,event.target.checked)} className="accent-[var(--accent)]" />{permission.replaceAll('_',' ')}</label>;})}</div>}</div>)}</div></>:<EmptyState title="Owner permission required" subtitle="Only an Owner can add administrators and manage platform roles." onDark />}</div>}</>}
        {tab==='Writers' && <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]"><section className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Invite a writer</h2><p className="mt-2 text-sm leading-6 text-white/60">Supabase sends a secure invitation link. Writers choose their own password on first access; no shared default password is sent.</p><label className="mt-5 block text-xs font-semibold text-white/75">Writer name<input value={writerDisplayName} onChange={event=>setWriterDisplayName(event.target.value)} className={`${inputClass} mt-2`} placeholder="Full name" /></label><label className="mt-4 block text-xs font-semibold text-white/75">Email address<input type="email" value={writerEmail} onChange={event=>setWriterEmail(event.target.value)} className={`${inputClass} mt-2`} placeholder="writer@example.com" /></label><button disabled={busy||!writerEmail.trim()||writerDisplayName.trim().length<2} onClick={()=>void inviteWriter()} className="mt-5 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:opacity-40">{busy?'Sending…':'Send writer invitation'}</button></section><section className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Writer accounts</h2>{writerRows.length?<div className="ta-table-scroll mt-4"><SortableTable><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] font-mono text-[10px] uppercase tracking-widest text-white/45">{['Writer','Status','Stories','Drafts','Review','Published'].map(label=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{writerRows.map(writer=><tr key={String(writer.user_id)} className="border-b border-[var(--navy-light)] last:border-0"><td className="px-3 py-3"><p className="font-semibold text-white">{String(writer.display_name)}</p><p className="text-xs text-white/50">{String(writer.email)}</p></td><td className="px-3 py-3 text-white/70">{writer.status==='invited'?'Pending invitation':String(writer.status)}</td>{['article_count','draft_count','submitted_count','published_count'].map(key=><td key={key} className="px-3 py-3 font-mono text-white/70">{String(writer[key]??0)}</td>)}</tr>)}</tbody></table></SortableTable></div>:<EmptyState title="No writers yet" subtitle="Invite a writer to give them access to the authoring workspace." onDark />}</section></div>}
        {tab==='About page' && <AdminAboutContent />}
        {tab==='Contact inbox' && <AdminContactInbox cardStyle={cardStyle} />}
        {tab==='Articles' && <div className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Editorial review queue</h2><p className="mt-2 text-sm text-white/60">Review each submission, request edits when needed, then publish it as a feature story or a standard article.</p>{submittedArticles.length?submittedArticles.map(article=><article key={String(article.id)} className="mt-5 border border-[var(--navy-light)] bg-[var(--navy)] p-4 sm:p-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">{article.cover_image?<img src={String(article.cover_image)} alt="" className="aspect-[16/9] w-full object-cover lg:order-2" />:null}<div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">{String(article.category)} · {String(article.access)} · by {String(article.author_name)}</p><h3 className="mt-2 text-xl font-bold text-white">{String(article.title)}</h3><p className="mt-2 text-sm leading-6 text-white/65">{String(article.excerpt)}</p><p className="mt-3 line-clamp-5 whitespace-pre-line text-sm leading-6 text-white/45">{String(article.body)}</p></div></div><label className="mt-4 block text-xs font-semibold text-white/65">Note for writer<textarea rows={2} value={articleNotes[String(article.id)]??''} onChange={event=>setArticleNotes(current=>({...current,[String(article.id)]:event.target.value}))} className={`${inputClass} mt-2`} placeholder="Optional feedback or requested changes" /></label><div className="mt-4 flex flex-wrap gap-2"><button disabled={busyRow===article.id} onClick={()=>void moderateArticle(String(article.id),'publish',false)} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)]">Publish article</button><button disabled={busyRow===article.id} onClick={()=>void moderateArticle(String(article.id),'publish',true)} className="border border-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--accent)]">Publish as feature</button><button disabled={busyRow===article.id||(articleNotes[String(article.id)]??'').trim().length<8} onClick={()=>void moderateArticle(String(article.id),'request_changes')} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/75 disabled:opacity-40">Request changes</button><button disabled={busyRow===article.id} onClick={()=>void moderateArticle(String(article.id),'reject')} className="px-3 py-2 text-xs text-red-300">Decline</button></div></article>):<div className="mt-5"><EmptyState title="No articles awaiting review" subtitle="Writer submissions will appear here. Published stories appear in From the Pool Deck." onDark /></div>}</div>}
        {tab==='Activity log' && <div className="border p-5" style={cardStyle}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Audit log</h2><p className="mt-1 text-xs text-white/50">Latest {activityRows.length} recorded actions. Identical actions within two minutes are grouped.</p></div><button type="button" onClick={exportAuditCsv} disabled={!filteredActivityRows.length} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Export CSV</button></div><div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter audit log">{(['All','Swimmers','Imports','Meets','Content'] as const).map(filter=><button key={filter} type="button" aria-pressed={auditFilter===filter} onClick={()=>setAuditFilter(filter)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${auditFilter===filter?'border-[var(--accent)] bg-[var(--accent)] text-[var(--navy)]':'border-[var(--navy-light)] text-white/65 hover:border-[var(--accent)]'}`}>{filter}</button>)}</div>{auditGroups.length ? <div className="divide-y divide-[var(--navy-light)]">{auditGroups.map((group,index)=>{const first=group[0];const id=String(first.id??index);const expanded=expandedAuditGroups.includes(id);const action=String(first.action??'admin_update').replaceAll('_',' ');return <section key={id} className="py-3"><button type="button" aria-expanded={expanded} onClick={()=>setExpandedAuditGroups(current=>expanded?current.filter(value=>value!==id):[...current,id])} className="flex w-full items-center justify-between gap-4 text-left"><span><span className="block text-sm font-semibold text-white">You {action}{group.length>1?` · ${group.length} actions`:''}</span><span className="mt-1 block text-xs text-white/50">{String(first.target_type??'record').replaceAll('_',' ')} · {new Date(String(first.created_at)).toLocaleString()}</span></span><ChevronDown size={15} className={`shrink-0 text-white/45 transition-transform ${expanded?'rotate-180':''}`} /></button>{expanded&&<div className="mt-3 space-y-2 border-l border-[var(--navy-light)] pl-4">{group.map((item,itemIndex)=><div key={String(item.id??itemIndex)} className="text-xs text-white/60"><span className="font-mono text-white/40">{new Date(String(item.created_at)).toLocaleString()}</span> · {String(item.action??'admin_update').replaceAll('_',' ')} · {String(item.target_type??'record')} {item.target_id?`#${String(item.target_id).slice(0,12)}`:''}{Boolean(item.details)&&<p className="mt-1 text-white/45">{typeof item.details==='string'?item.details:JSON.stringify(item.details)}</p>}</div>)}</div>}</section>;})}</div> : <EmptyState title="No audit entries" subtitle="Administrative actions will appear here when available." onDark />}</div>}
        </section>
      </main>
    </div>
  </>;
}
