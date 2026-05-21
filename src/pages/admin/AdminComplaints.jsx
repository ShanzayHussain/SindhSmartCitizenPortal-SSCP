import { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { apiFetch } from '../../lib/api';

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
  if (normalized.includes('ke') || normalized.includes('kelectric'))
    return { color: '#f97316', fontWeight: 700 };
  if (
    normalized.includes('waterboard') ||
    normalized.includes('water')
  )
    return { color: '#2563eb', fontWeight: 700 };

  return { color: '#334155' };
}

function StatusBadge({ status }) {
  const style =
    STATUS_STYLES[status] || {
      background: '#64748b',
      color: 'white',
    };

  return (
    <span
      style={{
        ...style,
        display: 'inline-block',
        minWidth: '86px',
        textAlign: 'center',
        borderRadius: '999px',
        padding: '4px 10px',
        fontSize: '0.76rem',
        fontWeight: 800,
      }}
    >
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

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [selected, setSelected] = useState(null);

  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dept_id: '',
  });

  const [form, setForm] = useState({
    status: '',
    officer_id: '',
    admin_remarks: '',
  });

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
      const res = await apiFetch(
        `/admin/complaints?${q.toString()}`
      );

      const data = await res.json().catch(() => []);

      if (!res.ok)
        throw new Error(
          data?.message || 'Could not load complaints.'
        );

      setComplaints(Array.isArray(data) ? data : []);

      return Array.isArray(data) ? data : [];
    } catch (err) {
      setError(err.message);
      return [];
    }
  }

  useEffect(() => {
    loadData();
  }, [
    filters.status,
    filters.search,
    filters.dept_id,
  ]);

  useEffect(() => {
    apiFetch('/admin/departments')
      .then(async (res) => {
        const data = await res.json().catch(() => []);

        if (!res.ok)
          throw new Error(
            data?.message ||
              'Could not load departments.'
          );

        return data;
      })
      .then((data) =>
        setDepartments(Array.isArray(data) ? data : [])
      )
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selected?.complaint_id) return;

    setDetailLoading(true);

    apiFetch(
      `/admin/complaints/${selected.complaint_id}`
    )
      .then(async (res) => {
        const detail = await res.json();

        if (!res.ok)
          throw new Error(
            detail?.message ||
              'Could not load complaint'
          );

        return detail;
      })
      .then((detail) => {
        setSelected(detail);

        setForm({
          status: detail.status || 'Pending',
          officer_id:
            detail.officer_id || '',
          admin_remarks:
            detail.admin_remarks || '',
        });
      })
      .finally(() => setDetailLoading(false));
  }, [selected?.complaint_id]);

  useEffect(() => {
    if (!selected?.dept_id) return;

    apiFetch(
      `/admin/officers?dept_id=${selected.dept_id}`
    )
      .then((r) => r.json())
      .then(setOfficers);
  }, [selected?.dept_id]);

  const deptOfficers = useMemo(
    () =>
      officers.filter(
        (o) =>
          Number(o.dept_id) ===
          Number(selected?.dept_id)
      ),
    [officers, selected?.dept_id]
  );

  return (
    <AdminLayout>

      {complaints.map((complaint) => (
        <div
          key={complaint.complaint_id}
          onClick={() =>
            setSelected(complaint)
          }
        >
          {complaint.title}

          <div>
            {complaint.citizen_name}
          </div>

          <div
            style={getDepartmentTextStyle(
              complaint.department
            )}
          >
            {complaint.department}
          </div>

          <StatusBadge
            status={complaint.status}
          />
        </div>
      ))}

      {selected && (
        <>
          <h3>{selected.title}</h3>

          <p>
            {selected.description}
          </p>

          <p>
            Department:
            {selected.department}
          </p>

          <p>
            Officer:
            {selected.officer_name ||
              'Not Assigned'}
          </p>

          <p>
            Filed:
            {selected.date_filed}
          </p>

          <p>
            Resolved:
            {selected.date_resolved}
          </p>

          <p>
            Citizen:
            {selected.citizen_name}
          </p>

          <select
            value={form.officer_id}
            onChange={(e) =>
              setForm({
                ...form,
                officer_id:
                  e.target.value,
              })
            }
          >
            <option value="">
              Not Assigned
            </option>

            {deptOfficers.map(
              (officer) => (
                <option
                  key={
                    officer.officer_id
                  }
                  value={
                    officer.officer_id
                  }
                >
                  {
                    officer.officer_name
                  }
                </option>
              )
            )}
          </select>
        </>
      )}

    </AdminLayout>
  );
}