import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { apiFetch } from '../../lib/api';

function getDepartmentTextStyle(department = '') {
  const normalized = department.toLowerCase().replace(/[\s-]/g, '');
  if (normalized.includes('ssgc')) return { color: '#14863e', fontWeight: 700 };
  if (normalized.includes('ke') || normalized.includes('kelectric')) return { color: '#f97316', fontWeight: 700 };
  if (normalized.includes('waterboard') || normalized.includes('water')) return { color: '#2563eb', fontWeight: 700 };
  return { color: '#334155' };
}

const fieldStyle = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '0.9rem',
  outlineColor: '#3b82f6',
};

export default function AdminOfficers() {
  const [officers, setOfficers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ officer_name: '', dept_id: '' });
  const [editId, setEditId] = useState(null);

  function loadOfficers() {
    apiFetch('/admin/officers')
      .then((r) => r.json())
      .then((d) => setOfficers(Array.isArray(d) ? d : []));
  }

  useEffect(() => {
    loadOfficers();
    apiFetch('/admin/departments')
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []));
  }, []);

  async function save() {
    const url = editId ? `/admin/officers/${editId}` : '/admin/officers';
    const method = editId ? 'PUT' : 'POST';
    await apiFetch(url, {
      method,
      body: JSON.stringify(form),
    });
    setForm({ officer_name: '', dept_id: '' });
    setEditId(null);
    loadOfficers();
  }

  function cancelEdit() {
    setForm({ officer_name: '', dept_id: '' });
    setEditId(null);
  }

  return (
    <AdminLayout>
      <h1 style={{ color: '#1b3a57', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Officers Management</h1>

      <div style={{ background: 'white', borderRadius: '12px', padding: '18px', marginBottom: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#1b3a57' }}>{editId ? 'Edit Officer' : 'Add New Officer'}</h3>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.84rem' }}>Assign an officer to the department they will handle.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr) auto auto', gap: '12px', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '0.84rem', fontWeight: 700 }}>
            Officer Name
            <input placeholder="Officer name" value={form.officer_name} onChange={(e) => setForm({ ...form, officer_name: e.target.value })} style={fieldStyle} />
          </label>
          <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '0.84rem', fontWeight: 700 }}>
            Department
            <select value={form.dept_id} onChange={(e) => setForm({ ...form, dept_id: e.target.value })} style={fieldStyle}>
              <option value="">Select Department</option>
              {departments.map((d) => <option key={d.DEPT_ID} value={d.DEPT_ID}>{d.DEPT_NAME}</option>)}
            </select>
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
          <thead><tr>{['ID', 'Name', 'Department', 'Action'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
          <tbody>
            {officers.map((o) => (
              <tr key={o.OFFICER_ID}>
                <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>{o.OFFICER_ID}</td>
                <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>{o.OFFICER_NAME}</td>
                <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', ...getDepartmentTextStyle(o.DEPT_NAME) }}>{o.DEPT_NAME}</td>
                <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <button onClick={() => { setEditId(o.OFFICER_ID); setForm({ officer_name: o.OFFICER_NAME, dept_id: o.DEPT_ID }); }} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
