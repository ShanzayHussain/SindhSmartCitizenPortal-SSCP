import { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';

const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Closed'];

const STATUS_STYLES = {
  Pending: { background: '#f59e0b', color: 'white' },
  'In Progress': { background: '#3b82f6', color: 'white' },
  Resolved: { background: '#14863e', color: 'white' },
  Closed: { background: '#dc2626', color: 'white' },
};

const fieldStyle = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '9px 11px',
  fontSize: '0.88rem',
  outlineColor: '#3b82f6',
  background: 'white',
};

function getDepartmentTextStyle(department = '') {
  const normalized = department.toLowerCase().replace(/[\s-]/g, '');
  if (normalized.includes('ssgc')) return { color: '#14863e', fontWeight: 700 };
  if (normalized.includes('ke') || normalized.includes('kelectric')) return { color: '#f97316', fontWeight: 700 };
  if (normalized.includes('waterboard') || normalized.includes('water')) return { color: '#2563eb', fontWeight: 700 };
  return { color: '#334155' };
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { background: '#64748b', color: 'white' };
  return (
    <span style={{ ...style, display: 'inline-block', minWidth: '86px', textAlign: 'center', borderRadius: '999px', padding: '4px 10px', fontSize: '0.76rem', fontWeight: 800 }}>
      {status}
    </span>
  );
}

function getMimeType(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const types = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    txt: 'text/plain',
  };
  return types[ext] || 'application/octet-stream';
}

function base64ToBlob(base64, mimeType) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export default function AdminComplaints() {
  const token = localStorage.getItem('token');
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ status: '', search: '', dept_id: '' });
  const [form, setForm] = useState({ status: '', officer_id: '', admin_remarks: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadData(nextFilters = filters) {
    const q = new URLSearchParams();
    if (nextFilters.status) q.set('status', nextFilters.status);
    if (nextFilters.search) q.set('search', nextFilters.search);
    if (nextFilters.dept_id) q.set('dept_id', nextFilters.dept_id);

    try {
      const res = await fetch(`/api/admin/complaints?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || 'Could not load complaints.');
      setComplaints(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setError(err.message);
      return [];
    }
  }

  useEffect(() => {
    loadData();
  }, [filters.status, filters.search, filters.dept_id]);

  useEffect(() => {
    fetch('/api/admin/departments', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || 'Could not load departments.');
        return data;
      })
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selected?.COMPLAINT_ID) return;
    setDetailLoading(true);
    setError('');
    setMessage('');

    fetch(`/api/admin/complaints/${selected.COMPLAINT_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const detail = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(detail?.details || detail?.message || 'Could not load complaint detail.');
        return detail;
      })
      .then((detail) => {
        setSelected(detail);
        setForm({
          status: detail.STATUS || 'Pending',
          officer_id: detail.OFFICER_ID || '',
          admin_remarks: detail.ADMIN_REMARKS || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false));
  }, [selected?.COMPLAINT_ID]);

  useEffect(() => {
    if (!selected?.DEPT_ID) return;
    fetch(`/api/admin/officers?dept_id=${selected.DEPT_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || 'Could not load officers.');
        return data;
      })
      .then((data) => setOfficers(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message));
  }, [selected?.DEPT_ID]);

  const deptOfficers = useMemo(
    () => officers.filter((officer) => Number(officer.DEPT_ID) === Number(selected?.DEPT_ID)),
    [officers, selected?.DEPT_ID],
  );

  async function saveUpdate() {
    if (!selected?.COMPLAINT_ID) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/admin/complaints/${selected.COMPLAINT_ID}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Could not update complaint.');

      const updatedSelected = { ...selected, ...(data?.complaint || {}), ADMIN_REMARKS: form.admin_remarks };
      setSelected(updatedSelected);
      setForm({
        status: updatedSelected.STATUS || 'Pending',
        officer_id: updatedSelected.OFFICER_ID || '',
        admin_remarks: updatedSelected.ADMIN_REMARKS || '',
      });
      setComplaints((current) => current.map((complaint) => (
        complaint.COMPLAINT_ID === updatedSelected.COMPLAINT_ID ? { ...complaint, ...updatedSelected } : complaint
      )));
      setMessage(data?.message || 'Complaint updated successfully.');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(docId) {
    setError('');
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Could not open document.');
      if (!data?.file_data) throw new Error('Document data is empty.');

      const fileName = data.file_name || 'document';
      const mimeType = getMimeType(fileName);
      const blob = base64ToBlob(data.file_data, mimeType);
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminLayout>
      <div style={{ fontFamily: "'Segoe UI', sans-serif", color: '#1f2937' }}>
        <div style={{ marginBottom: '18px' }}>
          <h1 style={{ color: '#1b3a57', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Complaint Management</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.92rem' }}>Review complaints, assign officers, update status, and inspect attachments.</p>
        </div>

        {error ? <p style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 12px' }}>{error}</p> : null}
        {message ? <p style={{ color: '#14863e', background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px' }}>{message}</p> : null}

        <section style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 190px 220px', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '0.82rem', fontWeight: 800 }}>
              Search
              <input placeholder="Search title or citizen" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} style={fieldStyle} />
            </label>
            <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '0.82rem', fontWeight: 800 }}>
              Status
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={fieldStyle}>
                <option value="">All Statuses</option>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '0.82rem', fontWeight: 800 }}>
              Department
              <select value={filters.dept_id} onChange={(e) => setFilters({ ...filters, dept_id: e.target.value })} style={fieldStyle}>
                <option value="">All Departments</option>
                {departments.map((department) => (
                  <option key={department.DEPT_ID} value={department.DEPT_ID}>{department.DEPT_NAME}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(460px, 560px)', gap: '16px', alignItems: 'start' }}>
          <section style={{ background: 'white', borderRadius: '14px', padding: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#1b3a57', fontSize: '1.05rem' }}>Complaints</h2>
              <span style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>{complaints.length} records</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['ID', 'Title', 'Citizen', 'Dept', 'Status'].map((heading) => (
                      <th key={heading} style={{ textAlign: 'left', padding: '10px 8px', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {complaints.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '18px 8px', textAlign: 'center', color: '#64748b' }}>No complaints found.</td></tr>
                  ) : complaints.map((complaint) => {
                    const isSelected = selected?.COMPLAINT_ID === complaint.COMPLAINT_ID;
                    return (
                      <tr
                        key={complaint.COMPLAINT_ID}
                        style={{ cursor: 'pointer', background: isSelected ? '#dbeafe' : 'transparent', boxShadow: isSelected ? 'inset 4px 0 0 #2563eb' : 'none' }}
                        onClick={() => setSelected(complaint)}
                      >
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, color: '#1b3a57' }}>{complaint.COMPLAINT_ID}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>{complaint.TITLE}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>{complaint.CITIZEN_NAME}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', ...getDepartmentTextStyle(complaint.DEPARTMENT) }}>{complaint.DEPARTMENT}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}><StatusBadge status={complaint.STATUS} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb', maxHeight: 'calc(100vh - 190px)', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 12px', color: '#1b3a57', fontSize: '1.05rem' }}>Complaint Details</h2>
            {!selected ? <p style={{ color: '#64748b' }}>Select a complaint.</p> : detailLoading ? <p style={{ color: '#64748b' }}>Loading complaint detail...</p> : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', color: '#64748b', fontSize: '0.78rem', fontWeight: 800 }}>COMPLAINT #{selected.COMPLAINT_ID}</p>
                    <h3 style={{ margin: 0, color: '#1b3a57', fontSize: '1.15rem' }}>{selected.TITLE}</h3>
                  </div>
                  <StatusBadge status={selected.STATUS} />
                </div>

                <section style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#1b3a57' }}>Complaint</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', fontSize: '0.9rem' }}>
                    <p style={{ margin: 0 }}><strong>Department:</strong> <span style={getDepartmentTextStyle(selected.DEPARTMENT)}>{selected.DEPARTMENT}</span></p>
                    <p style={{ margin: 0 }}><strong>Officer:</strong> {selected.OFFICER_NAME || 'Not Assigned'}</p>
                    <p style={{ margin: 0 }}><strong>Filed On:</strong> {selected.DATE_FILED || '-'}</p>
                    <p style={{ margin: 0 }}><strong>Resolved On:</strong> {selected.DATE_RESOLVED || '-'}</p>
                  </div>
                  <p style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' }}><strong>Description:</strong><br />{selected.DESCRIPTION || '-'}</p>
                </section>

                <section style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#1b3a57' }}>Citizen</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', fontSize: '0.9rem' }}>
                    <p style={{ margin: 0 }}><strong>Name:</strong> {selected.CITIZEN_NAME || '-'}</p>
                    <p style={{ margin: 0 }}><strong>Email:</strong> {selected.CITIZEN_EMAIL || '-'}</p>
                    <p style={{ margin: 0 }}><strong>CNIC:</strong> {selected.CITIZEN_CNIC || '-'}</p>
                    <p style={{ margin: 0 }}><strong>Phone:</strong> {selected.CITIZEN_PHONE || '-'}</p>
                  </div>
                  <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}><strong>Address:</strong><br />{selected.CITIZEN_ADDRESS || '-'}</p>
                </section>

                <section style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '14px' }}>
                  <h4 style={{ margin: '0 0 10px', color: '#1b3a57' }}>Attachments</h4>
                  {(selected.documents || []).map((document) => (
                    <button key={document.DOC_ID} onClick={() => openDocument(document.DOC_ID)} style={{ display: 'block', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', padding: '9px 11px', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px', width: '100%', textAlign: 'left', fontWeight: 700 }}>
                      {document.FILE_NAME || `Document ${document.DOC_ID}`}
                    </button>
                  ))}
                  {(selected.documents || []).length === 0 ? <p style={{ color: '#64748b', margin: 0 }}>No documents attached.</p> : null}
                </section>

                <section>
                  <h4 style={{ margin: '0 0 10px', color: '#1b3a57' }}>Admin Action</h4>
                  <label style={{ display: 'grid', gap: '6px', marginBottom: '10px', color: '#334155', fontSize: '0.84rem', fontWeight: 800 }}>
                    Status
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={fieldStyle}>
                      {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '6px', marginBottom: '10px', color: '#334155', fontSize: '0.84rem', fontWeight: 800 }}>
                    Assign Officer
                    <select value={form.officer_id} onChange={(e) => setForm({ ...form, officer_id: e.target.value })} style={fieldStyle}>
                      <option value="">Not Assigned</option>
                      {deptOfficers.map((officer) => <option key={officer.OFFICER_ID} value={officer.OFFICER_ID}>{officer.OFFICER_NAME}</option>)}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '6px', color: '#334155', fontSize: '0.84rem', fontWeight: 800 }}>
                    Admin Remarks
                    <textarea value={form.admin_remarks} onChange={(e) => setForm({ ...form, admin_remarks: e.target.value })} style={{ ...fieldStyle, minHeight: '92px', resize: 'vertical' }} />
                  </label>

                  <button disabled={saving} onClick={saveUpdate} style={{ marginTop: '12px', background: saving ? '#64748b' : '#1b3a57', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 800 }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}