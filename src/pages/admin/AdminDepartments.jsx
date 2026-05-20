import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';

function getDepartmentTextStyle(department = '') {
  const normalized = department.toLowerCase().replace(/[\s-]/g, '');
  if (normalized.includes('ssgc')) return { color: '#14863e', fontWeight: 700 };
  if (normalized.includes('ke') || normalized.includes('kelectric')) return { color: '#f97316', fontWeight: 700 };
  if (normalized.includes('waterboard') || normalized.includes('water')) return { color: '#2563eb', fontWeight: 700 };
  return { color: '#334155' };
}

export default function AdminDepartments() {
  const token = localStorage.getItem('token');
  const [departments, setDepartments] = useState([]);
  const [deptName, setDeptName] = useState('');
  const [editId, setEditId] = useState(null);

  function loadDepartments() {
    fetch('/api/admin/departments', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []));
  }

  useEffect(() => { loadDepartments(); }, []);

  async function save() {
    const url = editId ? `/api/admin/departments/${editId}` : '/api/admin/departments';
    const method = editId ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dept_name: deptName }),
    });
    setDeptName('');
    setEditId(null);
    loadDepartments();
  }

  function cancelEdit() {
    setDeptName('');
    setEditId(null);
  }

  return (
    <AdminLayout>
      <h1 style={{ color: '#1b3a57', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Departments Management</h1>

      <div style={{ background: 'white', borderRadius: '12px', padding: '18px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ margin: 0, color: '#1b3a57' }}>{editId ? 'Edit Department' : 'Add New Department'}</h3>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.84rem' }}>Create and manage departments available for complaints.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) auto auto', gap: '12px', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '0.84rem', fontWeight: 700 }}>
            Department Name
            <input placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', fontSize: '0.9rem', outlineColor: '#3b82f6' }} />
          </label>
          <button onClick={save} style={{ background: '#1b3a57', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 18px', fontWeight: 700, cursor: 'pointer' }}>
            {editId ? 'Update' : 'Add'}
          </button>
          {editId ? (
            <button onClick={cancelEdit} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['ID', 'Name', 'Action'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.DEPT_ID}>
                <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>{d.DEPT_ID}</td>
                <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', ...getDepartmentTextStyle(d.DEPT_NAME) }}>{d.DEPT_NAME}</td>
                <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <button onClick={() => { setEditId(d.DEPT_ID); setDeptName(d.DEPT_NAME); }} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}