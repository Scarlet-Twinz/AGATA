import { useEffect, useState } from "react";
import { api } from "../lib/api";

type ImpactItem = {
  action_key: string;
  action_type: string;
  label: string;
  projected_score: number;
  score_delta: number;
  projected_status: string;
  resolved_requirements: string[];
  remaining_blockers: string[];
  impact_rank: number;
};

type ImpactResponse = {
  current_score: number;
  current_status: string;
  items: ImpactItem[];
};

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function ReadinessDecisionImpact({ projectId, contractorId }: { projectId: string; contractorId: string }) {
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await api<ImpactResponse>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/impact`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load decision impact.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [projectId, contractorId]);

  if (loading) return <section className="impact-card"><span>DECISION IMPACT</span><p>Calculating which single changes have the biggest readiness effect…</p></section>;
  if (error) return <section className="impact-card"><span>DECISION IMPACT</span><p className="impact-error">{error}</p></section>;

  return <section className="impact-card">
    <div className="impact-heading">
      <div><span>DECISION IMPACT</span><h2>What changes the decision fastest?</h2><p>AGATA tests each available change independently without modifying production evidence.</p></div>
      <strong>{data?.current_score ?? 0}%</strong>
    </div>
    {!data?.items.length ? <p>No actionable change is currently available.</p> : <div className="impact-list">{data.items.map((item) => <article className="impact-row" key={item.action_key}>
      <div className="impact-rank">{item.impact_rank}</div>
      <div className="impact-main"><strong>{item.label}</strong><small>{item.resolved_requirements.length ? `Resolves: ${item.resolved_requirements.join(", ")}` : "No blocker resolved by this single change"}</small></div>
      <div className="impact-result"><b>{item.projected_score}%</b><small>{item.score_delta >= 0 ? "+" : ""}{item.score_delta} pts · {label(item.projected_status)}</small></div>
    </article>)}</div>}
    {data?.items.length ? <small className="impact-note">Rank 1 is the highest single-change readiness impact. Combine changes in Decision Lens to preview a complete path to READY.</small> : null}
  </section>;
}
