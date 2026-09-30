import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pause, Pencil, Play, Share2, Trash2 } from 'lucide-react';
import EmptyState from './EmptyState';
import { describeSupabaseError, supabase } from '../lib/supabase';

type Campaign = { id: string; advertiser_name: string; contact_email: string | null; campaign_name: string; placement: string; image_url: string; destination_url: string; starts_on: string; ends_on: string; rate_amount: number | null; rate_currency: string; rate_period: string; invoice_status: string; status: string; impressions: number; clicks: number; updated_at: string };
type Form = Omit<Campaign, 'id' | 'impressions' | 'clicks' | 'updated_at' | 'status'>;
const blank: Form = { advertiser_name: '', contact_email: '', campaign_name: '', placement: 'article_inline', image_url: '', destination_url: '', starts_on: new Date().toISOString().slice(0, 10), ends_on: '', rate_amount: null, rate_currency: 'ZAR', rate_period: 'monthly', invoice_status: 'not_invoiced' };
const labels: Record<string, string> = { article_inline: 'In article', article_sidebar: 'Article sidebar', news_feed: 'News landing page' };

export default function AdminAdCampaigns({ cardStyle, inputClass, onError, onNotice }: { cardStyle: React.CSSProperties; inputClass: string; onError: (message: string) => void; onNotice: (message: string) => void }) {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editingId, setEditingId] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('ad_campaigns').select('id,advertiser_name,contact_email,campaign_name,placement,image_url,destination_url,starts_on,ends_on,rate_amount,rate_currency,rate_period,invoice_status,status,impressions,clicks,updated_at').order('updated_at', { ascending: false }).limit(500);
    if (error) throw error;
    setRows((data ?? []) as Campaign[]);
  }, []);

  useEffect(() => { void load().catch(reason => onError(describeSupabaseError(reason))).finally(() => setLoading(false)); }, [load, onError]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }));
  const isWebUrl = (value: string) => {
    try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; }
    catch { return false; }
  };
  const requirements = [
    { label: 'Advertiser', complete: form.advertiser_name.trim().length > 0 },
    { label: 'Campaign name', complete: form.campaign_name.trim().length > 0 },
    { label: 'Ad image URL', complete: isWebUrl(form.image_url.trim()) },
    { label: 'Destination URL', complete: isWebUrl(form.destination_url.trim()) },
    { label: 'Start date', complete: Boolean(form.starts_on) },
    { label: 'End date on or after start date', complete: Boolean(form.ends_on && form.starts_on && form.ends_on >= form.starts_on) },
  ];
  const canSave = requirements.every(requirement => requirement.complete);
  const missingRequirements = requirements.filter(requirement => !requirement.complete).map(requirement => requirement.label);
  const reset = () => { setForm(blank); setEditingId(''); };
  const edit = (row: Campaign) => {
    setEditingId(row.id);
    setForm({ advertiser_name: row.advertiser_name, contact_email: row.contact_email ?? '', campaign_name: row.campaign_name, placement: row.placement, image_url: row.image_url, destination_url: row.destination_url, starts_on: row.starts_on, ends_on: row.ends_on, rate_amount: row.rate_amount, rate_currency: row.rate_currency, rate_period: row.rate_period, invoice_status: row.invoice_status });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); onError(''); onNotice('');
    try {
      const { error } = await supabase.rpc('admin_save_ad_campaign', {
        p_campaign_id: editingId || null, p_advertiser_name: form.advertiser_name, p_contact_email: form.contact_email || null,
        p_campaign_name: form.campaign_name, p_placement: form.placement, p_image_url: form.image_url, p_destination_url: form.destination_url,
        p_starts_on: form.starts_on, p_ends_on: form.ends_on, p_rate_amount: form.rate_amount, p_rate_currency: form.rate_currency,
        p_rate_period: form.rate_period, p_invoice_status: form.invoice_status,
      });
      if (error) throw error;
      onNotice(editingId ? 'Campaign updated.' : 'Campaign saved. It will enter rotation during its scheduled dates.');
      reset(); await load();
    } catch (reason) { onError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };
  const changeStatus = async (row: Campaign, status: string) => {
    if (!supabase) return;
    setBusy(true); onError(''); onNotice('');
    try {
      const { error } = await supabase.rpc('admin_set_ad_campaign_status', { p_campaign_id: row.id, p_status: status });
      if (error) throw error;
      onNotice(status === 'paused' ? 'Campaign paused.' : status === 'archived' ? 'Campaign archived.' : 'Campaign returned to its scheduled rotation.');
      await load();
    } catch (reason) { onError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };
  const deleteCampaign = async (row: Campaign) => {
    if (!supabase) return;
    setBusy(true); onError(''); onNotice('');
    try {
      const { error } = await supabase.rpc('admin_delete_ad_campaign', { p_campaign_id: row.id });
      if (error) throw error;
      if (editingId === row.id) reset();
      setDeleteCandidate('');
      setDeleteConfirmation('');
      onNotice(`Campaign “${row.campaign_name}” deleted.`);
      await load();
    } catch (reason) { onError(describeSupabaseError(reason)); }
    finally { setBusy(false); }
  };
  const selectedCampaign = rows.find(row => row.id === selectedCampaignId);
  const copyClientSummary = async (row: Campaign) => {
    const clickRate = row.impressions ? `${((row.clicks / row.impressions) * 100).toFixed(2)}%` : '0.00%';
    const summary = [
      `${row.campaign_name} campaign report`,
      `Advertiser: ${row.advertiser_name}`,
      `Placement: ${labels[row.placement] ?? row.placement}`,
      `Campaign dates: ${row.starts_on} to ${row.ends_on}`,
      `Status: ${row.status.replaceAll('_', ' ')}`,
      `Impressions: ${row.impressions.toLocaleString()}`,
      `Clicks: ${row.clicks.toLocaleString()}`,
      `Click-through rate: ${clickRate}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      onNotice('Client-ready campaign summary copied.');
      onError('');
    } catch {
      onError('Could not copy the campaign summary. Check clipboard access and try again.');
    }
  };

  if (selectedCampaign) {
    const clickRate = selectedCampaign.impressions ? (selectedCampaign.clicks / selectedCampaign.impressions) * 100 : 0;
    return <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => setSelectedCampaignId('')} className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-[var(--accent)]"><ArrowLeft size={16} /> All campaigns</button><button type="button" onClick={() => void copyClientSummary(selectedCampaign)} className="inline-flex items-center gap-2 border border-[var(--accent)]/50 px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:border-[var(--accent)]"><Share2 size={15} /> Copy client summary</button></div>
      <section className="border p-5 sm:p-7" style={cardStyle}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Campaign dashboard · {selectedCampaign.status.replaceAll('_', ' ')}</p><h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{selectedCampaign.campaign_name}</h2><p className="mt-2 text-sm text-white/60">{selectedCampaign.advertiser_name} · {labels[selectedCampaign.placement] ?? selectedCampaign.placement}</p><p className="mt-1 text-xs text-white/45">{selectedCampaign.starts_on} – {selectedCampaign.ends_on}</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">{[{ label: 'Impressions', value: selectedCampaign.impressions.toLocaleString() }, { label: 'Clicks', value: selectedCampaign.clicks.toLocaleString() }, { label: 'Click-through rate', value: `${clickRate.toFixed(2)}%` }].map(stat => <div key={stat.label} className="border border-[var(--navy-light)] bg-[var(--navy)] p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-white/45">{stat.label}</p><p className="mt-2 text-2xl font-bold text-white">{stat.value}</p></div>)}</div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="border border-[var(--navy-light)] p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-white/45">Billing</p><p className="mt-2 text-sm font-semibold text-white">{selectedCampaign.rate_amount == null ? 'Rate not set' : `${selectedCampaign.rate_currency} ${Number(selectedCampaign.rate_amount).toFixed(2)} / ${selectedCampaign.rate_period}`}</p><p className="mt-1 text-xs text-white/55">Invoice {selectedCampaign.invoice_status.replaceAll('_', ' ')}</p></div><div className="border border-[var(--navy-light)] p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-white/45">Destination</p><a href={selectedCampaign.destination_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 break-all text-sm text-[var(--accent)] hover:underline">Open ad destination <ExternalLink size={13} /></a></div></div>
          </div>
          <div className="space-y-4"><div className="overflow-hidden border border-[var(--navy-light)] bg-[var(--navy)]"><img src={selectedCampaign.image_url} alt={`${selectedCampaign.campaign_name} creative`} className="max-h-80 w-full object-contain" /><p className="p-3 text-xs text-white/55">Advertisement preview</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => edit(selectedCampaign)} className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-sm text-white/75 hover:text-[var(--accent)]"><Pencil size={14} /> Edit campaign</button>{selectedCampaign.status !== 'archived' && <button type="button" disabled={busy} onClick={() => void changeStatus(selectedCampaign, selectedCampaign.status === 'paused' ? 'active' : 'paused')} className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-sm text-white/75 disabled:opacity-40">{selectedCampaign.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}{selectedCampaign.status === 'paused' ? 'Resume' : 'Pause'}</button>}</div><p className="text-xs leading-5 text-white/40">The report includes campaign totals currently collected by the site. Metrics are cumulative for the scheduled campaign period.</p></div>
        </div>
      </section>
    </div>;
  }

  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
    <form onSubmit={event => void save(event)} className="border p-5 sm:p-6" style={cardStyle}>
      <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Campaign setup</p><h2 className="mt-1 text-lg font-bold text-white">{editingId ? 'Edit campaign' : 'Add an advertisement'}</h2></div>{editingId && <button type="button" onClick={reset} className="text-xs text-white/55 hover:text-white">New campaign</button>}</div>
      <div className="mt-5 space-y-4">
        <label className="block text-xs font-semibold text-white/70">Advertiser<input required value={form.advertiser_name} onChange={event => set('advertiser_name', event.target.value)} className={`${inputClass} mt-2`} placeholder="Company or organisation" /></label>
        <label className="block text-xs font-semibold text-white/70">Contact email<input type="email" value={form.contact_email ?? ''} onChange={event => set('contact_email', event.target.value)} className={`${inputClass} mt-2`} placeholder="Optional billing contact" /></label>
        <label className="block text-xs font-semibold text-white/70">Campaign name<input required value={form.campaign_name} onChange={event => set('campaign_name', event.target.value)} className={`${inputClass} mt-2`} placeholder="Campaign or promotion" /></label>
        <label className="block text-xs font-semibold text-white/70">Placement<select value={form.placement} onChange={event => set('placement', event.target.value)} className={`${inputClass} mt-2`}><option value="article_inline">In article</option><option value="article_sidebar">Article sidebar</option><option value="news_feed">News landing page</option></select></label>
        <label className="block text-xs font-semibold text-white/70">Ad image URL<input required type="url" value={form.image_url} onChange={event => set('image_url', event.target.value)} className={`${inputClass} mt-2`} placeholder="https://…" /></label>
        <label className="block text-xs font-semibold text-white/70">Destination URL<input required type="url" value={form.destination_url} onChange={event => set('destination_url', event.target.value)} className={`${inputClass} mt-2`} placeholder="https://…" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-white/70">Starts<input required type="date" value={form.starts_on} onChange={event => set('starts_on', event.target.value)} className={`${inputClass} mt-2`} /></label><label className="block text-xs font-semibold text-white/70">Ends<input required type="date" min={form.starts_on} value={form.ends_on} onChange={event => set('ends_on', event.target.value)} className={`${inputClass} mt-2`} /></label></div>
        <div className="grid grid-cols-[minmax(0,1fr)_90px_110px] gap-2"><label className="block text-xs font-semibold text-white/70">Rate amount<input type="number" min="0" step="0.01" value={form.rate_amount ?? ''} onChange={event => set('rate_amount', event.target.value === '' ? null : Number(event.target.value))} className={`${inputClass} mt-2`} placeholder="To be set" /></label><label className="block text-xs font-semibold text-white/70">Currency<select value={form.rate_currency} onChange={event => set('rate_currency', event.target.value)} className={`${inputClass} mt-2`}><option>ZAR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label><label className="block text-xs font-semibold text-white/70">Period<select value={form.rate_period} onChange={event => set('rate_period', event.target.value)} className={`${inputClass} mt-2`}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>
        <label className="block text-xs font-semibold text-white/70">Invoice status<select value={form.invoice_status} onChange={event => set('invoice_status', event.target.value)} className={`${inputClass} mt-2`}><option value="not_invoiced">Not invoiced</option><option value="invoiced">Invoiced</option><option value="paid">Paid</option></select></label>
        <p className="text-xs leading-5 text-white/45">Rates are optional while you finalise pricing. Campaign dates control when the ad appears. Expired campaigns are archived automatically.</p>
        <div className="border-t border-[var(--navy-light)] pt-4"><p className="font-mono text-[10px] uppercase tracking-wider text-white/45">Campaign requirements</p><p className="mt-1 text-xs leading-5 text-white/65">{requirements.map((requirement, index) => <span key={requirement.label}><span className={requirement.complete ? 'text-emerald-300' : 'text-white/65'}>{requirement.complete ? '✓' : '○'} {requirement.label}</span>{index < requirements.length - 1 && <span className="mx-1.5 text-white/25">·</span>}</span>)}</p>{!canSave && <p className="mt-2 text-[11px] text-white/40">Complete {missingRequirements.join(', ')} to enable {editingId ? 'saving' : 'adding'} this campaign. Contact email and rate are optional.</p>}</div>
        <button type="submit" disabled={busy || !canSave} className="bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--navy)] disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Saving…' : editingId ? 'Save campaign' : 'Add campaign'}</button>
      </div>
    </form>
    <section className="border p-5 sm:p-6" style={cardStyle}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Ad inventory</p><h2 className="mt-1 text-lg font-bold text-white">Campaigns</h2><p className="mt-1 text-sm text-white/50">Ads rotate fairly within each placement. Invoice tracking is manual for now.</p></div><span className="font-mono text-xs text-white/45">{rows.length} total</span></div>
      {loading ? <p className="py-12 text-center text-sm text-white/50">Loading campaigns…</p> : rows.length ? <div className="mt-5 space-y-3">{rows.map(row => <article key={row.id} className="border border-[var(--navy-light)] bg-[var(--navy)] p-3 sm:p-4"><div className="flex flex-wrap items-center gap-4"><img src={row.image_url} alt="" className="h-16 w-24 shrink-0 object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setSelectedCampaignId(row.id)} className="text-left font-semibold text-white hover:text-[var(--accent)]">{row.campaign_name}</button><span className="border border-[var(--navy-light)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--accent)]">{row.status}</span></div><p className="mt-1 text-xs text-white/55">{row.advertiser_name} · {labels[row.placement] ?? row.placement} · {row.starts_on} – {row.ends_on}</p><p className="mt-1 text-xs text-white/45">{row.rate_amount == null ? 'Rate not set' : `${row.rate_currency} ${Number(row.rate_amount).toFixed(2)} / ${row.rate_period}`} · {row.invoice_status.replaceAll('_', ' ')}</p><p className="mt-1 font-mono text-[10px] text-white/35">{row.impressions} impressions · {row.clicks} clicks</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedCampaignId(row.id)} className="border border-[var(--accent)]/40 px-2.5 py-2 text-xs font-semibold text-[var(--accent)] hover:border-[var(--accent)]">View dashboard</button><button type="button" onClick={() => edit(row)} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-2.5 py-2 text-xs text-white/70 hover:text-[var(--accent)]"><Pencil size={13} /> Edit</button>{row.status === 'archived' ? <button type="button" disabled={busy} onClick={() => void changeStatus(row, 'scheduled')} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-2.5 py-2 text-xs text-white/70 disabled:opacity-40"><ArchiveRestore size={13} /> Restore</button> : <><button type="button" disabled={busy} onClick={() => void changeStatus(row, row.status === 'paused' ? 'active' : 'paused')} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-2.5 py-2 text-xs text-white/70 disabled:opacity-40">{row.status === 'paused' ? <Play size={13} /> : <Pause size={13} />}{row.status === 'paused' ? 'Resume' : 'Pause'}</button><button type="button" disabled={busy} onClick={() => void changeStatus(row, 'archived')} className="inline-flex items-center gap-1.5 border border-[var(--navy-light)] px-2.5 py-2 text-xs text-white/70 disabled:opacity-40"><Archive size={13} /> Archive</button></>}</div><button type="button" disabled={busy} onClick={() => { setDeleteCandidate(current => current === row.id ? '' : row.id); setDeleteConfirmation(''); }} aria-label={`Delete ${row.campaign_name}`} className="inline-flex items-center gap-1.5 border border-red-300/25 px-2.5 py-2 text-xs text-red-200 hover:border-red-300/60 disabled:opacity-40"><Trash2 size={13} /> Delete</button></div>{deleteCandidate === row.id && <div className="mt-4 grid gap-3 border-t border-red-300/20 pt-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="text-xs text-red-100/80">To permanently delete this campaign, type <strong className="text-white">{row.campaign_name}</strong> below. This cannot be undone.</p><input aria-label={`Type ${row.campaign_name} to confirm deletion`} value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} className={`${inputClass} mt-2`} placeholder={row.campaign_name} /></div><div className="flex items-end gap-2"><button type="button" onClick={() => { setDeleteCandidate(''); setDeleteConfirmation(''); }} className="border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70">Cancel</button><button type="button" disabled={busy || deleteConfirmation.trim() !== row.campaign_name} onClick={() => void deleteCampaign(row)} className="bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Deleting…' : 'Delete permanently'}</button></div></div>}</article>)}</div> : <div className="mt-5"><EmptyState title="No ad campaigns yet" subtitle="Add an advertiser and campaign to start filling these placements." onDark /></div>}
    </section>
  </div>;
}
