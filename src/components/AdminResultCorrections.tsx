import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import EmptyState from './EmptyState';
import { describeSupabaseError, supabase } from '../lib/supabase';

type CorrectionRequest = {
  id: string;
  result_id: string;
  swimmer_name: string;
  event: string;
  meet_name: string | null;
  course: string | null;
  original_time: string;
  proposed_time: string | null;
  original_round: string | null;
  proposed_round: string | null;
  correction_type: 'time' | 'round' | 'time_and_round' | 'other';
  reason: string;
  evidence_path: string | null;
  evidence_url: string | null;
  created_at: string;
};

export default function AdminResultCorrections({
  cardStyle,
  onError,
  onNotice,
  onPendingCountChange,
}: {
  cardStyle: React.CSSProperties;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onPendingCountChange?: (count: number) => void;
}) {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [evidenceBusyId, setEvidenceBusyId] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    onError('');
    try {
      const { data, count, error } = await supabase.from('result_correction_requests')
        .select('id,result_id,swimmer_name,event,meet_name,course,original_time,proposed_time,original_round,proposed_round,correction_type,reason,evidence_path,evidence_url,created_at', { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setRequests((data ?? []) as CorrectionRequest[]);
      onPendingCountChange?.(count ?? 0);
    } catch (reason) {
      onError(describeSupabaseError(reason));
    } finally {
      setLoading(false);
    }
  }, [onError, onPendingCountChange]);

  useEffect(() => { void load(); }, [load]);

  const review = async (request: CorrectionRequest, decision: 'approved' | 'rejected') => {
    if (!supabase) return;
    setBusyId(request.id);
    onError('');
    try {
      const { error } = await supabase.rpc('admin_review_result_correction', {
        p_request_id: request.id,
        p_decision: decision,
        p_note: reviewNotes[request.id]?.trim() || null,
      });
      if (error) throw error;
      onNotice(decision === 'rejected' ? 'Correction report declined.' : request.correction_type === 'other' ? 'Report marked reviewed. No result fields were changed.' : 'Correction approved and the verified result was updated.');
      await load();
    } catch (reason) {
      onError(describeSupabaseError(reason));
    } finally {
      setBusyId('');
    }
  };

  const openProof = async (request: CorrectionRequest) => {
    if (!supabase) return;
    if (!request.evidence_path) {
      onError('This older correction report has no uploaded proof file.');
      return;
    }
    setEvidenceBusyId(request.id);
    onError('');
    const proofTab = window.open('about:blank', '_blank');
    try {
      const { data, error } = await supabase.storage.from('result-correction-evidence').createSignedUrl(request.evidence_path, 300);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Could not create a secure link for this proof file.');
      if (proofTab) proofTab.location.href = data.signedUrl;
      else window.location.assign(data.signedUrl);
    } catch (reason) {
      proofTab?.close();
      onError(describeSupabaseError(reason));
    } finally {
      setEvidenceBusyId('');
    }
  };

  return <section className="border" style={cardStyle}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--navy-light)] px-5 py-4">
      <div><h2 className="font-bold text-white">Result correction reports</h2><p className="mt-1 text-xs text-white/55">Review proposed changes before verified results and rankings are updated.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh correction reports" className="inline-flex items-center gap-2 border border-[var(--navy-light)] px-3 py-2 text-xs text-white/70 disabled:opacity-40"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</button>
    </div>
    {loading ? <p className="p-5 text-sm text-white/55">Loading correction reports…</p> : requests.length ? <div className="divide-y divide-[var(--navy-light)]">
      {requests.map(request => <article key={request.id} className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white">{request.swimmer_name} · {request.event}</h3>
            <p className="mt-1 text-xs text-white/50">{[request.meet_name, request.course, new Date(request.created_at).toLocaleString()].filter(Boolean).join(' · ')}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">{request.correction_type === 'time' ? 'Time correction' : request.correction_type === 'round' ? 'Round correction' : request.correction_type === 'time_and_round' ? 'Time and round correction' : 'Other result issue'}</p>
          </div>
          <span className="border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">Pending</span>
        </div>
        {['time', 'time_and_round'].includes(request.correction_type) && <div className="grid gap-3 sm:grid-cols-2"><div className="border border-[var(--navy-light)] bg-[var(--navy)] p-3"><p className="text-[10px] uppercase tracking-widest text-white/45">Current time</p><p className="mt-1 font-mono text-lg text-white">{request.original_time}</p></div><div className="border border-[var(--accent)]/40 bg-[var(--navy)] p-3"><p className="text-[10px] uppercase tracking-widest text-white/45">Proposed time</p><p className="mt-1 font-mono text-lg text-[var(--accent)]">{request.proposed_time}</p></div></div>}
        {['round', 'time_and_round'].includes(request.correction_type) && <div className="grid gap-3 sm:grid-cols-2"><div className="border border-[var(--navy-light)] bg-[var(--navy)] p-3"><p className="text-[10px] uppercase tracking-widest text-white/45">Current round</p><p className="mt-1 text-sm text-white">{request.original_round || 'Not recorded'}</p></div><div className="border border-[var(--accent)]/40 bg-[var(--navy)] p-3"><p className="text-[10px] uppercase tracking-widest text-white/45">Proposed round</p><p className="mt-1 text-sm text-[var(--accent)]">{request.proposed_round}</p></div></div>}
        <div className="border-l-2 border-[var(--navy-light)] pl-3"><p className="text-[10px] uppercase tracking-widest text-white/45">Athlete’s explanation</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/80">{request.reason}</p></div>
        <div className="flex flex-wrap items-center gap-4">
          {request.evidence_path ? <button type="button" disabled={evidenceBusyId === request.id} onClick={() => void openProof(request)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] underline disabled:opacity-50">{evidenceBusyId === request.id ? 'Preparing proof…' : 'View uploaded proof'} <ExternalLink size={12} /></button> : <span className="text-xs text-white/45">No file attached to this earlier report</span>}
          {request.evidence_url && <a href={request.evidence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] underline">Open source link <ExternalLink size={12} /></a>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-xs text-white/60">Review note (optional)<textarea value={reviewNotes[request.id] ?? ''} onChange={event => setReviewNotes(current => ({ ...current, [request.id]: event.target.value }))} rows={2} className="mt-1 w-full border border-[var(--navy-light)] bg-[var(--navy)] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></label>
          <button type="button" disabled={busyId === request.id} onClick={() => void review(request, 'rejected')} className="inline-flex items-center gap-1.5 border border-red-300/40 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-40"><X size={14} />Decline</button>
          <button type="button" disabled={busyId === request.id} onClick={() => void review(request, 'approved')} className="inline-flex items-center gap-1.5 bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-40"><Check size={14} />{request.correction_type === 'other' ? 'Mark reviewed' : 'Approve correction'}</button>
        </div>
      </article>)}
    </div> : <div className="p-5"><EmptyState title="No correction reports to review" subtitle="When athletes report an issue with a verified result, it will appear here." onDark /></div>}
  </section>;
}
