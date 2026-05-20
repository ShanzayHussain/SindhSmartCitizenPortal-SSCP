
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const API = "/api";

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// const ANNOUNCEMENTS = [
//   { icon: "📢", text: "Water Supply Maintenance on 12th May. Expect disruptions." },
//   { icon: "🛣️", text: "New Road Repair Initiative in Karachi starting next week." },
// ];

const STATUS_STYLES = {
  "Pending":     { background: "#f59e0b", color: "white" },
  "In Progress": { background: "#3b82f6", color: "white" },
  "Resolved":    { background: "#14863e", color: "white" },
  "Closed":      { background: "#dc2626", color: "white" },
};
function getDepartmentTextStyle(department = "") {
  const normalized = department.toLowerCase().replace(/[\s-]/g, "");
  if (normalized.includes("ssgc")) return { color: "#14863e", fontWeight: 700 };
  if (normalized.includes("ke") || normalized.includes("kelectric")) return { color: "#f97316", fontWeight: 700 };
  if (normalized.includes("waterboard") || normalized.includes("water")) return { color: "#2563eb", fontWeight: 700 };
  return { color: "#6b7280" };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const userId = useMemo(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.user_id;
  }, []);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [loadError, setLoadError] = useState(userId ? "" : "Please login to view dashboard data.");

  const STATS = useMemo(() => ([
    { label: "Total Complaints", value: stats.total, bg: "#f97316", icon: "☰" },
    { label: "Pending Complaints", value: stats.pending, bg: "#f59e0b", icon: "⏳" },
    { label: "In Progress", value: stats.inProgress, bg: "#3b82f6", icon: "🔧" },
    { label: "Resolved Complaints", value: stats.resolved, bg: "#14863e", icon: "✅" },
  ]), [stats]);

  const CHART_DATA = useMemo(() => ([
    { name: "Pending", value: stats.pending, color: "#f59e0b" },
    { name: "In Progress", value: stats.inProgress, color: "#1568ec" },
    { name: "Resolved", value: stats.resolved, color: "#14863e" },
  ]), [stats]);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;
    fetch(`${API}/dashboard/${userId}`, {
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message || `Failed to load dashboard (HTTP ${res.status})`);
        }
        return data;
      })
      .then((data) => {
        if (!mounted) return;
        setStats({
          total: Number(data?.stats?.total || 0),
          pending: Number(data?.stats?.pending || 0),
          inProgress: Number(data?.stats?.inProgress || 0),
          resolved: Number(data?.stats?.resolved || 0),
        });
        setComplaints(Array.isArray(data?.recentComplaints) ? data.recentComplaints : []);
        setLoadError("");
      })
      .catch((err) => {
        if (!mounted) return;
        setLoadError(err.message || "Could not fetch dashboard data.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <DashboardLayout>
      <div style={{ fontFamily: "'Segoe UI', sans-serif", color: "#1f2937" }}>

        {/* ── Welcome Header ── */}
        <div style={{ marginBottom: "24px" }}>
          {/* <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>
            Welcome to the{" "}
            <span style={{ color: "#1b3a57" }}>Sindh Citizen Complaint Management</span>{" "}
            System
          </h1> */}
          <h1 style={{ color: '#1b3a57', margin: 0, fontSize: '2.1rem', fontWeight: 800 }}>Welcome to the Sindh Citizen Complaint Portal</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: "0.95rem" }}>
            Register, track, and manage your complaints online.
          </p>
        </div>

        {/* ── Stats Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {STATS.map((stat, i) => (
            <div key={i} style={{
              background: stat.bg,
              borderRadius: "12px",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}>
              <span style={{ fontSize: "1.5rem" }}>{stat.icon}</span>
              <div>
                <div style={{ color: "white", fontSize: "0.8rem", fontWeight: 600, opacity: 0.9 }}>{stat.label}</div>
                <div style={{ color: "white", fontSize: "1.8rem", fontWeight: 800, lineHeight: 1.1 }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>

          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Quick Actions */}
            <div style={{ background: "white", borderRadius: "14px", padding: "22px", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px", color: "#1b3a57" }}>Quick Actions</h2>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => navigate("/complaint")}
                  style={{
                    background: "#14863e", color: "white", border: "none",
                    padding: "12px 22px", borderRadius: "8px", fontWeight: 600,
                    cursor: "pointer", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#16a34a"}
                  onMouseLeave={e => e.currentTarget.style.background = "#22c55e"}
                >
                  ➕ File New Complaint
                </button>
                <button
                  onClick={() => navigate("/complaint")}
                  style={{
                    background: "#3b82f6", color: "white", border: "none",
                    padding: "12px 22px", borderRadius: "8px", fontWeight: 600,
                    cursor: "pointer", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#2563eb"}
                  onMouseLeave={e => e.currentTarget.style.background = "#3b82f6"}
                >
                  🔍 Track Complaint
                </button>
                <button
                  onClick={() => navigate("/complaint")}
                  style={{
                    background: "#f59e0b", color: "white", border: "none",
                    padding: "12px 22px", borderRadius: "8px", fontWeight: 600,
                    cursor: "pointer", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#d97706"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f59e0b"}
                >
                  📋 Complaint History
                </button>
              </div>
            </div>

            {/* Recent Complaints Table */}
            <div style={{ background: "white", borderRadius: "14px", padding: "22px", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px", color: "#1b3a57" }}>Recent Complaints</h2>
              {loadError && (
                <p style={{ color: "#b91c1c", marginBottom: "12px", fontSize: "0.86rem" }}>{loadError}</p>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    {["ID", "Title", "Department", "Status", "Date"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#374151", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && complaints.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "14px 12px", color: "#6b7280", textAlign: "center" }}>
                        No complaints found.
                      </td>
                    </tr>
                  )}
                  {complaints.map((c, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "11px 12px", fontWeight: 700, color: "#1b3a57" }}>{c.id}</td>
                      <td style={{ padding: "11px 12px", color: "#374151" }}>{c.title}</td>
                      <td style={{ padding: "11px 12px", ...getDepartmentTextStyle(c.dept) }}>{c.dept}</td>
                      <td style={{ padding: "11px 12px" }}>
                        <span style={{
                          ...STATUS_STYLES[c.status],
                          padding: "3px 10px", borderRadius: "999px",
                          fontSize: "0.78rem", fontWeight: 600
                        }}>{c.status}</span>
                      </td>
                      <td style={{ padding: "11px 12px", color: "#6b7280" }}>{c.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ textAlign: "right", marginTop: "14px" }}>
                <button
                  onClick={() => navigate("/complaint")}
                  style={{
                    background: "#1b3a57", color: "white", border: "none",
                    padding: "9px 20px", borderRadius: "8px", fontWeight: 600,
                    cursor: "pointer", fontSize: "0.88rem"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#254a78"}
                  onMouseLeave={e => e.currentTarget.style.background = "#1b3a57"}
                >
                  View All Complaints
                </button>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Chart */}
            <div style={{ background: "white", borderRadius: "14px", padding: "22px", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px", color: "#1b3a57" }}>Complaints Overview</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={CHART_DATA} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#f3f4f6" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {CHART_DATA.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "8px" }}>
                {CHART_DATA.map(d => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.78rem", color: "#6b7280" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: d.color, display: "inline-block" }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Announcements */}
            {/* <div style={{ background: "white", borderRadius: "14px", padding: "22px", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px", color: "#1b3a57" }}>Announcements</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {ANNOUNCEMENTS.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "10px", background: "#f9fafb", borderRadius: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>{a.icon}</span>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#374151", lineHeight: 1.5 }}>{a.text}</p>
                  </div>
                ))}
              </div>
            </div> */}

            {/* Need Help */}
            <div style={{ background: "white", borderRadius: "14px", padding: "22px", boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px", color: "#1b3a57" }}>Need Help?</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem", color: "#374151" }}>
                  <span style={{ fontSize: "1.1rem" }}>📞</span>
                  <span><strong>Helpline:</strong> 123-456-7890</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.88rem", color: "#374151" }}>
                  <span style={{ fontSize: "1.1rem" }}>✉️</span>
                  <span><strong>Email:</strong> support@sccms.sindh.gov.pk</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
