import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Award, CalendarDays, FileCheck2, FilePlus2, LayoutDashboard, Megaphone, Newspaper, PenSquare, RefreshCw, ShieldCheck, Upload, UsersRound } from 'lucide-react';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import Logo from '../components/Logo';
import AdminArticleComposer from '../components/AdminArticleComposer';
import AdminArticleLibrary from '../components/AdminArticleLibrary';
import AdminAdCampaigns from '../components/AdminAdCampaigns';
import AdminMeetsManager, { type AdminMeet } from '../components/AdminMeetsManager';
import { useAuth } from '../contexts/AuthContext';
import { hasSupabaseConfig, supabase, describeSupabaseError } from '../lib/supabase';
import { permissionsForRole } from '../lib/adminImports';

type Tab = 'Overview' | 'Imports' | 'Swimmers' | 'Meets and results' | 'Profile claims' | 'Records' | 'Writers' | 'Write article' | 'Article library' | 'Articles' | 'Ads' | 'Roles and permissions' | 'Activity log';
type Batch = { id: string; status: string; progress: string; error_message: string | null; stage_count: number; published_count: number; file_name: string | null; created_at: string; published_at: string | null; meet_catalog_id: string; source_url: string | null };
type Meet = AdminMeet;
type ImportResult = { id: string; swimmer_source_key: string | null; swimmer_name: string; country: string | null; event: string; age_group: string | null; gender: string | null; course: string | null; time_original: string | null; time_ms: number | null; race_status: string; is_relay: boolean; round_name: string | null; placing: string | null; validation_state: string; validation_issues: string[]; review_action: string; linked_swimmer_id: string | null; source_references: unknown[] };
type StagedSwimmer = { id: string; source_key: string; first_name: string; last_name: string; country: string | null; resolved_swimmer_id: string | null; resolution: string };

const navigationGroups: { label: string; items: { tab: Tab; label: string; icon: typeof LayoutDashboard; countKey?: string }[] }[] = [
  { label: 'Workspace', items: [
    { tab: 'Overview', label: 'Overview', icon: LayoutDashboard },
    { tab: 'Imports', label: 'Results imports', icon: Upload },
    { tab: 'Swimmers', label: 'Swimmers', icon: UsersRound },
    { tab: 'Meets and results', label: 'Meets', icon: CalendarDays },
  ] },
  { label: 'Review', items: [
    { tab: 'Profile claims', label: 'Profile claims', icon: FileCheck2, countKey: 'pending_claims' },
    { tab: 'Records', label: 'Record candidates', icon: Award, countKey: 'record_candidates' },
    { tab: 'Articles', label: 'Article review', icon: Newspaper, countKey: 'articles_in_review' },
  ] },
  { label: 'Publishing', items: [
    { tab: 'Write article', label: 'Write article', icon: FilePlus2 },
    { tab: 'Article library', label: 'Article library', icon: Newspaper },
    { tab: 'Ads', label: 'Ads and campaigns', icon: Megaphone },
    { tab: 'Writers', label: 'Writers', icon: PenSquare },
  ] },
  { label: 'Administration', items: [
    { tab: 'Roles and permissions', label: 'Roles & permissions', icon: ShieldCheck },
    { tab: 'Activity log', label: 'Activity log', icon: Activity },
  ] },
];
const cardStyle = { border: '1px solid var(--navy-light)', backgroundColor: 'var(--navy-mid)' };
const inputClass = 'w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
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
  const [swimmerRows, setSwimmerRows] = useState<Record<string, unknown>[]>([]);
  const [memberRows,setMemberRows]=useState<Record<string,unknown>[]>([]);
  const [memberOverrides,setMemberOverrides]=useState<Record<string,Record<string,boolean>>>({});
  const [accountQuery,setAccountQuery]=useState('');
  const [accountMatches,setAccountMatches]=useState<Record<string,unknown>[]>([]);
  const [newRole,setNewRole]=useState('administrator');
  const [recordEvidence,setRecordEvidence]=useState<Record<string,string>>({});
  const [canManageWriters,setCanManageWriters]=useState(false);
  const [canManageArticles,setCanManageArticles]=useState(false);
  const [canImportResults,setCanImportResults]=useState(false);
  const [canReviewClaims,setCanReviewClaims]=useState(false);
  const [canConfirmRecords,setCanConfirmRecords]=useState(false);
  const [canManageRoles,setCanManageRoles]=useState(false);
  const [selectedArticleId,setSelectedArticleId]=useState('');
  const [writerRows,setWriterRows]=useState<Record<string,unknown>[]>([]);
  const [submittedArticles,setSubmittedArticles]=useState<Record<string,unknown>[]>([]);
  const [writerEmail,setWriterEmail]=useState('');
  const [writerDisplayName,setWriterDisplayName]=useState('');
  const [articleNotes,setArticleNotes]=useState<Record<string,string>>({});
  const auth=useAuth();

  const load = useCallback(async () => {
    if (!supabase) return;
    setError('');
    const { data: hasAccess, error: permissionError } = await supabase.rpc('has_admin_permission', { p_permission: 'view_admin' });
    if (permissionError) throw permissionError;
    setAuthorized(Boolean(hasAccess));
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    setCurrentUserId(currentUser?.id??'');
    if (!hasAccess) return;
    const [writerPermission,articlePermission,importPermission,claimPermission,recordPermission,rolePermission]=await Promise.all([
      supabase.rpc('has_admin_permission',{p_permission:'manage_writers'}),
      supabase.rpc('has_admin_permission',{p_permission:'manage_articles'}),
      supabase.rpc('has_admin_permission',{p_permission:'import_results'}),
      supabase.rpc('has_admin_permission',{p_permission:'review_claims'}),
      supabase.rpc('has_admin_permission',{p_permission:'confirm_records'}),
      supabase.rpc('has_admin_permission',{p_permission:'manage_roles'}),
    ]);
    for (const permissionResult of [writerPermission,articlePermission,importPermission,claimPermission,recordPermission,rolePermission]) {
      if (permissionResult.error) throw permissionResult.error;
    }
    setCanManageWriters(Boolean(writerPermission.data));
    setCanManageArticles(Boolean(articlePermission.data));
    setCanImportResults(Boolean(importPermission.data));
    setCanReviewClaims(Boolean(claimPermission.data));
    setCanConfirmRecords(Boolean(recordPermission.data));
    setCanManageRoles(Boolean(rolePermission.data));
    const { data: membership } = await supabase.from('admin_memberships').select('role').eq('user_id', currentUser?.id ?? '').maybeSingle();
    setIsOwner(membership?.role === 'owner');
    const { data: countsData, error: countError } = await supabase.rpc('admin_dashboard_counts');
    if (countError) throw countError;
    setCounts((countsData ?? {}) as Record<string, number>);
    const meetResponse = await supabase.from('meet_catalog').select('id,catalog_key,category,category_order,series_id,series_name,name,year,edition_number,host_city,host_country,meet_date,end_date,status,source_url').order('category_order').order('year',{ascending:false});
    if (meetResponse.error) throw meetResponse.error;
    setMeets(meetResponse.data ?? []);
    if (importPermission.data) {
      const {data:batchRows,error:batchError}=await supabase.from('admin_import_batches').select('id,status,progress,error_message,stage_count,published_count,file_name,created_at,published_at,meet_catalog_id,source_url').order('created_at',{ascending:false}).limit(100);
      if (batchError) throw batchError;
      setBatches(batchRows ?? []);
    } else setBatches([]);
    setSelectedMeetId(current => current || meetResponse.data?.find(meet => meet.year === 2027)?.id || '');
  }, []);

  useEffect(() => { if (!hasSupabaseConfig) return; void load().catch(reason => setError(describeSupabaseError(reason))); }, [load]);

  const openBatch = async (batch: Batch) => {
    if (!supabase) return;
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
    if (target === 'Swimmers') {
      const { data, error: queryError } = await supabase.rpc('admin_list_swimmer_profiles');
      if (queryError) throw queryError;
      setSwimmerRows((data ?? []) as Record<string, unknown>[]);
      return;
    }
    const query = target === 'Profile claims'
      ? supabase.from('profile_claims').select('id,swimmer_profile_id,claimant_id,evidence,status,created_at,reviewer_note').order('created_at',{ascending:false}).limit(100)
      : target === 'Records'
        ? supabase.from('admin_record_candidates').select('id,status,old_time_ms,new_time_ms,improvement_ms,reviewer_note,created_at,imported_performance_id,baseline_record_id,imported_official_performances(swimmer_name,event,age_group,gender,course,time_original,meet_catalog_id,source_metadata)').order('created_at',{ascending:false}).limit(100)
        : target === 'Activity log'
          ? supabase.from('admin_activity_log').select('id,action,target_type,target_id,batch_id,details,created_at').order('created_at',{ascending:false}).limit(100)
          : null;
    if(target==='Roles and permissions'){
      if(!isOwner){setMemberRows([]);return;}
      const {data,error:roleError}=await supabase.rpc('admin_list_members');if(roleError)throw roleError;setMemberRows((data??[]) as Record<string,unknown>[]);
      const {data:overrideData,error:overrideError}=await supabase.from('admin_permission_overrides').select('user_id,permission,allowed');if(overrideError)throw overrideError;
      const grouped:Record<string,Record<string,boolean>>={};for(const row of overrideData??[]){grouped[row.user_id]??={};grouped[row.user_id][row.permission]=row.allowed;}
      setMemberOverrides(grouped);return;
    }
    if(target==='Writers'){
      if(!canManageWriters){setWriterRows([]);return;}
      const {data,error:writerError}=await supabase.rpc('admin_list_writers');if(writerError)throw writerError;setWriterRows((data??[]) as Record<string,unknown>[]);return;
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
      if(inviteError)throw inviteError;setNotice(data?.message??'Writer invitation sent.');setWriterEmail('');setWriterDisplayName('');await loadTabData('Writers');
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

  useEffect(() => { void loadTabData(tab).catch(reason=>setError(describeSupabaseError(reason))); },[tab,authorized,isOwner,canManageWriters,canManageArticles,currentUserId]);
  const filteredRows = useMemo(() => rows.filter(row => `${row.swimmer_name} ${row.country ?? ''} ${row.event}`.toLowerCase().includes(search.toLowerCase())),[rows,search]);
  const world2027 = meets.find(meet => meet.year === 2027 && meet.category === 'World Transplant Games');
  const selectedMeet = meets.find(meet => meet.id === selectedMeetId);
  const countsItems = [
    ['Swimmer profiles','swimmer_profiles'],['Registered accounts','registered_accounts'],['Claimed profiles','claimed_profiles'],['Unclaimed profiles','unclaimed_profiles'],['Pending claims','pending_claims'],['Published results','published_results'],['Record candidates','record_candidates'],['Active writers','writers'],['Article drafts','article_drafts'],['Articles in review','articles_in_review'],['Published articles','published_articles'],['Feature articles','feature_articles'],
  ];

  const renderRows = (items: Record<string,unknown>[], columns: string[]) => items.length ? <div className="ta-table-scroll"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] text-[10px] uppercase tracking-widest text-white/50">{columns.map(column=><th key={column} className="px-3 py-3">{column.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{items.map((item,index)=><tr key={String(item.id ?? index)} className="border-b border-[var(--navy-light)] last:border-0">{columns.map(column=><td key={column} className="px-3 py-3 text-white/80">{item[column] == null || item[column] === '' ? '—' : String(item[column])}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="No entries yet" subtitle="Approved source data and account activity will appear here." onDark />;

  const sectionDescriptions: Record<Tab, string> = {
    Overview: 'A live summary of swimmers, results, publishing and review activity.',
    Imports: 'Upload official meet files, resolve identities and publish reviewed results.',
    Swimmers: 'Review swimmer profiles and account connections.',
    'Meets and results': 'Manage meet editions and their published results.',
    'Profile claims': 'Review requests to connect public swimmer profiles to accounts.',
    Records: 'Compare verified WTG swims with record baselines and review candidates.',
    Writers: 'Invite and manage contributors for From the Pool Deck.',
    'Write article': 'Draft, preview and publish a story from the admin account.',
    'Article library': 'Find, edit, archive, restore or delete any article on the site.',
    Ads: 'Manage advertisers, campaign dates, placements, rates and invoice status.',
    Articles: 'Review submitted stories and choose how each article goes live.',
    'Roles and permissions': 'Control access to platform management tools.',
    'Activity log': 'Review recent administrative actions and changes.',
  };

  const managementHeader = <header className="sticky top-0 z-40 border-b border-[var(--navy-light)] bg-[var(--navy)]/95 backdrop-blur">
    <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex items-center gap-4"><Link to="/" aria-label="Transplant Aquatics home"><Logo size="md" light /></Link><span className="hidden border-l border-[var(--navy-light)] pl-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] sm:inline">Management console</span></div>
      <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-xs font-semibold text-white">{auth.user?.firstName} {auth.user?.lastName}</p><p className="text-[10px] text-white/45">{isOwner ? 'Owner' : 'Administrator'}</p></div><div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--navy-light)] bg-[var(--navy-mid)] font-mono text-xs font-bold text-[var(--accent)]">{auth.user?.avatarInitials ?? 'AD'}</div><Link to="/" className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">Back to site <span aria-hidden="true">→</span></Link></div>
    </div>
  </header>;

  if (!hasSupabaseConfig) return <>{managementHeader}<PageHeading eyebrow="Administration" title="Admin" /><section className="mx-auto max-w-7xl px-4 py-10"><EmptyState title="Database connection required" subtitle="Configure Supabase before opening the admin workspace." onDark /></section></>;

  if (!authorized) return <>{managementHeader}<main className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="max-w-2xl border p-6 text-white" style={cardStyle}>
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">Management access</p><h1 className="mt-2 text-2xl font-bold">Admin access</h1>
    <p className="mt-2 text-sm leading-6 text-white/65">This area is limited to approved admin accounts. If this is the first setup, the signed-in account can become the initial Owner once. After that, Owners manage access under Roles and permissions.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
    {auth.isLoggedIn?<button type="button" onClick={()=>void bootstrap()} disabled={busy} className="mt-5 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:opacity-50">{busy?'Setting up…':'Set up first Owner'}</button>:<Link to="/login" className="mt-5 inline-flex bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)]">Sign in to continue</Link>}
  </div></main></>;

  return <>
    {managementHeader}
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
      <aside className="border-b border-[var(--navy-light)] bg-[#071a2b] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <nav aria-label="Admin dashboard sections" className="grid grid-cols-2 gap-1 px-3 pb-4 sm:grid-cols-3 lg:block lg:space-y-5 lg:px-3 lg:py-4">
          {navigationGroups.map(group=>{
            const visibleItems=group.items.filter(item=>{
              if (['Imports','Meets and results'].includes(item.tab)) return canImportResults;
              if (item.tab==='Profile claims') return canReviewClaims;
              if (item.tab==='Records') return true;
              if (item.tab==='Roles and permissions') return canManageRoles;
              if (item.tab==='Writers') return canManageWriters;
              if (['Articles','Write article','Article library','Ads'].includes(item.tab)) return canManageArticles;
              return true;
            });
            return visibleItems.length?<div key={group.label}><p className="hidden px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 lg:block">{group.label}</p><div className="grid gap-1">{visibleItems.map(item=>{const Icon=item.icon;const active=tab===item.tab;const count=item.countKey?Number(counts[item.countKey]??0):0;return <button key={item.tab} type="button" onClick={()=>{setTab(item.tab);setError('');setNotice('');}} aria-current={active?'page':undefined} className={`flex min-h-10 items-center gap-3 px-3 py-2 text-left text-xs font-semibold transition-colors ${active?'border-l-2 border-[var(--accent)] bg-[var(--navy-mid)] text-white':'border-l-2 border-transparent text-white/60 hover:bg-[var(--navy-mid)] hover:text-white'}`}><Icon size={16} className={active?'text-[var(--accent)]':'text-white/40'} /><span className="min-w-0 flex-1">{item.label}</span>{count>0&&<span className="min-w-5 rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-center font-mono text-[10px] text-[var(--accent)]">{count}</span>}</button>;})}</div></div>:null;
          })}
        </nav>
        <div className="hidden border-t border-[var(--navy-light)] px-5 py-4 lg:block"><p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Signed in as</p><p className="mt-1 truncate text-xs text-white/70">{auth.user?.email}</p></div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="border-b border-[var(--navy-light)] bg-[var(--navy-mid)] px-4 py-6 sm:px-7 sm:py-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">Management / {tab}</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{tab==='Overview'?'Dashboard':tab}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{sectionDescriptions[tab]}</p></div><div className="flex items-center gap-3"><span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected</span><button type="button" onClick={()=>void load().catch(reason=>setError(describeSupabaseError(reason)))} disabled={busy} aria-label="Refresh admin dashboard" className="inline-flex h-9 w-9 items-center justify-center border border-[var(--navy-light)] text-white/60 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"><RefreshCw size={15} className={busy?'animate-spin':''} /></button></div></div></div>
        <section className="px-4 py-5 sm:px-7 sm:py-7">
          {error && <div role="alert" className="mb-4 border border-red-300/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>}
          {notice && <div role="status" className="mb-4 border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-white">{notice}</div>}
        {tab==='Write article' && <AdminArticleComposer userId={currentUserId} authorName={`${auth.user?.firstName??''} ${auth.user?.lastName??''}`.trim()||'Transplant Aquatics'} initialArticleId={selectedArticleId} onInitialEditLoaded={()=>setSelectedArticleId('')} cardStyle={cardStyle} inputClass={inputClass} onError={setError} onNotice={setNotice} />}
        {tab==='Article library' && <AdminArticleLibrary onEdit={id=>{setSelectedArticleId(id);setTab('Write article');}} onError={setError} onNotice={setNotice} />}
        {tab==='Ads' && <AdminAdCampaigns cardStyle={cardStyle} inputClass={inputClass} onError={setError} onNotice={setNotice} />}
        {tab==='Overview' && <>
          <div className="grid gap-px border border-[var(--navy-light)] bg-[var(--navy-light)] sm:grid-cols-2 lg:grid-cols-4">{countsItems.map(([label,key])=><div key={key} className="bg-[var(--navy-mid)] p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-white/55">{label}</p><p className="mt-2 font-mono text-3xl font-black text-white">{counts[key] ?? 0}</p></div>)}</div>
            <div className="mt-7 grid gap-5 lg:grid-cols-2"><div className="border p-5" style={cardStyle}><p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">World Transplant Games · 2027</p><h2 className="mt-2 text-xl font-bold text-white">{world2027?.name ?? 'Leuven World Transplant Games'}</h2><p className="mt-2 text-sm text-white/60">{world2027 ? `${world2027.host_city}, ${world2027.host_country} · ${world2027.meet_date} – ${world2027.end_date}` : 'Leuven, Belgium'}</p><p className="mt-5 border-l-2 border-[var(--accent)] pl-4 text-sm leading-6 text-white/75">Official swimming results are not available yet. The import, review and publication workspace is ready for the official files.</p>{canImportResults&&<button type="button" onClick={()=>setTab('Imports')} className="mt-4 text-sm font-bold text-[var(--accent)]">Open imports →</button>}</div>
            <div className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Recent imports</h2>{batches.slice(0,5).length?batches.slice(0,5).map(batch=><button key={batch.id} onClick={()=>{setTab('Imports');void openBatch(batch);}} className="flex w-full items-center justify-between gap-4 border-b border-[var(--navy-light)] py-3 text-left last:border-0"><span className="truncate text-sm text-white">{batch.file_name||batch.source_url||'Meet import'}</span><span className="shrink-0 font-mono text-xs uppercase text-[var(--accent)]">{batch.status}</span></button>):<p className="mt-3 text-sm text-white/50">No imports have been started.</p>}</div></div>
        </>}
        {tab==='Imports' && <div className="space-y-5">
          <div className="border p-5 sm:p-6" style={cardStyle}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Official swimming results</p><h2 className="mt-1 text-xl font-bold text-white">Create an import</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Files enter private staging first. CSV and version 1 JSON can be parsed now; PDF, spreadsheet and arbitrary website extraction will be identified as unsupported until their parsers are configured.</p></div><span className="font-mono text-xs uppercase text-white/50">Never invent missing profile or medical details</span></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs uppercase tracking-widest text-white/60">Meet<select value={selectedMeetId} onChange={event=>setSelectedMeetId(event.target.value)} className={`${inputClass} mt-2 normal-case tracking-normal`}>{meets.map(meet=><option key={meet.id} value={meet.id}>{meet.name} · {meet.year}</option>)}</select></label><label className="text-xs uppercase tracking-widest text-white/60">Official results URL (coming soon)<input value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="HTTPS source URL" className={`${inputClass} mt-2`} disabled /></label></div>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-3 border border-[var(--navy-light)] px-4 py-3 text-sm font-semibold text-white hover:border-[var(--accent)]"><span>{busy?'Importing…':'Upload official source file'}</span><input type="file" accept=".csv,.json,.pdf,.xls,.xlsx,application/json,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={busy} onChange={(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];if(file)void startImport(file);event.target.value='';}} /></label>
          </div>
          <div className="border p-5" style={cardStyle}><h2 className="mb-4 font-bold text-white">Import history</h2>{batches.length?<div className="space-y-2">{batches.map(batch=><button key={batch.id} onClick={()=>void openBatch(batch)} className={`flex w-full flex-wrap items-center justify-between gap-3 border px-4 py-3 text-left ${selectedBatch?.id===batch.id?'border-[var(--accent)]':'border-[var(--navy-light)]'} hover:bg-[var(--navy)]`}><span><span className="block text-sm font-semibold text-white">{batch.file_name||batch.source_url||'Meet import'}</span><span className="mt-1 block font-mono text-[10px] uppercase text-white/45">{new Date(batch.created_at).toLocaleString()} · {batch.stage_count} staged</span></span><span className="font-mono text-xs uppercase text-[var(--accent)]">{batch.status}</span></button>)}</div>:<p className="text-sm text-white/55">No batches. Results for the 2027 Leuven Games have not been released yet.</p>}</div>
          {selectedBatch && <div className="border p-5" style={cardStyle}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Review staged results</h2><p className="mt-1 text-xs text-white/55">{selectedBatch.progress} · {rows.length} rows</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={exportBatchJson} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white">Export version 1 JSON</button><button type="button" disabled={busy||rows.some(row=>row.review_action==='pending')} onClick={()=>void publishBatch()} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40">Publish approved results</button>{isOwner&&selectedBatch.status==='published'&&<button type="button" className="border border-red-300/40 px-3 py-2 text-xs font-bold text-red-200" onClick={async()=>{if(!supabase)return;setBusy(true);try{const {error:rpcError}=await supabase.rpc('admin_rollback_import_batch',{p_batch_id:selectedBatch.id});if(rpcError)throw rpcError;setNotice('The batch was rolled back. Independently changed results are preserved.');await load();}catch(e){setError(describeSupabaseError(e));}finally{setBusy(false);}}}>Roll back batch</button>}</div></div>
            <input className={`${inputClass} mt-4 max-w-sm`} placeholder="Filter staged swimmers or events" value={search} onChange={event=>setSearch(event.target.value)} />
            {rows.length===0?<div className="mt-4"><EmptyState title="No rows staged" subtitle="This import contains no parseable result rows yet." onDark /></div>:<div className="mt-4 space-y-3">{filteredRows.map(row=><article key={row.id} className="border border-[var(--navy-light)] bg-[var(--navy)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-white">{row.swimmer_name} <span className="font-normal text-white/55">· {row.country||'Country not supplied'}</span></div><p className="mt-1 text-sm text-[var(--accent)]">{row.event} · {row.gender||'Gender unknown'} · {row.age_group||'Age group unknown'} · {row.course||'Course unknown'}</p><p className="mt-1 font-mono text-sm text-white">{row.time_original||row.race_status} <span className="text-white/45">{row.round_name||''} {row.placing?`· ${row.placing}`:''}</span></p>{row.validation_issues?.length>0&&<p className="mt-2 text-xs text-amber-200">{row.validation_issues.join(' · ')}</p>}<p className="mt-2 font-mono text-[10px] uppercase text-white/45">{row.validation_state} · {row.is_relay?'Relay':'Individual'} · {row.review_action}</p></div><div className="flex flex-wrap gap-2">{row.race_status!=='OK'||row.is_relay?<button disabled={busyRow===row.id} onClick={()=>void reviewRow(row,'publish')} className="border border-[var(--accent)]/50 px-3 py-2 text-xs font-semibold text-[var(--accent)]">Approve official row</button>:<button disabled={busyRow===row.id} onClick={()=>void findMatches(row)} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white">Find profile</button>}<button disabled={busyRow===row.id} onClick={()=>void reviewRow(row,'skip')} className="px-3 py-2 text-xs text-white/55">Skip</button></div></div>{swimmerMatches[row.id]&&<div className="mt-3 border-t border-[var(--navy-light)] pt-3"><p className="mb-2 text-xs text-white/55">Profile suggestions are advisory only; a name match alone never confirms identity.</p>{swimmerMatches[row.id].length?swimmerMatches[row.id].map(match=><div key={match.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="text-sm text-white">{match.first_name} {match.last_name} · {match.country}</span><input aria-label={`Identity evidence for ${match.first_name} ${match.last_name}`} value={identityEvidence[row.id]??''} onChange={event=>setIdentityEvidence(current=>({...current,[row.id]:event.target.value}))} placeholder="Source evidence confirming identity" className="min-w-48 border border-[var(--navy-light)] bg-[var(--navy-mid)] px-2 py-1.5 text-xs text-white placeholder:text-white/40" /><button disabled={(identityEvidence[row.id]??'').trim().length<12} onClick={()=>void linkExistingAndApprove(row,match.id,identityEvidence[row.id]??'')} className="text-xs font-bold text-[var(--accent)] disabled:opacity-40">Verify, link and approve →</button></div>):stagedSwimmers.some(item=>item.source_key===row.swimmer_source_key&&item.country)?<button disabled={busyRow===row.id} onClick={()=>void createUnclaimedAndApprove(row)} className="mt-2 text-xs font-bold text-[var(--accent)]">Create unclaimed profile and approve →</button>:<p className="text-sm text-white/50">No possible profile match. A country is needed before an unclaimed profile can be created.</p>}</div>}</article>)}</div>}</div>}
        </div>}
        {tab==='Swimmers' && <div className="border p-5" style={cardStyle}><h2 className="mb-4 font-bold text-white">Swimmer profiles</h2>{renderRows(swimmerRows,['first_name','last_name','country','gender','transplant_type','club_name','account_id'])}</div>}
        {tab==='Meets and results' && <AdminMeetsManager meets={meets} cardStyle={cardStyle} inputClass={inputClass} onError={setError} onNotice={setNotice} onRefresh={() => void load().catch(reason => setError(describeSupabaseError(reason)))} onAddResults={meetId => { setSelectedMeetId(meetId); setSelectedBatch(null); setTab('Imports'); }} onOpenBatch={batchId => { const batch = batches.find(item => item.id === batchId); if (batch) { setTab('Imports'); void openBatch(batch); } }} />}
        {tab==='Profile claims' && <div className="border p-5" style={cardStyle}><h2 className="mb-4 font-bold text-white">Profile claim queue</h2>{claimRows.length?claimRows.map(claim=><article key={String(claim.id)} className="mb-3 border border-[var(--navy-light)] bg-[var(--navy)] p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">{String(claim.status)} · swimmer {String(claim.swimmer_profile_id).slice(0,8)}</p><p className="mt-2 text-sm text-white">Claimant {String(claim.claimant_id)}</p><p className="mt-2 text-sm leading-6 text-white/70">{String(claim.evidence)}</p><p className="mt-2 text-xs text-white/40">{String(claim.created_at)}</p>{claim.status==='pending'&&<div className="mt-3 flex flex-wrap gap-2"><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'approved')} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)]">Approve and link account</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'rejected')} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70">Reject</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'disputed')} className="border border-amber-300/40 px-3 py-2 text-xs text-amber-200">Dispute</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'correction_requested')} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70">Request correction</button><button disabled={busyRow===claim.id} onClick={()=>void decideClaim(String(claim.id),'removal_requested')} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70">Request removal</button></div>}</article>):<EmptyState title="No pending claims" subtitle="Verified users can submit an identity claim for a published swimmer profile." onDark />}</div>}
        {tab==='Records' && <div className="border p-5" style={cardStyle}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">WTG record candidates</h2><p className="mt-2 text-sm text-white/55">Candidates compare event, age, gender, category and course against the sourced WTG baseline. Missing eligibility or baseline data needs manual review.</p></div><button disabled={!canConfirmRecords||busy||selectedMeet?.status!=='completed'} onClick={()=>void checkWTGRecords()} title={!canConfirmRecords?'Your admin role can view candidates but cannot run record checks.':undefined} className="border border-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--accent)] disabled:opacity-40">{canConfirmRecords?'Check for WTG records':'Record checker access required'}</button></div>{selectedMeet?.status!=='completed'&&<p className="mt-3 text-xs text-white/45">Record checks are enabled after the selected Games edition is marked completed. The 2027 Leuven Games are still upcoming.</p>}{recordRows.length?recordRows.map(item=>{const performance=item.imported_official_performances as Record<string,unknown>|null;return <article key={String(item.id)} className="mt-4 border border-[var(--navy-light)] bg-[var(--navy)] p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">{String(item.status).replaceAll('_',' ')}</p><h3 className="mt-1 font-semibold text-white">{String(performance?.swimmer_name??'Swimmer/team needs review')} · {String(performance?.event??'Unknown event')}</h3><p className="mt-1 text-xs text-white/55">{String(performance?.age_group??'Age unknown')} · {String(performance?.gender??'Gender unknown')} · {String(performance?.course??'Course unknown')} · new {String(performance?.time_original??'—')}</p><p className="mt-1 text-xs text-white/50">Baseline {String(item.baseline_record_id??'not found')} · {item.old_time_ms==null?'time unavailable':`${Number(item.old_time_ms)/1000}s`} · improvement {item.improvement_ms==null?'—':`${Number(item.improvement_ms)/1000}s`}</p></div></div>{['potential_record','equalled'].includes(String(item.status))&&canConfirmRecords&&<div className="mt-4 flex flex-wrap gap-2"><input value={recordEvidence[String(item.id)]??''} onChange={event=>setRecordEvidence(current=>({...current,[String(item.id)]:event.target.value}))} className="min-w-64 flex-1 border border-[var(--navy-light)] bg-[var(--navy-mid)] px-3 py-2 text-xs text-white placeholder:text-white/40" placeholder="Official WTG confirmation evidence URL or reference" /><button disabled={busyRow===item.id||(recordEvidence[String(item.id)]??'').trim().length<12} onClick={()=>void confirmWTGRecord(String(item.id))} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40">Confirm official record</button></div>}</article>}):<div className="mt-5"><EmptyState title="No record candidates" subtitle="After a completed WTG meet has published official swimming results, run the record checker here." onDark /></div>}</div>}
        {tab==='Roles and permissions' && <div className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Roles and permissions</h2>{isOwner?<><p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">Owner has full access. Administrators manage platform data; Results editors need a separate publication permission; Claim reviewers cannot change times or roles.</p><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={accountQuery} onChange={event=>void searchAdminAccounts(event.target.value)} placeholder="Search registered accounts by email" className={inputClass} /><select value={newRole} onChange={event=>setNewRole(event.target.value)} className={inputClass}><option value="administrator">Administrator</option><option value="results_editor">Results editor</option><option value="claim_reviewer">Claim reviewer</option><option value="owner">Owner</option></select></div>{accountMatches.map(account=><button key={String(account.user_id)} disabled={busy} onClick={()=>void addAdminMember(String(account.user_id),String(account.email))} className="mt-2 flex w-full justify-between border border-[var(--navy-light)] px-3 py-2 text-left text-sm text-white hover:border-[var(--accent)]"><span>{String(account.email)}</span><span className="text-[var(--accent)]">Add as {newRole.replaceAll('_',' ')} →</span></button>)}<div className="mt-5 space-y-2">{memberRows.map(member=><div key={String(member.user_id)} className="flex flex-wrap items-center justify-between gap-3 border border-[var(--navy-light)] bg-[var(--navy)] p-3"><div><p className="text-sm font-semibold text-white">{String(member.email)}</p><p className="mt-1 font-mono text-[10px] uppercase text-white/45">{String(member.role)} · {member.is_active?'active':'inactive'}</p></div><div className="flex flex-wrap items-center gap-2"><select disabled={member.user_id===currentUserId} defaultValue={String(member.role)} onChange={event=>void changeAdminRole(String(member.user_id),event.target.value,Boolean(member.is_active))} className="border border-[var(--navy-light)] bg-[var(--navy-mid)] px-2 py-2 text-xs text-white"><option value="owner">Owner</option><option value="administrator">Administrator</option><option value="results_editor">Results editor</option><option value="claim_reviewer">Claim reviewer</option></select>{member.user_id!==currentUserId&&<button onClick={()=>void changeAdminRole(String(member.user_id),String(member.role),!Boolean(member.is_active))} className="border border-[var(--navy-light)] px-2 py-2 text-xs text-white/70">{member.is_active?'Deactivate':'Reactivate'}</button>}</div>{member.role!=='owner'&&<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{['publish_results','rollback_imports','merge_swimmers','review_claims','confirm_records','manage_writers','manage_articles'].map(permission=>{const userId=String(member.user_id);const role=String(member.role);const isAllowed=memberOverrides[userId]?.[permission]??permissionsForRole(role).includes(permission);return <label key={permission} className="inline-flex items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={isAllowed} disabled={userId===currentUserId||busy} onChange={event=>void changeAdminPermission(userId,permission,event.target.checked)} className="accent-[var(--accent)]" />{permission.replaceAll('_',' ')}</label>;})}</div>}</div>)}</div></>:<EmptyState title="Owner permission required" subtitle="Only an Owner can add administrators and manage platform roles." onDark />}</div>}
        {tab==='Writers' && <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]"><section className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Invite a writer</h2><p className="mt-2 text-sm leading-6 text-white/60">Supabase sends a secure invitation link. Writers choose their own password on first access; no shared default password is sent.</p><label className="mt-5 block text-xs font-semibold text-white/75">Writer name<input value={writerDisplayName} onChange={event=>setWriterDisplayName(event.target.value)} className={`${inputClass} mt-2`} placeholder="Full name" /></label><label className="mt-4 block text-xs font-semibold text-white/75">Email address<input type="email" value={writerEmail} onChange={event=>setWriterEmail(event.target.value)} className={`${inputClass} mt-2`} placeholder="writer@example.com" /></label><button disabled={busy||!writerEmail.trim()||writerDisplayName.trim().length<2} onClick={()=>void inviteWriter()} className="mt-5 bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:opacity-40">{busy?'Sending…':'Send writer invitation'}</button></section><section className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Writer accounts</h2>{writerRows.length?<div className="ta-table-scroll mt-4"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--navy-light)] font-mono text-[10px] uppercase tracking-widest text-white/45">{['Writer','Status','Stories','Drafts','Review','Published'].map(label=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{writerRows.map(writer=><tr key={String(writer.user_id)} className="border-b border-[var(--navy-light)] last:border-0"><td className="px-3 py-3"><p className="font-semibold text-white">{String(writer.display_name)}</p><p className="text-xs text-white/50">{String(writer.email)}</p></td><td className="px-3 py-3 text-white/70">{String(writer.status)}</td>{['article_count','draft_count','submitted_count','published_count'].map(key=><td key={key} className="px-3 py-3 font-mono text-white/70">{String(writer[key]??0)}</td>)}</tr>)}</tbody></table></div>:<EmptyState title="No writers yet" subtitle="Invite a writer to give them access to the authoring workspace." onDark />}</section></div>}
        {tab==='Articles' && <div className="border p-5" style={cardStyle}><h2 className="font-bold text-white">Editorial review queue</h2><p className="mt-2 text-sm text-white/60">Review each submission, request edits when needed, then publish it as a feature story or a standard article.</p>{submittedArticles.length?submittedArticles.map(article=><article key={String(article.id)} className="mt-5 border border-[var(--navy-light)] bg-[var(--navy)] p-4 sm:p-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">{article.cover_image?<img src={String(article.cover_image)} alt="" className="aspect-[16/9] w-full object-cover lg:order-2" />:null}<div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">{String(article.category)} · {String(article.access)} · by {String(article.author_name)}</p><h3 className="mt-2 text-xl font-bold text-white">{String(article.title)}</h3><p className="mt-2 text-sm leading-6 text-white/65">{String(article.excerpt)}</p><p className="mt-3 line-clamp-5 whitespace-pre-line text-sm leading-6 text-white/45">{String(article.body)}</p></div></div><label className="mt-4 block text-xs font-semibold text-white/65">Note for writer<textarea rows={2} value={articleNotes[String(article.id)]??''} onChange={event=>setArticleNotes(current=>({...current,[String(article.id)]:event.target.value}))} className={`${inputClass} mt-2`} placeholder="Optional feedback or requested changes" /></label><div className="mt-4 flex flex-wrap gap-2"><button disabled={busyRow===article.id} onClick={()=>void moderateArticle(String(article.id),'publish',false)} className="bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)]">Publish article</button><button disabled={busyRow===article.id} onClick={()=>void moderateArticle(String(article.id),'publish',true)} className="border border-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--accent)]">Publish as feature</button><button disabled={busyRow===article.id||(articleNotes[String(article.id)]??'').trim().length<8} onClick={()=>void moderateArticle(String(article.id),'request_changes')} className="border border-[var(--navy-light)] px-3 py-2 text-xs font-semibold text-white/75 disabled:opacity-40">Request changes</button><button disabled={busyRow===article.id} onClick={()=>void moderateArticle(String(article.id),'reject')} className="px-3 py-2 text-xs text-red-300">Decline</button></div></article>):<div className="mt-5"><EmptyState title="No articles awaiting review" subtitle="Writer submissions will appear here. Published stories appear in From the Pool Deck." onDark /></div>}</div>}
        {tab==='Activity log' && <div className="border p-5" style={cardStyle}><h2 className="mb-4 font-bold text-white">Activity log</h2>{renderRows(activityRows,['action','target_type','target_id','batch_id','created_at'])}</div>}
        </section>
      </main>
    </div>
  </>;
}
