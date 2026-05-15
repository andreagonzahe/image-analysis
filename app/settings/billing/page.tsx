"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { formatUsd } from "@/lib/pricing";

type OpAgg = Record<string, { cost: number; calls: number }>;

type Summary = {
  enabled: true;
  today: { cost: number; calls: number; by_op: OpAgg };
  this_month: {
    cost: number;
    calls: number;
    by_op: OpAgg;
    by_provider: OpAgg;
    by_model: OpAgg;
  };
  last_30_days: Array<{ date: string; cost: number; calls: number }>;
  recent: Array<{
    created_at: string;
    provider: string;
    model: string;
    op: string;
    cost_usd: number;
    input_tokens: number | null;
    output_tokens: number | null;
    runtime_ms: number | null;
    user_id: string | null;
  }>;
  period: { start_of_today: string; start_of_month: string };
};

const OP_LABEL: Record<string, string> = {
  "nsfw": "NSFW check",
  "captioner": "Photo tagging",
  "prefilter": "Bulk-import filter",
  "strategist": "Strategy + caption",
  "funnel-plan": "Weekly funnel plan",
  "rewrite-caption": "Caption rewrite",
  "retier": "Tier override",
};

export default function BillingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [denied, setDenied] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage/summary")
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401) {
          setNeedsSignIn(true);
          return;
        }
        if (r.status === 403) {
          setDenied(true);
          return;
        }
        if (data?.enabled === false) {
          setMissing(data.reason ?? "unknown");
          return;
        }
        if (!r.ok) {
          setError(data?.error ?? `Request failed (${r.status})`);
          return;
        }
        setSummary(data as Summary);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (needsSignIn) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Billing</h1>
          <p className="hero-sub">Sign in to see API spend.</p>
        </header>
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 24 }}>
          <SignInButton mode="modal" forceRedirectUrl="/settings/billing" />
        </div>
      </main>
    );
  }

  if (denied) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Billing — admin only</h1>
          <p className="hero-sub">
            Billing data is restricted to the admin account. If this is your app and
            you should be admin, set <code>ALLOWED_EMAILS</code> in <code>.env.local</code>
            with your email first.
          </p>
          <div className="cta-row" style={{ justifyContent: "center" }}>
            <Link href="/" className="btn btn-secondary">Back to analyzer</Link>
          </div>
        </header>
      </main>
    );
  }

  if (missing === "supabase_missing") {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Billing</h1>
          <p className="hero-sub">
            Cost tracking needs Supabase to store events. Add Supabase keys to
            <code> .env.local</code> and re-run the migrations.
          </p>
        </header>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Billing</h1>
          <div className="error-banner">{error}</div>
        </header>
      </main>
    );
  }

  if (!summary) {
    return (
      <main>
        <header className="hero">
          <h1 className="title">Billing</h1>
          <p className="hero-sub">Loading spend data…</p>
        </header>
      </main>
    );
  }

  const maxDay = Math.max(0.0001, ...summary.last_30_days.map((d) => d.cost));
  const monthBudgetSoft = 50; // soft cap — surface a warning above this
  const monthHigh = summary.this_month.cost >= monthBudgetSoft;

  return (
    <main>
      <header className="profile-hero">
        <div>
          <h1 className="title" style={{ margin: 0, marginBottom: 6 }}>
            Billing
          </h1>
          <p className="hero-sub" style={{ margin: 0, maxWidth: 620 }}>
            Real Replicate + Together API spend, computed from actual token /
            runtime per call. Updates within a few seconds of each request.
          </p>
        </div>
        <div className="cta-row" style={{ marginTop: 0 }}>
          <Link href="/" className="btn btn-secondary">Back to analyzer</Link>
        </div>
      </header>

      <section className="billing-summary">
        <BillingStat label="Today" value={formatUsd(summary.today.cost)} sub={`${summary.today.calls} calls`} />
        <BillingStat
          label="This month"
          value={formatUsd(summary.this_month.cost)}
          sub={`${summary.this_month.calls} calls`}
          warn={monthHigh}
        />
        <BillingStat
          label="Avg / day (30d)"
          value={formatUsd(summary.last_30_days.reduce((a, d) => a + d.cost, 0) / 30)}
          sub={`${Math.round(summary.last_30_days.reduce((a, d) => a + d.calls, 0) / 30)} calls`}
        />
      </section>

      <section className="billing-section">
        <h2 className="billing-section-title">Last 30 days</h2>
        <div className="billing-chart">
          {summary.last_30_days.map((d) => {
            const h = Math.max(2, Math.round((d.cost / maxDay) * 100));
            return (
              <div className="billing-bar-wrap" key={d.date} title={`${d.date}: ${formatUsd(d.cost)} (${d.calls} calls)`}>
                <div className="billing-bar" style={{ height: `${h}%` }} />
              </div>
            );
          })}
        </div>
        <div className="billing-chart-labels">
          <span>{summary.last_30_days[0]?.date}</span>
          <span>{summary.last_30_days[summary.last_30_days.length - 1]?.date}</span>
        </div>
      </section>

      <section className="billing-section">
        <h2 className="billing-section-title">This month — by feature</h2>
        <table className="billing-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Calls</th>
              <th>Cost</th>
              <th>Avg / call</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary.this_month.by_op)
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([op, agg]) => (
                <tr key={op}>
                  <td>{OP_LABEL[op] ?? op}</td>
                  <td>{agg.calls.toLocaleString()}</td>
                  <td>{formatUsd(agg.cost)}</td>
                  <td>{agg.calls > 0 ? formatUsd(agg.cost / agg.calls) : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="billing-section">
        <h2 className="billing-section-title">This month — by provider</h2>
        <table className="billing-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Calls</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary.this_month.by_provider)
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([provider, agg]) => (
                <tr key={provider}>
                  <td style={{ textTransform: "capitalize" }}>{provider}</td>
                  <td>{agg.calls.toLocaleString()}</td>
                  <td>{formatUsd(agg.cost)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="billing-section-help">
          To check your live balance, visit{" "}
          <a href="https://replicate.com/account/billing" target="_blank" rel="noopener">
            replicate.com/account/billing
          </a>{" "}
          and{" "}
          <a href="https://api.together.xyz/settings/billing" target="_blank" rel="noopener">
            together.xyz billing
          </a>
          . We track per-call cost here but the provider holds the actual prepaid balance.
        </p>
      </section>

      <section className="billing-section">
        <h2 className="billing-section-title">Recent calls</h2>
        <table className="billing-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Feature</th>
              <th>Model</th>
              <th>Tokens / runtime</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {summary.recent.map((r, i) => (
              <tr key={i}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{OP_LABEL[r.op] ?? r.op}</td>
                <td className="billing-model">{r.model}</td>
                <td>
                  {r.input_tokens != null
                    ? `${r.input_tokens.toLocaleString()} in + ${(r.output_tokens ?? 0).toLocaleString()} out`
                    : r.runtime_ms != null
                      ? `${(r.runtime_ms / 1000).toFixed(2)}s GPU`
                      : "—"}
                </td>
                <td>{formatUsd(Number(r.cost_usd))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function BillingStat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div className={`billing-stat${warn ? " billing-stat-warn" : ""}`}>
      <span className="billing-stat-label">{label}</span>
      <span className="billing-stat-value">{value}</span>
      <span className="billing-stat-sub">{sub}</span>
    </div>
  );
}
