import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { loadPublicSwimmerDirectory, type PublicSwimmerProfile } from '../lib/swimmerSubmissions';
import { isClaimEvidenceSufficient } from '../lib/adminImports';
import { supabase, describeSupabaseError } from '../lib/supabase';

export default function ClaimProfilePage() {
  const auth=useAuth();
  const [profiles,setProfiles]=useState<PublicSwimmerProfile[]>([]);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<PublicSwimmerProfile|null>(null);
  const [evidence,setEvidence]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{loadPublicSwimmerDirectory().then(setProfiles).catch(reason=>setError(describeSupabaseError(reason))).finally(()=>setLoading(false));},[]);
  const filtered=useMemo(()=>profiles.filter(profile=>`${profile.first_name} ${profile.last_name} ${profile.country}`.toLowerCase().includes(query.toLowerCase())).slice(0,30),[profiles,query]);
  const submit=async()=>{
    if(!selected||!supabase)return;
    setBusy(true);setError('');
    try{const {data,error:rpcError}=await supabase.rpc('submit_profile_claim',{p_swimmer_profile_id:selected.id,p_evidence:evidence,p_evidence_file_path:null});if(rpcError)throw rpcError;setNotice(`Claim request ${String(data).slice(0,8)} sent for review. Profile ownership changes only after an admin verifies the evidence.`);setSelected(null);setEvidence('');}
    catch(reason){setError(describeSupabaseError(reason));}finally{setBusy(false);}
  };
  return <>
    <PageHeading eyebrow="Swimmer profiles" title="Claim an existing profile" description="Find your imported profile and provide supporting identity details for review." />
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {error&&<div role="alert" className="mb-4 border border-red-300/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>}
      {notice&&<div role="status" className="mb-4 border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-white">{notice}</div>}
      {!auth.isLoggedIn?<div className="border p-5 text-white" style={{backgroundColor:'var(--navy-mid)',borderColor:'var(--navy-light)'}}>Sign in before submitting a profile claim. <Link to="/login" className="font-bold text-[var(--accent)]">Sign in →</Link></div>:<>
        <label className="block text-xs uppercase tracking-widest text-white/55">Search by swimmer name or country<input value={query} onChange={event=>setQuery(event.target.value)} className="mt-2 w-full border border-[var(--navy-light)] bg-[var(--navy-mid)] px-3 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Search profiles" /></label>
        <div className="mt-4 space-y-2">{loading?<p className="py-10 text-center text-sm text-white/55">Loading swimmer profiles…</p>:filtered.length?filtered.map(profile=><button key={profile.id} onClick={()=>setSelected(profile)} className={`flex w-full items-center justify-between gap-4 border p-4 text-left ${selected?.id===profile.id?'border-[var(--accent)]':'border-[var(--navy-light)]'} bg-[var(--navy-mid)] text-white hover:border-[var(--accent)]`}><span className="font-semibold">{profile.first_name} {profile.last_name}<span className="mt-1 block text-xs font-normal text-white/55">{profile.country} · {profile.gender||'Gender not recorded'} · {profile.age_group||'Age group not recorded'}</span></span><span className="font-mono text-[10px] uppercase text-white/45">Select</span></button>):<EmptyState title="No profiles found" subtitle="Try another spelling or ask an administrator to create an unclaimed profile from official results." onDark />}</div>
        {selected&&<div className="mt-5 border p-5" style={{backgroundColor:'var(--navy-mid)',borderColor:'var(--navy-light)'}}><h2 className="font-bold text-white">Why is this your profile?</h2><p className="mt-1 text-sm text-white/60">A name match is not enough. Include evidence such as the relevant meet, country/team, club or a document the reviewers can use to verify identity. This does not change imported result provenance.</p><textarea value={evidence} onChange={event=>setEvidence(event.target.value)} rows={4} className="mt-4 w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Provide at least 20 characters of supporting information" /><div className="mt-3 flex flex-wrap items-center gap-4"><button disabled={busy||!isClaimEvidenceSufficient(evidence)} onClick={()=>void submit()} className="bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:opacity-40">{busy?'Submitting…':'Submit claim'}</button><button onClick={()=>setSelected(null)} className="text-sm text-white/60">Cancel</button></div></div>}
      </>}
    </section>
  </>;
}
