import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

type DashboardProject = {
  id: string;
  name: string;
  contractor_count: number;
  requirement_count: number;
  readiness_score: number | null;
  readiness_status: string | null;
  updated_at: string | null;
};

type DashboardActivity = {
  type: string;
  title: string;
  description: string;
  created_at: string;
};

type DashboardAttention = {
  kind: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  href: string;
};

type DashboardExpiration = {
  id: string;
  name: string;
  contractor_name: string | null;
  expires_at: string;
  days_remaining: number;
};

type DashboardTrendPoint = {
  month: string;
  score: number;
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
  valid_evidence_count: number;
  unmapped_count: number;
  covered_requirement_count: number;
  total_project_requirements: number;
  projects: DashboardProject[];
  recent_activity: DashboardActivity[];
  attention_items: DashboardAttention[];
  upcoming_expirations: DashboardExpiration[];
  readiness_trend: DashboardTrendPoint[];
};

type IconName =
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
  | "calendar"
  | "plus";

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "folder":
      return (
        <svg {...common}>
          <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5" />
          <path d="M18 14.5a5 5 0 0 1 2.5 4.5" />
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
          <path d="m12 4 9 16H3L12 4Z" />
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

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 9h18" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    default:
      return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Not evaluated";

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

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );

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

function statusLabel(status: string | null) {
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

function statusClass(status: string | null) {
  switch (status) {
    case "ready":
      return "ready";
    case "attention":
      return "attention";
    case "not_ready":
      return "not-ready";
    default:
      return "neutral";
  }
}

function activityIcon(type: string): IconName {
  const value = type.toLowerCase();

  if (value.includes("upload") || value.includes("document")) {
    return "upload";
  }

  if (value.includes("readiness") || value.includes("compliance")) {
    return "shield";
  }

  if (value.includes("requirement")) {
    return "file";
  }

  if (value.includes("contractor")) {
    return "users";
  }

  return "activity";
}

function severityClass(
  severity: DashboardAttention["severity"],
) {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
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

        const response = await api<DashboardData>(
          "/api/dashboard",
        );

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
    const name = user?.full_name?.trim();

    if (!name) return "there";

    return name.split(/\s+/)[0];
  }, [user]);

  const today = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  }, []);

  const readiness = data?.readiness_score ?? null;

  const evidenceTotal =
    data
      ? data.valid_evidence_count +
        data.expiring_count +
        data.expired_count +
        data.unmapped_count
      : 0;

  const validPercent =
    evidenceTotal > 0 && data
      ? (data.valid_evidence_count / evidenceTotal) * 100
      : 0;

  const expiringPercent =
    evidenceTotal > 0 && data
      ? (data.expiring_count / evidenceTotal) * 100
      : 0;

  const expiredPercent =
    evidenceTotal > 0 && data
      ? (data.expired_count / evidenceTotal) * 100
      : 0;

  if (loading) {
    return (
      <>
        <style>{dashboardStyles}</style>

        <div className="agata-dashboard-state">
          <div className="agata-loading-ring" />
          <span>Loading your command center…</span>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <style>{dashboardStyles}</style>

        <div className="agata-dashboard-state">
          <div className="agata-state-icon">
            <Icon name="alert" size={22} />
          </div>

          <div>
            <span className="agata-eyebrow">
              COMMAND CENTER
            </span>

            <h1>We couldn't load your workspace.</h1>

            <p>
              {error || "No dashboard data is available."}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{dashboardStyles}</style>

      <div className="agata-dashboard">
        <header className="agata-dashboard-header">
          <div>
            <span className="agata-eyebrow">
              COMMAND CENTER · AGATA
            </span>

            <h1>Welcome back, {firstName}</h1>

            <p>
              Here's what's happening with your compliance today.
            </p>
          </div>

          <div className="agata-header-date">
            <Icon name="calendar" size={15} />
            <span>{today}</span>
          </div>
        </header>

        <div className="agata-dashboard-layout">
          <main className="agata-dashboard-primary">
            <section className="agata-kpi-grid">
              <Link
                to="/projects"
                className="agata-kpi-card"
              >
                <div>
                  <span>Total Projects</span>
                  <strong>{data.project_count}</strong>
                  <small>Active workspace projects</small>
                </div>

                <div className="agata-kpi-icon">
                  <Icon name="folder" size={22} />
                </div>
              </Link>

              <Link
                to="/contractors"
                className="agata-kpi-card"
              >
                <div>
                  <span>Total Contractors</span>
                  <strong>{data.contractor_count}</strong>
                  <small>Contractors in workspace</small>
                </div>

                <div className="agata-kpi-icon">
                  <Icon name="users" size={22} />
                </div>
              </Link>

              <Link
                to="/requirements"
                className="agata-kpi-card"
              >
                <div>
                  <span>Total Requirements</span>
                  <strong>{data.requirement_count}</strong>
                  <small>Requirements available</small>
                </div>

                <div className="agata-kpi-icon">
                  <Icon name="file" size={22} />
                </div>
              </Link>

              <Link
                to="/evidence"
                className="agata-kpi-card"
              >
                <div>
                  <span>Total Evidence</span>
                  <strong>{data.evidence_count}</strong>
                  <small>
                    {data.expiring_count} expiring ·{" "}
                    {data.expired_count} expired
                  </small>
                </div>

                <div className="agata-kpi-icon">
                  <Icon name="shield" size={22} />
                </div>
              </Link>
            </section>

            <section className="agata-middle-grid">
              <article className="agata-panel agata-readiness-panel">
                <div className="agata-panel-header">
                  <div>
                    <span className="agata-eyebrow">
                      READINESS
                    </span>

                    <h2>Overall Readiness</h2>

                    <p>
                      Across all evaluated projects and
                      contractors
                    </p>
                  </div>

                  <Link to="/readiness">
                    Open <Icon name="arrow" size={14} />
                  </Link>
                </div>

                <div className="agata-readiness-body">
                  <div
                    className="agata-readiness-gauge"
                    style={{
                      background: `conic-gradient(
                        from -90deg,
                        #32dca6 ${
                          readiness === null
                            ? 0
                            : readiness
                        }%,
                        #23364c 0
                      )`,
                    }}
                  >
                    <div className="agata-gauge-inner">
                      <strong>
                        {readiness === null
                          ? "—"
                          : `${Math.round(readiness)}%`}
                      </strong>

                      <span>Overall Readiness</span>
                    </div>
                  </div>

                  <div className="agata-readiness-list">
                    <div>
                      <span>
                        <i className="ready-dot" />
                        Ready
                      </span>
                      <strong>{data.ready_count}</strong>
                    </div>

                    <div>
                      <span>
                        <i className="attention-dot" />
                        Attention
                      </span>
                      <strong>
                        {data.attention_count}
                      </strong>
                    </div>

                    <div>
                      <span>
                        <i className="not-ready-dot" />
                        Not ready
                      </span>
                      <strong>
                        {data.not_ready_count}
                      </strong>
                    </div>
                  </div>
                </div>
              </article>

              <article className="agata-panel agata-trend-panel">
                <div className="agata-panel-header">
                  <div>
                    <span className="agata-eyebrow">
                      PERFORMANCE
                    </span>

                    <h2>Readiness Trend</h2>

                    <p>
                      Historical readiness movement
                    </p>
                  </div>

                  <span className="agata-filter">
                    Last 6 months
                  </span>
                </div>

                <div className="agata-chart">
                  <div className="agata-chart-y">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>

                  <div className="agata-chart-area">
                    <div className="agata-chart-lines">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>

                    {data.readiness_trend.length >=
                    2 ? (
                      <svg
                        viewBox="0 0 500 125"
                        preserveAspectRatio="none"
                        className="agata-chart-svg"
                      >
                        <path
                          d={buildTrendPath(
                            data.readiness_trend,
                            500,
                            125,
                          )}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {data.readiness_trend.map(
                          (point, index) => {
                            const x =
                              (index /
                                (data.readiness_trend
                                  .length -
                                  1)) *
                              500;

                            const y =
                              125 -
                              (Math.max(
                                0,
                                Math.min(
                                  100,
                                  point.score,
                                ),
                              ) /
                                100) *
                                125;

                            return (
                              <circle
                                key={`${point.month}-${index}`}
                                cx={x}
                                cy={y}
                                r="3.5"
                              />
                            );
                          },
                        )}
                      </svg>
                    ) : (
                      <div className="agata-chart-empty">
                        Historical trend will appear as
                        AGATA records more readiness
                        checks.
                      </div>
                    )}

                    <div className="agata-chart-labels">
                      {(data.readiness_trend.length
                        ? data.readiness_trend
                        : [
                            {
                              month: "—",
                              score: 0,
                            },
                          ]
                      ).map((point, index) => (
                        <span
                          key={`${point.month}-${index}`}
                        >
                          {point.month}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </section>
          </main>

          <aside className="agata-rumi-card">
            <div className="agata-rumi-header">
              <div className="agata-rumi-avatar">
                R
              </div>

              <div>
                <h2>Rumi</h2>
                <p>Your compliance assistant</p>
              </div>
            </div>

            <div className="agata-rumi-message">
              {data.attention_items.length > 0
                ? `${data.attention_items.length} item${
                    data.attention_items.length === 1
                      ? ""
                      : "s"
                  } need${
                    data.attention_items.length === 1
                      ? "s"
                      : ""
                  } attention in your workspace. Would you like to review them?`
                : "Your workspace has no recorded attention items right now."}
            </div>

            <Link
              to="/readiness"
              className="agata-rumi-primary"
            >
              Review attention
              <Icon name="arrow" size={14} />
            </Link>

            <div className="agata-rumi-prompts">
              <Link to="/contractors">
                <span>
                  <Icon name="users" size={14} />
                </span>
                Which contractors are not ready?
              </Link>

              <Link to="/evidence">
                <span>
                  <Icon name="clock" size={14} />
                </span>
                Show expiring evidence
              </Link>

              <Link to="/readiness">
                <span>
                  <Icon name="shield" size={14} />
                </span>
                Give me a readiness summary
              </Link>
            </div>
          </aside>
        </div>

        <section className="agata-secondary-grid">
          <article className="agata-panel agata-projects-panel">
            <div className="agata-panel-header">
              <div>
                <span className="agata-eyebrow">
                  WORKSPACE
                </span>

                <h2>Projects at a Glance</h2>

                <p>
                  Your projects and their current readiness
                  status
                </p>
              </div>

              <div className="agata-panel-actions">
                <Link to="/projects">View all</Link>

                <Link
                  to="/projects"
                  className="agata-new-button"
                >
                  <Icon name="plus" size={14} />
                  New project
                </Link>
              </div>
            </div>

            {data.projects.length > 0 ? (
              <div className="agata-table-wrap">
                <table className="agata-project-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Contractors</th>
                      <th>Requirements</th>
                      <th>Readiness</th>
                      <th>Status</th>
                      <th>Last updated</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.projects
                      .slice(0, 6)
                      .map((project) => (
                        <tr key={project.id}>
                          <td>
                            <Link
                              to={`/projects/${project.id}`}
                            >
                              {project.name}
                            </Link>
                          </td>

                          <td>
                            {project.contractor_count}
                          </td>

                          <td>
                            {project.requirement_count}
                          </td>

                          <td>
                            {project.readiness_score ===
                            null
                              ? "—"
                              : `${Math.round(
                                  project.readiness_score,
                                )}%`}
                          </td>

                          <td>
                            <span
                              className={`agata-status ${statusClass(
                                project.readiness_status,
                              )}`}
                            >
                              <i />
                              {statusLabel(
                                project.readiness_status,
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              project.updated_at,
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="agata-empty-table">
                <Icon name="folder" size={22} />
                <strong>No projects yet</strong>
                <span>
                  Create your first project to start
                  tracking contractor readiness.
                </span>
                <Link to="/projects">
                  Create project
                  <Icon name="arrow" size={13} />
                </Link>
              </div>
            )}
          </article>

          <article className="agata-panel agata-attention-panel">
            <div className="agata-panel-header">
              <div>
                <span className="agata-eyebrow">
                  ACTION REQUIRED
                </span>

                <h2>Needs Attention</h2>
              </div>

              <Link to="/readiness">View all</Link>
            </div>

            <div className="agata-attention-list">
              {data.attention_items.length > 0 ? (
                data.attention_items
                  .slice(0, 5)
                  .map((item, index) => (
                    <Link
                      to={item.href}
                      className="agata-attention-item"
                      key={`${item.title}-${index}`}
                    >
                      <span
                        className={`agata-attention-icon ${severityClass(
                          item.severity,
                        )}`}
                      >
                        <Icon
                          name={
                            item.severity === "high"
                              ? "alert"
                              : item.severity === "medium"
                                ? "clock"
                                : "shield"
                          }
                          size={15}
                        />
                      </span>

                      <span className="agata-attention-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {item.description}
                        </small>
                      </span>

                      <Icon
                        name="arrow"
                        size={13}
                      />
                    </Link>
                  ))
              ) : (
                <div className="agata-attention-empty">
                  <span>
                    <Icon name="check" size={18} />
                  </span>
                  <strong>
                    Nothing needs attention
                  </strong>
                  <small>
                    AGATA has no current attention items
                    for this workspace.
                  </small>
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="agata-bottom-grid">
          <article className="agata-panel">
            <div className="agata-panel-header">
              <div>
                <span className="agata-eyebrow">
                  ACTIVITY
                </span>

                <h2>Recent Activity</h2>
              </div>

              <span className="agata-view-link">
                View all
              </span>
            </div>

            <div className="agata-activity-list">
              {data.recent_activity.length > 0 ? (
                data.recent_activity
                  .slice(0, 5)
                  .map((item, index) => (
                    <div
                      className="agata-activity-item"
                      key={`${item.title}-${index}`}
                    >
                      <span className="agata-activity-icon">
                        <Icon
                          name={activityIcon(item.type)}
                          size={15}
                        />
                      </span>

                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.description}
                        </small>
                      </div>

                      <time>
                        {relativeTime(item.created_at)}
                      </time>
                    </div>
                  ))
              ) : (
                <div className="agata-bottom-empty">
                  No activity recorded yet.
                </div>
              )}
            </div>
          </article>

          <article className="agata-panel">
            <div className="agata-panel-header">
              <div>
                <span className="agata-eyebrow">
                  EVIDENCE
                </span>

                <h2>Evidence Status</h2>
              </div>

              <Link to="/evidence">View all</Link>
            </div>

            <div className="agata-evidence-body">
              <div
                className="agata-evidence-donut"
                style={{
                  background: `conic-gradient(
                    #32dca6 0 ${validPercent}%,
                    #f2c637 ${validPercent}% ${
                      validPercent + expiringPercent
                    }%,
                    #eb5d69 ${
                      validPercent + expiringPercent
                    }% ${
                      validPercent +
                      expiringPercent +
                      expiredPercent
                    }%,
                    #8da5bf ${
                      validPercent +
                      expiringPercent +
                      expiredPercent
                    }% 100%
                  )`,
                }}
              >
                <div>
                  <strong>{data.evidence_count}</strong>
                  <span>Total Evidence</span>
                </div>
              </div>

              <div className="agata-evidence-legend">
                <div>
                  <span>
                    <i className="valid-dot" />
                    Valid
                  </span>
                  <strong>
                    {data.valid_evidence_count}
                  </strong>
                </div>

                <div>
                  <span>
                    <i className="expiring-dot" />
                    Expiring
                  </span>
                  <strong>{data.expiring_count}</strong>
                </div>

                <div>
                  <span>
                    <i className="expired-dot" />
                    Expired
                  </span>
                  <strong>{data.expired_count}</strong>
                </div>

                <div>
                  <span>
                    <i className="missing-dot" />
                    Unmapped
                  </span>
                  <strong>{data.unmapped_count}</strong>
                </div>
              </div>
            </div>
          </article>

          <article className="agata-panel">
            <div className="agata-panel-header">
              <div>
                <span className="agata-eyebrow">
                  DEADLINES
                </span>

                <h2>Upcoming Expirations</h2>
              </div>

              <Link to="/evidence">View all</Link>
            </div>

            <div className="agata-expiration-list">
              {data.upcoming_expirations.length > 0 ? (
                data.upcoming_expirations
                  .slice(0, 5)
                  .map((item) => (
                    <Link
                      to="/evidence"
                      className="agata-expiration-item"
                      key={item.id}
                    >
                      <span>
                        <Icon
                          name="clock"
                          size={15}
                        />
                      </span>

                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          {item.contractor_name ||
                            "Contractor not specified"}
                        </small>
                      </div>

                      <b
                        className={
                          item.days_remaining <= 14
                            ? "urgent"
                            : item.days_remaining <=
                                30
                              ? "soon"
                              : ""
                        }
                      >
                        {item.days_remaining} days
                      </b>
                    </Link>
                  ))
              ) : (
                <div className="agata-bottom-empty">
                  No upcoming expirations recorded.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </>
  );
}

function buildTrendPath(
  points: DashboardTrendPoint[],
  width: number,
  height: number,
) {
  if (points.length < 2) return "";

  return points
    .map((point, index) => {
      const x =
        (index / (points.length - 1)) * width;

      const y =
        height -
        (Math.max(
          0,
          Math.min(100, point.score),
        ) /
          100) *
          height;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(
        2,
      )} ${y.toFixed(2)}`;
    })
    .join(" ");
}

const dashboardStyles = `
  .agata-dashboard {
    width: 100%;
    max-width: 1536px;
    margin: 0 auto;
    padding: 22px 22px 38px 32px;
    color: #eef4fb;
    background:
      radial-gradient(
        circle at 80% 0%,
        rgba(24, 74, 126, .08),
        transparent 30%
      );
  }

  .agata-eyebrow {
    display: block;
    color: #6e88a5;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .15em;
    text-transform: uppercase;
  }

  .agata-dashboard-header {
    min-height: 61px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 30px;
    margin-bottom: 18px;
  }

  .agata-dashboard-header h1 {
    margin: 7px 0 0;
    color: #f2f6fb;
    font-size: 27px;
    line-height: 1.05;
    letter-spacing: -.035em;
    font-weight: 750;
  }

  .agata-dashboard-header p {
    margin: 6px 0 0;
    color: #7e93aa;
    font-size: 12px;
  }

  .agata-header-date {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 17px;
    color: #8195ac;
    font-size: 11px;
    white-space: nowrap;
  }

  .agata-dashboard-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 278px;
    gap: 14px;
    align-items: start;
  }

  .agata-dashboard-primary {
    min-width: 0;
  }

  .agata-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 11px;
    margin-bottom: 13px;
  }

  .agata-kpi-card {
    min-height: 115px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 17px 17px;
    overflow: hidden;
    border: 1px solid #1b3046;
    border-radius: 10px;
    background:
      radial-gradient(
        circle at 86% 22%,
        rgba(31, 96, 186, .11),
        transparent 38%
      ),
      #091827;
    text-decoration: none;
    transition:
      border-color .15s ease,
      transform .15s ease;
  }

  .agata-kpi-card:hover {
    border-color: #2b4b6c;
    transform: translateY(-1px);
  }

  .agata-kpi-card > div:first-child {
    min-width: 0;
  }

  .agata-kpi-card span {
    color: #91a5bc;
    font-size: 11px;
  }

  .agata-kpi-card strong {
    display: block;
    margin-top: 7px;
    color: #f1f6fc;
    font-size: 29px;
    line-height: 1;
    letter-spacing: -.035em;
  }

  .agata-kpi-card small {
    display: block;
    margin-top: 7px;
    color: #607893;
    font-size: 9px;
  }

  .agata-kpi-icon {
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid rgba(54, 113, 190, .17);
    background: rgba(23, 78, 159, .16);
    color: #4e95ed;
  }

  .agata-middle-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: 14px;
  }

  .agata-panel,
  .agata-rumi-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #192f44;
    border-radius: 11px;
    background:
      linear-gradient(
        145deg,
        rgba(11, 29, 46, .96),
        rgba(7, 17, 28, .99)
      );
  }

  .agata-panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    padding: 17px 19px 0;
  }

  .agata-panel-header h2 {
    margin: 5px 0 0;
    color: #eaf1f8;
    font-size: 16px;
    line-height: 1.1;
    letter-spacing: -.015em;
  }

  .agata-panel-header p {
    margin: 5px 0 0;
    color: #70859d;
    font-size: 10px;
  }

  .agata-panel-header > a,
  .agata-panel-actions > a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #5799ed;
    font-size: 10px;
    text-decoration: none;
    white-space: nowrap;
  }

  .agata-panel-header > a:hover,
  .agata-panel-actions > a:hover {
    color: #86bbff;
  }

  .agata-readiness-panel,
  .agata-trend-panel {
    height: 220px;
  }

  .agata-readiness-body {
    height: 157px;
    display: grid;
    grid-template-columns: 205px minmax(0, 1fr);
    align-items: center;
    gap: 15px;
    padding: 5px 20px 18px;
  }

  .agata-readiness-gauge {
    width: 144px;
    height: 144px;
    margin: 0 auto;
    display: grid;
    place-items: center;
    border-radius: 50%;
    position: relative;
  }

  .agata-readiness-gauge::before {
    content: "";
    position: absolute;
    inset: 9px;
    border-radius: 50%;
    background: #091827;
  }

  .agata-gauge-inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .agata-gauge-inner strong {
    color: #f3f7fb;
    font-size: 29px;
    line-height: 1;
    letter-spacing: -.035em;
  }

  .agata-gauge-inner span {
    margin-top: 5px;
    color: #71869f;
    font-size: 8px;
  }

  .agata-readiness-list {
    display: flex;
    flex-direction: column;
  }

  .agata-readiness-list > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 0;
    border-bottom: 1px solid #172b3f;
  }

  .agata-readiness-list > div:last-child {
    border-bottom: 0;
  }

  .agata-readiness-list span {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #a4b4c6;
    font-size: 10px;
  }

  .agata-readiness-list strong {
    color: #eef4fa;
    font-size: 13px;
  }

  .ready-dot,
  .attention-dot,
  .not-ready-dot,
  .valid-dot,
  .expiring-dot,
  .expired-dot,
  .missing-dot {
    width: 8px;
    height: 8px;
    display: inline-block;
    border-radius: 50%;
  }

  .ready-dot,
  .valid-dot {
    background: #34d9a4;
  }

  .attention-dot,
  .expiring-dot {
    background: #f2c638;
  }

  .not-ready-dot,
  .expired-dot {
    background: #ed5e6b;
  }

  .missing-dot {
    background: #8ea7c2;
  }

  .agata-filter {
    padding: 7px 9px;
    border: 1px solid #263d54;
    border-radius: 7px;
    color: #aebed0;
    font-size: 9px;
    white-space: nowrap;
  }

  .agata-chart {
    height: 165px;
    display: grid;
    grid-template-columns: 33px minmax(0, 1fr);
    padding: 8px 18px 11px;
  }

  .agata-chart-y {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0 0 19px;
    color: #657d97;
    font-size: 8px;
  }

  .agata-chart-area {
    position: relative;
    min-width: 0;
  }

  .agata-chart-lines {
    position: absolute;
    inset: 0 0 21px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .agata-chart-lines span {
    display: block;
    height: 1px;
    background: rgba(67, 99, 130, .18);
  }

  .agata-chart-svg {
    position: absolute;
    inset: 0 0 21px;
    width: 100%;
    height: calc(100% - 21px);
    overflow: visible;
    color: #4289ee;
  }

  .agata-chart-svg circle {
    fill: #2c7be2;
    stroke: #0b1b2c;
    stroke-width: 2;
  }

  .agata-chart-empty {
    position: absolute;
    inset: 35px 12px 42px;
    display: grid;
    place-items: center;
    text-align: center;
    color: #607893;
    font-size: 9px;
    line-height: 1.5;
  }

  .agata-chart-labels {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    color: #687f98;
    font-size: 8px;
  }

  .agata-rumi-card {
    min-height: 348px;
  }

  .agata-rumi-header {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 17px 16px 0;
  }

  .agata-rumi-avatar {
    width: 43px;
    height: 43px;
    display: grid;
    place-items: center;
    border-radius: 13px;
    border: 1px solid #315ba0;
    background: linear-gradient(145deg, #173b7c, #122755);
    color: #edf5ff;
    font-size: 20px;
    font-weight: 700;
  }

  .agata-rumi-header h2 {
    margin: 0;
    color: #edf3fa;
    font-size: 17px;
  }

  .agata-rumi-header p {
    margin: 3px 0 0;
    color: #70869e;
    font-size: 9px;
  }

  .agata-rumi-message {
    min-height: 83px;
    margin: 17px 14px 10px;
    padding: 13px;
    display: flex;
    align-items: center;
    border: 1px solid #21384f;
    border-radius: 9px;
    background: #0a1a2a;
    color: #c7d4e2;
    font-size: 10px;
    line-height: 1.55;
  }

  .agata-rumi-primary {
    min-height: 38px;
    margin: 0 14px 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 8px;
    background: linear-gradient(135deg, #1167e7, #0d55c8);
    color: white;
    font-size: 10px;
    font-weight: 700;
    text-decoration: none;
  }

  .agata-rumi-prompts {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 14px 14px;
  }

  .agata-rumi-prompts a {
    min-height: 32px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 9px;
    border: 1px solid #1a3044;
    border-radius: 7px;
    background: rgba(8, 20, 32, .6);
    color: #9fb1c4;
    font-size: 8px;
    text-decoration: none;
  }

  .agata-rumi-prompts a:hover {
    border-color: #2d4965;
    color: #dbe6f0;
  }

  .agata-rumi-prompts a span {
    display: grid;
    place-items: center;
    color: #5c88bd;
  }

  .agata-secondary-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(280px, .68fr);
    gap: 14px;
    margin-top: 14px;
  }

  .agata-projects-panel,
  .agata-attention-panel {
    min-height: 255px;
  }

  .agata-panel-actions {
    display: flex;
    align-items: center;
    gap: 17px;
  }

  .agata-new-button {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid rgba(55, 132, 239, .45) !important;
    border-radius: 8px;
    background: linear-gradient(135deg, #1268e7, #0d56c8);
    color: white !important;
    font-weight: 650;
  }

  .agata-table-wrap {
    margin: 15px 18px 18px;
    overflow-x: auto;
    border: 1px solid #192f44;
    border-radius: 9px;
  }

  .agata-project-table {
    width: 100%;
    min-width: 650px;
    border-collapse: collapse;
  }

  .agata-project-table th {
    height: 35px;
    padding: 0 10px;
    border-bottom: 1px solid #1b3045;
    color: #6d839d;
    font-size: 8px;
    font-weight: 700;
    text-align: left;
    white-space: nowrap;
  }

  .agata-project-table td {
    height: 35px;
    padding: 0 10px;
    border-bottom: 1px solid #14283b;
    color: #9aacc0;
    font-size: 9px;
    white-space: nowrap;
  }

  .agata-project-table tr:last-child td {
    border-bottom: 0;
  }

  .agata-project-table td:first-child a {
    color: #e1eaf3;
    font-weight: 600;
    text-decoration: none;
  }

  .agata-project-table td:first-child a:hover {
    color: #66a5ff;
  }

  .agata-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 7px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 700;
  }

  .agata-status i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .agata-status.ready {
    color: #4cdda9;
    background: rgba(49, 211, 157, .11);
  }

  .agata-status.ready i {
    background: #31d9a4;
  }

  .agata-status.attention {
    color: #e8ca4b;
    background: rgba(237, 194, 41, .11);
  }

  .agata-status.attention i {
    background: #f2c638;
  }

  .agata-status.not-ready {
    color: #ef7882;
    background: rgba(234, 86, 101, .11);
  }

  .agata-status.not-ready i {
    background: #ed5e6b;
  }

  .agata-status.neutral {
    color: #8ba2bb;
    background: rgba(132, 157, 184, .1);
  }

  .agata-empty-table {
    min-height: 182px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    color: #607893;
    text-align: center;
  }

  .agata-empty-table strong {
    color: #a9b9ca;
    font-size: 11px;
  }

  .agata-empty-table span {
    max-width: 280px;
    font-size: 9px;
    line-height: 1.5;
  }

  .agata-empty-table a {
    margin-top: 4px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #5799ed;
    font-size: 9px;
  }

  .agata-attention-list {
    padding: 11px 14px 14px;
  }

  .agata-attention-item {
    min-height: 47px;
    display: flex;
    align-items: center;
    gap: 9px;
    border-bottom: 1px solid #162a3d;
    text-decoration: none;
  }

  .agata-attention-item:last-child {
    border-bottom: 0;
  }

  .agata-attention-icon {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
  }

  .agata-attention-icon.high {
    color: #ef6d78;
    background: rgba(229, 81, 97, .11);
  }

  .agata-attention-icon.medium {
    color: #e7c536;
    background: rgba(231, 191, 40, .11);
  }

  .agata-attention-icon.low {
    color: #65a0e8;
    background: rgba(56, 124, 207, .11);
  }

  .agata-attention-copy {
    min-width: 0;
    flex: 1;
  }

  .agata-attention-copy strong,
  .agata-attention-copy small {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .agata-attention-copy strong {
    color: #dbe5ee;
    font-size: 9px;
  }

  .agata-attention-copy small {
    margin-top: 2px;
    color: #647c95;
    font-size: 8px;
  }

  .agata-attention-item > svg {
    color: #5d7590;
  }

  .agata-attention-empty {
    min-height: 170px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .agata-attention-empty > span {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    margin-bottom: 8px;
    border-radius: 50%;
    color: #35d8a4;
    background: rgba(52, 216, 164, .1);
  }

  .agata-attention-empty strong {
    color: #aab9ca;
    font-size: 10px;
  }

  .agata-attention-empty small {
    margin-top: 4px;
    color: #617993;
    font-size: 8px;
  }

  .agata-bottom-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr .9fr;
    gap: 14px;
    margin-top: 14px;
  }

  .agata-bottom-grid .agata-panel {
    min-height: 220px;
  }

  .agata-activity-list,
  .agata-expiration-list {
    padding: 10px 18px 15px;
  }

  .agata-activity-item {
    min-height: 42px;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #15293c;
  }

  .agata-activity-item:last-child {
    border-bottom: 0;
  }

  .agata-activity-icon {
    width: 29px;
    height: 29px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    color: #4a9bea;
    background: rgba(34, 111, 200, .12);
  }

  .agata-activity-item > div {
    min-width: 0;
  }

  .agata-activity-item strong,
  .agata-activity-item small {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .agata-activity-item strong {
    color: #d9e4ee;
    font-size: 9px;
  }

  .agata-activity-item small {
    margin-top: 2px;
    color: #637b94;
    font-size: 8px;
  }

  .agata-activity-item time {
    color: #647d97;
    font-size: 8px;
    white-space: nowrap;
  }

  .agata-evidence-body {
    min-height: 170px;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 8px 19px 18px;
  }

  .agata-evidence-donut {
    width: 135px;
    height: 135px;
    flex: 0 0 135px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    position: relative;
  }

  .agata-evidence-donut::before {
    content: "";
    position: absolute;
    inset: 18px;
    border-radius: 50%;
    background: #091827;
  }

  .agata-evidence-donut > div {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .agata-evidence-donut strong {
    color: #f0f5fa;
    font-size: 20px;
  }

  .agata-evidence-donut span {
    margin-top: 3px;
    color: #6f859e;
    font-size: 8px;
  }

  .agata-evidence-legend {
    min-width: 0;
    flex: 1;
  }

  .agata-evidence-legend > div {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #15293b;
  }

  .agata-evidence-legend > div:last-child {
    border-bottom: 0;
  }

  .agata-evidence-legend span {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #9aacbe;
    font-size: 9px;
  }

  .agata-evidence-legend strong {
    color: #dce6ef;
    font-size: 9px;
  }

  .agata-expiration-item {
    min-height: 40px;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #15293b;
    text-decoration: none;
  }

  .agata-expiration-item:last-child {
    border-bottom: 0;
  }

  .agata-expiration-item > span {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    color: #d4a83b;
    background: rgba(212, 168, 59, .1);
  }

  .agata-expiration-item > div {
    min-width: 0;
  }

  .agata-expiration-item strong,
  .agata-expiration-item small {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .agata-expiration-item strong {
    color: #dce5ee;
    font-size: 9px;
  }

  .agata-expiration-item small {
    margin-top: 2px;
    color: #647c95;
    font-size: 8px;
  }

  .agata-expiration-item b {
    color: #b5c2cf;
    font-size: 8px;
    white-space: nowrap;
  }

  .agata-expiration-item b.urgent {
    color: #ed6874;
  }

  .agata-expiration-item b.soon {
    color: #e4c13b;
  }

  .agata-panel > .agata-panel-header > a {
    text-decoration: none;
  }

  .agata-view-link {
    color: #5799ed;
    font-size: 9px;
  }

  .agata-bottom-empty {
    min-height: 145px;
    display: grid;
    place-items: center;
    color: #617993;
    font-size: 9px;
  }

  .agata-dashboard-state {
    min-height: calc(100vh - 64px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 13px;
    color: #71869f;
    font-size: 11px;
  }

  .agata-loading-ring {
    width: 22px;
    height: 22px;
    border: 2px solid #20374e;
    border-top-color: #4a96ef;
    border-radius: 50%;
    animation: agata-spin .8s linear infinite;
  }

  .agata-state-icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: #eb6974;
    background: rgba(231, 84, 99, .1);
  }

  .agata-dashboard-state h1 {
    margin: 5px 0;
    color: #e8eef5;
    font-size: 20px;
  }

  .agata-dashboard-state p {
    margin: 0;
    color: #70859d;
  }

  @keyframes agata-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1180px) {
    .agata-dashboard-layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .agata-rumi-card {
      min-height: auto;
    }

    .agata-rumi-prompts {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }

    .agata-secondary-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .agata-bottom-grid {
      grid-template-columns: 1fr 1fr;
    }

    .agata-bottom-grid .agata-panel:last-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 850px) {
    .agata-dashboard {
      padding: 18px 16px 30px;
    }

    .agata-kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .agata-middle-grid {
      grid-template-columns: 1fr;
    }

    .agata-readiness-panel,
    .agata-trend-panel {
      height: auto;
      min-height: 230px;
    }

    .agata-bottom-grid {
      grid-template-columns: 1fr;
    }

    .agata-bottom-grid .agata-panel:last-child {
      grid-column: auto;
    }
  }

  @media (max-width: 600px) {
    .agata-dashboard-header {
      display: block;
    }

    .agata-header-date {
      margin-top: 12px;
    }

    .agata-kpi-grid {
      grid-template-columns: 1fr;
    }

    .agata-readiness-body {
      grid-template-columns: 1fr;
      height: auto;
      padding-bottom: 18px;
    }

    .agata-readiness-gauge {
      width: 130px;
      height: 130px;
    }

    .agata-rumi-prompts {
      grid-template-columns: 1fr;
    }

    .agata-panel-actions {
      gap: 8px;
    }

    .agata-new-button {
      padding-inline: 9px;
    }

    .agata-evidence-body {
      flex-direction: column;
      padding-bottom: 22px;
    }
  }
`;