import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Droplets, Flame, Zap } from 'lucide-react';
import DashboardLayout from './DashboardLayout';
import { apiFetch } from '../lib/api';

const API = 'http://localhost:5000/api';

function getDepartmentMeta(name = '') {
  const normalized = name.toLowerCase().replace(/[\s-]/g, '');
  if (normalized.includes('ssgc')) {
    return { Icon: Flame, color: '#14863e', tint: '#e8f7ee', description: 'Gas supply and distribution services' };
  }
  if (normalized.includes('ke') || normalized.includes('kelectric')) {
    return { Icon: Zap, color: '#f97316', tint: '#fff3e8', description: 'Electricity supply and distribution services' };
  }
  if (normalized.includes('waterboard') || normalized.includes('water')) {
    return { Icon: Droplets, color: '#2563eb', tint: '#eaf2ff', description: 'Water supply and sewerage services' };
  }
  return { Icon: Building2, color: '#1b3a57', tint: '#eef3fb', description: 'City utility service department' };
}

export default function Departments() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?.user_id;

  const [departments, setDepartments] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/departments`).then((r) => r.json()),
      userId
        ? apiFetch(`/complaints/user/${userId}`).then((r) => r.json())
        : Promise.resolve([]),
    ])
      .then(([depts, complaints]) => {
        const safeDepartments = Array.isArray(depts) ? depts : [];
        const safeComplaints = Array.isArray(complaints) ? complaints : [];
        const countMap = {};

        safeComplaints.forEach((complaint) => {
          const dept = safeDepartments.find((item) => item.DEPT_NAME === complaint.DEPARTMENT);
          if (dept) countMap[dept.DEPT_ID] = (countMap[dept.DEPT_ID] || 0) + 1;
        });

        setDepartments(safeDepartments);
        setCounts(countMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <DashboardLayout>
      <div style={{ fontFamily: "'Segoe UI', sans-serif", color: '#1f2937' }}>
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ color: '#1b3a57', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Departments</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
            View service departments and open the complaint form for city utility issues.
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: '14px', padding: '22px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#1b3a57' }}>Available Departments</h2>
              <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: '0.86rem' }}>Select a department to start or track a related complaint.</p>
            </div>
            <button
              onClick={() => navigate('/complaint')}
              style={{ background: '#1b3a57', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}
            >
              File Complaint
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '24px 0' }}>Loading departments...</p>
          ) : departments.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '24px 0' }}>No departments found.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
              {departments.map((dept) => {
                const meta = getDepartmentMeta(dept.DEPT_NAME);
                const Icon = meta.Icon;
                const count = counts[dept.DEPT_ID] ?? 0;

                return (
                  <button
                    key={dept.DEPT_ID}
                    onClick={() => navigate('/complaint')}
                    style={{ textAlign: 'left', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(15,23,42,0.06)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <span style={{ width: '44px', height: '44px', borderRadius: '10px', background: meta.tint, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={24} />
                      </span>
                      <div>
                        <h3 style={{ margin: 0, color: meta.color, fontSize: '1rem', fontWeight: 800 }}>{dept.DEPT_NAME}</h3>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.82rem' }}>{meta.description}</p>
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ color: '#1b3a57', fontSize: '1.45rem', fontWeight: 800, lineHeight: 1 }}>{count.toLocaleString()}</div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, marginTop: '4px' }}>My Complaints</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
