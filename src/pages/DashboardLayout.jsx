import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Building2, FileText, Home, LogOut, User } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { apiFetch } from '../lib/api';


const SIDEBAR_LINKS = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Departments', href: '/departments', icon: Building2 },
  { name: 'Complaints', href: '/complaint', icon: FileText },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Logout', href: '/', icon: LogOut },
];


function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getComplaintFingerprint(complaint) {
  return [
    complaint.STATUS || '',
    complaint.OFFICER || '',
    complaint.TITLE || '',
    complaint.DEPARTMENT || '',
  ].join('|');
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || '') || fallback;
  } catch {
    return fallback;
  }
}

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useMemo(() => getCurrentUser(), []);
  const userId = user?.user_id;
  const snapshotKey = userId ? `complaintUpdateSnapshot:${userId}` : '';
  const readKey = userId ? `complaintUpdateReadKeys:${userId}` : '';

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readKeys, setReadKeys] = useState(() => (readKey ? readJson(readKey, []) : []));
  const initializedRef = useRef(false);

  const unreadCount = notifications.filter((item) => !readKeys.includes(item.key)).length;

  useEffect(() => {
    if (!userId || !snapshotKey) return;
    let mounted = true;

    async function loadComplaintUpdates() {
      try {
        const res = await apiFetch(`/complaints/user/${userId}`);
        const data = await res.json().catch(() => []);
        if (!res.ok || !Array.isArray(data) || !mounted) return;

        const previousSnapshot = readJson(snapshotKey, null);
        const nextSnapshot = {};
        const updates = [];

        data.forEach((complaint) => {
          const id = String(complaint.COMPLAINT_ID);
          const fingerprint = getComplaintFingerprint(complaint);
          nextSnapshot[id] = fingerprint;

          if (previousSnapshot && previousSnapshot[id] && previousSnapshot[id] !== fingerprint) {
            updates.push({
              key: `${id}:${fingerprint}`,
              complaintId: complaint.COMPLAINT_ID,
              title: complaint.TITLE || `Complaint ${complaint.COMPLAINT_ID}`,
              status: complaint.STATUS || 'Updated',
              officer: complaint.OFFICER || 'Not Assigned',
              department: complaint.DEPARTMENT || '',
            });
          }
        });

        localStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot));
        if (updates.length) {
          setNotifications((current) => {
            const existing = new Set(current.map((item) => item.key));
            return [...updates.filter((item) => !existing.has(item.key)), ...current].slice(0, 8);
          });
        } else if (!initializedRef.current) {
          setNotifications([]);
        }
        initializedRef.current = true;
      } catch {
        // Header notifications should never interrupt the page.
      }
    }

    loadComplaintUpdates();
    const interval = window.setInterval(loadComplaintUpdates, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [snapshotKey, userId]);

  function openNotifications() {
    setNotificationOpen((current) => !current);
    const nextReadKeys = Array.from(new Set([...readKeys, ...notifications.map((item) => item.key)]));
    setReadKeys(nextReadKeys);
    if (readKey) localStorage.setItem(readKey, JSON.stringify(nextReadKeys));
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', sans-serif" }}>
      <nav style={{
        background: 'linear-gradient(90deg, #0e2a4a 0%, #1a3f6f 100%)',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logo} alt="Logo" style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', objectFit: 'contain' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.3px' }}>
            Sindh Smart Citizen Portal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={openNotifications}
              aria-label="View complaint update notifications"
              style={{
                position: 'relative',
                width: '38px',
                height: '38px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.24)',
                background: notificationOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.15rem',
              }}
            >
              <Bell size={19} strokeWidth={2.3} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 5px',
                  borderRadius: '999px',
                  background: '#dc2626',
                  color: 'white',
                  border: '2px solid #15375f',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notificationOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '48px',
                width: '340px',
                background: 'white',
                border: '1px solid #dbe3ef',
                borderRadius: '12px',
                boxShadow: '0 18px 45px rgba(15,23,42,0.24)',
                overflow: 'hidden',
                zIndex: 200,
              }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <div style={{ color: '#1b3a57', fontWeight: 800, fontSize: '0.95rem' }}>Complaint Updates</div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>New admin changes appear here.</div>
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '18px 14px', color: '#64748b', fontSize: '0.86rem', textAlign: 'center' }}>
                      No new complaint updates yet.
                    </div>
                  ) : notifications.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setNotificationOpen(false);
                        navigate('/complaint');
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        borderBottom: '1px solid #edf2f7',
                        background: 'white',
                        padding: '12px 14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                        <strong style={{ color: '#1b3a57', fontSize: '0.88rem' }}>CMP-{String(item.complaintId).padStart(5, '0')}</strong>
                        <span style={{ color: '#2563eb', fontSize: '0.78rem', fontWeight: 800 }}>{item.status}</span>
                      </div>
                      <div style={{ color: '#334155', fontSize: '0.84rem', marginTop: '4px' }}>{item.title}</div>
                      <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: '3px' }}>
                        {item.department} · Officer: {item.officer}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/profile')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
          >
            <img src={logo} alt="User" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', objectFit: 'cover' }} />
          </button>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1 }}>
        <aside style={{
          width: '220px',
          minHeight: 'calc(100vh - 64px)',
          background: 'linear-gradient(180deg, #0e2a4a 0%, #1a3f6f 100%)',
          padding: '16px 0',
          flexShrink: 0,
        }}>
          {SIDEBAR_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;
            const isLogout = link.name === 'Logout';
            return (
              <Link
                key={link.name}
                to={link.href}
                onClick={(event) => {
                  if (isLogout) {
                    event.preventDefault();
                    logout();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 20px',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  borderLeft: isActive ? '3px solid #4ade80' : '3px solid transparent',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }
                }}
              >
                <Icon size={18} strokeWidth={2.2} />
                {link.name}
              </Link>
            );
          })}
        </aside>

        <main style={{ flex: 1, background: '#f0f4f8', padding: '24px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}