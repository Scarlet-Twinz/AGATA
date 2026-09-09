import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

type DashboardProject = {
  id: string;
  name: string;
  contractor_count: number;
  requirement_count: number;
  readiness_score: number | null;
  readiness_status: string;
};

type RecentActivity = {
  type: string;
  title: string;
  description: string;
  created_at: string;
};

type DashboardData = {
  company_name: string;
  project_count: number;
  contractor_count: number;
  requirement_count: number;
  evidence_count: number;

  readiness_score: number | null;

  ready_count: number;
  attention_count: number;
  not_ready_count: number;

  expiring_count: number;
  expired_count: number;

  unmapped_count: number;

  covered_requirement_count: number;
  total_project_requirements: number;

  projects: DashboardProject[];

  recent_activity: RecentActivity[];
};

function Icon({
  name,
  size = 20,
}: {
  name:
    | "folder"
    | "users"
    | "file"
    | "shield"
    | "clock"
    | "alert"
    | "upload"
    | "check"
    | "arrow"
    | "activity"
    | "search";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "folder":
      return (
        <svg {...common}>
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 11a3 3 0 0 0 0-6" />
          <path d="M18 14a5 5 0 0 1 2.5 5" />
        </svg>
      );

    case "file":
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );

    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "alert":
      return (
        <svg {...common}>
          <path d="M12 4 21 19H3L12 4Z" />
          <path d="M12 9v4" />
          <path d="M12 16h.01" />
        </svg>
      );

    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h13" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "activity":
      return (
        <svg {...common}>
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );

    default:
      return null;
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function relativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function statusLabel(status: string) {
  switch (status) {
    case "ready":
      return "Ready";
    case "attention":
      return "Attention";
    case "not_ready":
      return "Not ready";
    default:
      return "Not evaluated";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "ready":
      return "agata-status-ready";
    case "attention":
      return "agata-status-attention";
    case "not_ready":
      return "agata-status-not-ready";
    default:
      return "agata-status-neutral";
  }
}

function activityIcon(type: string) {
  const value = type.toLowerCase();

  if (value.includes("upload") || value.includes("document")) {
    return "upload" as const;
  }

  if (value.includes("readiness") || value.includes("compliance")) {
    return "shield" as const;
  }

  if (value.includes("requirement")) {
    return "file" as const;
  }

  if (value.includes("contractor")) {
    return "users" as const;
  }

  return "activity" as const;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const response = await api<DashboardData>("/api/dashboard");

        if (active) {
          setData(response);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the AGATA command center.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => {
    const source = user?.full_name?.trim();

    if (!source) return "there";

    return source.split(/\s+/)[0];
  }, [user]);

  const readiness = data?.readiness_score ?? null;

  const evidenceCoverage =
    data && data.total_project_requirements > 0
      ? Math.round(
          (data.covered_requirement_count /
            data.total_project_requirements) *
            100,
        )
      : null;

  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  if (loading) {
    return (
      <div className="agata-dashboard">
        <div className="agata-dashboard-loading">
          <div className="agata-loading-orb" />
          <p>Loading your command center…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="agata-dashboard">
        <section className="agata-dashboard-error">
          <div className="agata-error-icon">
            <Icon name="alert" size={22} />
          </div>

          <div>
            <span className="agata-section-eyebrow">COMMAND CENTER</span>
            <h1>We couldn't load your workspace.</h1>
            <p>{error || "No dashboard data is available."}</p>
          </div>
        </section>
      </div>
    );
  }

  const attentionTotal =
    data.attention_count +
    data.not_ready_count +
    data.expiring_count +
    data.unmapped_count;

  return (
    <div className="agata-dashboard">
      {/* HEADER */}

      <header className="agata-dashboard-header">
        <div>
          <span className="agata-section-eyebrow">
            COMMAND CENTER · AGATA
          </span>

          <h1>Welcome back, {firstName}.</h1>

          <p>
            Here's what's happening with your compliance today.
          </p>
        </div>

        <div className="agata-dashboard-header-actions">
          <time>{today}</time>

          <Link
            to="/readiness"
            className="agata-secondary-button"
          >
            Review attention
            <Icon name="arrow" size={15} />
          </Link>

          <Link
            to="/projects"
            className="agata-primary-button"
          >
            <span>+</span>
            New project
          </Link>
        </div>
      </header>

      {/* KPI ROW */}

      <section className="agata-kpi-grid">
        <Link to="/projects" className="agata-kpi-card">
          <div>
            <span>Total Projects</span>
            <strong>{data.project_count}</strong>
            <small>Active workspace projects</small>
          </div>

          <div className="agata-kpi-icon">
            <Icon name="folder" size={22} />
          </div>
        </Link>

        <Link to="/contractors" className="agata-kpi-card">
          <div>
            <span>Total Contractors</span>
            <strong>{data.contractor_count}</strong>
            <small>Contractors in workspace</small>
          </div>

          <div className="agata-kpi-icon">
            <Icon name="users" size={22} />
          </div>
        </Link>

        <Link to="/requirements" className="agata-kpi-card">
          <div>
            <span>Total Requirements</span>
            <strong>{data.requirement_count}</strong>
            <small>Requirements available</small>
          </div>

          <div className="agata-kpi-icon">
            <Icon name="file" size={22} />
          </div>
        </Link>

        <Link to="/evidence" className="agata-kpi-card">
          <div>
            <span>Total Evidence</span>
            <strong>{data.evidence_count}</strong>
            <small>
              {data.expiring_count} expiring · {data.expired_count} expired
            </small>
          </div>

          <div className="agata-kpi-icon">
            <Icon name="shield" size={22} />
          </div>
        </Link>
      </section>

      {/* PRIMARY INSIGHT ROW */}

      <section className="agata-primary-grid">
        {/* READINESS */}

        <article className="agata-panel agata-readiness-panel">
          <div className="agata-panel-heading">
            <div>
              <span className="agata-section-eyebrow">
                READINESS
              </span>

              <h2>Overall readiness</h2>

              <p>
                Across evaluated contractor and project checks.
              </p>
            </div>

            <Link to="/readiness">
              Open readiness <Icon name="arrow" size={14} />
            </Link>
          </div>

          <div className="agata-readiness-content">
            <div
              className="agata-readiness-ring"
              style={
                {
                  "--readiness":
                    readiness === null ? 0 : readiness,
                } as CSSProperties
              }
            >
              <div className="agata-readiness-ring-inner">
                {readiness === null ? (
                  <>
                    <strong>—</strong>
                    <span>NO DATA</span>
                  </>
                ) : (
                  <>
                    <strong>{Math.round(readiness)}%</strong>
                    <span>Overall Readiness</span>
                  </>
                )}
              </div>
            </div>

            <div className="agata-readiness-breakdown">
              <div>
                <span>
                  <i className="dot-ready" />
                  Ready
                </span>

                <strong>{data.ready_count}</strong>
              </div>

              <div>
                <span>
                  <i className="dot-attention" />
                  Attention
                </span>

                <strong>{data.attention_count}</strong>
              </div>

              <div>
                <span>
                  <i className="dot-not-ready" />
                  Not ready
                </span>

                <strong>{data.not_ready_count}</strong>
              </div>
            </div>
          </div>
        </article>

        {/* TREND */}

        <article className="agata-panel agata-trend-panel">
          <div className="agata-panel-heading">
            <div>
              <span className="agata-section-eyebrow">
                PERFORMANCE
              </span>

              <h2>Readiness Trend</h2>

              <p>Historical readiness movement.</p>
            </div>

            <span className="agata-panel-filter">
              Last 6 months
              <span>⌄</span>
            </span>
          </div>

          <div className="agata-trend-empty">
            <div className="agata-trend-grid">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            <div className="agata-trend-line">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="agata-trend-labels">
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
            </div>

            <div className="agata-trend-notice">
              Historical trend will appear as AGATA records more readiness checks.
            </div>
          </div>
        </article>

        {/* RUMI */}

        <article className="agata-panel agata-rumi-panel">
          <div className="agata-rumi-header">
            <div className="agata-rumi-avatar">R</div>

            <div>
              <h2>Rumi</h2>
              <p>Your compliance assistant</p>
            </div>
          </div>

          <div className="agata-rumi-message">
            {attentionTotal > 0
              ? `${attentionTotal} compliance item${
                  attentionTotal === 1 ? "" : "s"
                } currently require attention.`
              : "Your workspace has no current attention items."}
          </div>

          <Link
            to="/rumi"
            className="agata-rumi-action"
          >
            Review with Rumi
            <Icon name="arrow" size={15} />
          </Link>

          <div className="agata-rumi-prompts">
            <Link to="/readiness">
              <span>◉</span>
              Which contractors are not ready?
            </Link>

            <Link to="/evidence">
              <span>◉</span>
              Show expiring evidence
            </Link>

            <Link to="/readiness">
              <span>◷</span>
              Give me a readiness summary
            </Link>
          </div>
        </article>
      </section>

      {/* PROJECTS + ATTENTION */}

      <section className="agata-secondary-grid">
        <article className="agata-panel agata-projects-panel">
          <div className="agata-panel-heading">
            <div>
              <h2>Projects at a Glance</h2>
              <p>Your projects and their current readiness status.</p>
            </div>

            <Link to="/projects">
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>

          {data.projects.length === 0 ? (
            <div className="agata-table-empty">
              <Icon name="folder" size={24} />
              <strong>No projects yet</strong>
              <span>
                Create your first project to start tracking readiness.
              </span>

              <Link to="/projects" className="agata-primary-button">
                + New project
              </Link>
            </div>
          ) : (
            <div className="agata-project-table-wrap">
              <table className="agata-project-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Contractors</th>
                    <th>Requirements</th>
                    <th>Readiness</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>

                <tbody>
                  {data.projects.slice(0, 5).map((project) => (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/projects/${project.id}`}>
                          {project.name}
                        </Link>
                      </td>

                      <td>{project.contractor_count}</td>

                      <td>{project.requirement_count}</td>

                      <td>
                        {project.readiness_score === null
                          ? "—"
                          : `${Math.round(project.readiness_score)}%`}
                      </td>

                      <td>
                        <span
                          className={`agata-status-pill ${statusClass(
                            project.readiness_status,
                          )}`}
                        >
                          <i />
                          {statusLabel(project.readiness_status)}
                        </span>
                      </td>

                      <td>Recently</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="agata-panel agata-attention-panel">
          <div className="agata-panel-heading">
            <div>
              <h2>Needs Attention</h2>
              <p>Items that may require action.</p>
            </div>

            <Link to="/notifications">
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>

          <div className="agata-attention-list">
            {data.not_ready_count > 0 && (
              <Link to="/readiness" className="agata-attention-item">
                <div className="attention-icon attention-red">
                  <Icon name="alert" size={18} />
                </div>

                <div>
                  <strong>
                    {data.not_ready_count} contractor
                    {data.not_ready_count === 1 ? "" : "s"} not ready
                  </strong>

                  <span>Review readiness checks</span>
                </div>

                <Icon name="arrow" size={15} />
              </Link>
            )}

            {data.expiring_count > 0 && (
              <Link to="/evidence" className="agata-attention-item">
                <div className="attention-icon attention-yellow">
                  <Icon name="clock" size={18} />
                </div>

                <div>
                  <strong>
                    {data.expiring_count} evidence item
                    {data.expiring_count === 1 ? "" : "s"} expiring
                  </strong>

                  <span>Review upcoming expirations</span>
                </div>

                <Icon name="arrow" size={15} />
              </Link>
            )}

            {data.unmapped_count > 0 && (
              <Link to="/evidence" className="agata-attention-item">
                <div className="attention-icon attention-blue">
                  <Icon name="file" size={18} />
                </div>

                <div>
                  <strong>
                    {data.unmapped_count} evidence item
                    {data.unmapped_count === 1 ? "" : "s"} unmapped
                  </strong>

                  <span>Connect evidence to requirements</span>
                </div>

                <Icon name="arrow" size={15} />
              </Link>
            )}

            {data.not_ready_count === 0 &&
              data.expiring_count === 0 &&
              data.unmapped_count === 0 && (
                <div className="agata-all-clear">
                  <div>
                    <Icon name="check" size={22} />
                  </div>

                  <strong>Nothing needs attention</strong>

                  <span>
                    Your current workspace has no flagged items.
                  </span>
                </div>
              )}
          </div>
        </article>
      </section>

      {/* BOTTOM ROW */}

      <section className="agata-bottom-grid">
        {/* RECENT ACTIVITY */}

        <article className="agata-panel">
          <div className="agata-panel-heading">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest changes across your workspace.</p>
            </div>

            <Link to="/audit">
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>

          <div className="agata-activity-list">
            {data.recent_activity.length === 0 ? (
              <div className="agata-mini-empty">
                <Icon name="activity" size={20} />
                <span>No activity recorded yet.</span>
              </div>
            ) : (
              data.recent_activity.slice(0, 5).map((activity, index) => (
                <div className="agata-activity-item" key={index}>
                  <div className="agata-activity-icon">
                    <Icon
                      name={activityIcon(activity.type)}
                      size={17}
                    />
                  </div>

                  <div className="agata-activity-copy">
                    <strong>{activity.title}</strong>
                    <span>{activity.description}</span>
                  </div>

                  <time>{relativeTime(activity.created_at)}</time>
                </div>
              ))
            )}
          </div>
        </article>

        {/* EVIDENCE */}

        <article className="agata-panel agata-evidence-panel">
          <div className="agata-panel-heading">
            <div>
              <h2>Evidence Status</h2>
              <p>Coverage across project requirements.</p>
            </div>

            <Link to="/evidence">
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>

          <div className="agata-evidence-content">
            <div
              className="agata-evidence-ring"
              style={
                {
                  "--coverage":
                    evidenceCoverage === null ? 0 : evidenceCoverage,
                } as CSSProperties
              }
            >
              <div>
                <strong>
                  {evidenceCoverage === null
                    ? "—"
                    : `${evidenceCoverage}%`}
                </strong>

                <span>Covered</span>
              </div>
            </div>

            <div className="agata-evidence-legend">
              <div>
                <span>
                  <i className="dot-ready" />
                  Covered
                </span>

                <strong>
                  {data.covered_requirement_count}
                </strong>
              </div>

              <div>
                <span>
                  <i className="dot-attention" />
                  Expiring
                </span>

                <strong>{data.expiring_count}</strong>
              </div>

              <div>
                <span>
                  <i className="dot-not-ready" />
                  Expired
                </span>

                <strong>{data.expired_count}</strong>
              </div>

              <div>
                <span>
                  <i className="dot-muted" />
                  Unmapped
                </span>

                <strong>{data.unmapped_count}</strong>
              </div>
            </div>
          </div>
        </article>

        {/* EXPIRATIONS */}

        <article className="agata-panel">
          <div className="agata-panel-heading">
            <div>
              <h2>Upcoming Expirations</h2>
              <p>Evidence that may need renewal.</p>
            </div>

            <Link to="/evidence">
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>

          <div className="agata-expiration-list">
            {data.expiring_count === 0 ? (
              <div className="agata-mini-empty">
                <Icon name="check" size={20} />
                <span>No upcoming expirations detected.</span>
              </div>
            ) : (
              <>
                <div className="agata-expiration-item">
                  <div className="expiration-icon">
                    <Icon name="clock" size={17} />
                  </div>

                  <div>
                    <strong>Expiring evidence</strong>
                    <span>
                      {data.expiring_count} item
                      {data.expiring_count === 1 ? "" : "s"} require review
                    </span>
                  </div>

                  <b>Review</b>
                </div>

                {data.expired_count > 0 && (
                  <div className="agata-expiration-item">
                    <div className="expiration-icon expiration-danger">
                      <Icon name="alert" size={17} />
                    </div>

                    <div>
                      <strong>Expired evidence</strong>
                      <span>
                        {data.expired_count} item
                        {data.expired_count === 1 ? "" : "s"} expired
                      </span>
                    </div>

                    <b>Action</b>
                  </div>
                )}
              </>
            )}
          </div>
        </article>
      </section>

      {/* FOOTER PROMPT */}

      <section className="agata-dashboard-footer">
        <div>
          <div className="agata-footer-mark">R</div>

          <div>
            <strong>Need a compliance answer?</strong>
            <span>
              Ask Rumi about readiness, evidence, or your projects.
            </span>
          </div>
        </div>

        <Link to="/rumi" className="agata-primary-button">
          Open Rumi
          <Icon name="arrow" size={15} />
        </Link>
      </section>

      <div className="agata-dashboard-footnote">
        AGATA · Compliance intelligence for contractor readiness
      </div>
    </div>
  );
}