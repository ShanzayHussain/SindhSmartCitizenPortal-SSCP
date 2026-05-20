import React, { useEffect, useState } from 'react';
import DashboardLayout from './DashboardLayout';

function getAuthHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

const inputClass = 'w-full rounded-lg border border-[#ccd4e2] bg-white px-3 py-2 text-[0.88rem] text-[#1f2937] focus:outline-none focus:ring-1 focus:ring-[#1b3a57] disabled:bg-[#f8fafc] disabled:text-[#64748b]';

export default function Profile() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [avatar, setAvatar] = useState(user.profilepic || null);
  const [complaintStats, setComplaintStats] = useState({ filed: 0, resolved: 0, active: 0 });

  const [form, setForm] = useState({
    name: user.full_name || '',
    father: user.father_name || '',
    phone: user.phone || '',
    email: user.email || '',
    address: user.address || '',
    district: user.district || '',
    cnic: user.cnic || '',
    dob: user.dob || '',
  });

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user.user_id) return;
    fetch(`/api/users/${user.user_id}/logs`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setLogs(data.map((item) => ({
          date: item.DATE_STR || '-',
          device: item.DEVICE || '-',
          location: item.IP_ADDRESS || '-',
          status: item.STATUS || '-',
          green: item.STATUS === 'Success',
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user.user_id) return;
    fetch(`/api/dashboard/${user.user_id}`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const stats = data?.stats || {};
        const total = Number(stats.total || 0);
        const resolved = Number(stats.resolved || 0);
        const pending = Number(stats.pending || 0);
        const inProgress = Number(stats.inProgress || 0);
        setComplaintStats({ filed: total, resolved, active: pending + inProgress });
      })
      .catch(() => {});
  }, []);

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    try {
      const res = await fetch(`/api/users/${currentUser.user_id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          full_name: form.name,
          father_name: form.father,
          phone: form.phone,
          email: form.email,
          address: form.address,
          district: form.district,
          cnic: form.cnic,
          dob: form.dob || null,
          profilepic: avatar || null,
        }),
      });

      if (!res.ok) throw new Error('Update failed');

      localStorage.setItem('user', JSON.stringify({
        ...currentUser,
        full_name: form.name,
        father_name: form.father,
        phone: form.phone,
        email: form.email,
        address: form.address,
        district: form.district,
        cnic: form.cnic,
        dob: form.dob,
        profilepic: avatar || null,
      }));

      setMessage('Profile saved successfully!');
      setEdit(false);
    } catch (err) {
      setMessage(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    setForm({
      name: currentUser.full_name || '',
      father: currentUser.father_name || '',
      phone: currentUser.phone || '',
      email: currentUser.email || '',
      address: currentUser.address || '',
      district: currentUser.district || '',
      cnic: currentUser.cnic || '',
      dob: currentUser.dob || '',
    });
    setAvatar(currentUser.profilepic || null);
    setMessage('');
    setEdit(false);
  }

  function pickImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setAvatar(event.target.result);
    reader.readAsDataURL(file);
  }

  const fields = [
    { key: 'name', label: 'Full Name' },
    { key: 'father', label: 'Father Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'district', label: 'District' },
    { key: 'cnic', label: 'CNIC' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'address', label: 'Address' },
  ];

  return (
    <DashboardLayout>
      <div style={{ fontFamily: "'Segoe UI', sans-serif", color: '#1f2937' }}>
        <div style={{ marginBottom: '22px' }}>
          <h1 style={{ color: '#1b3a57', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Profile</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: '0.95rem' }}>Manage your account details and view recent security activity.</p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.07)]">
              <div className="flex flex-col items-center text-center">
                {avatar ? (
                  <img src={avatar} alt="profile" className="h-32 w-32 rounded-full border-4 border-[#eef3fb] object-cover shadow" onError={() => setAvatar(null)} />
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[#eef3fb] bg-[#f8fafc] text-3xl font-bold text-[#1b3a57]">
                    {(form.name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                )}
                {edit && (
                  <label className="mt-3 cursor-pointer rounded-lg border border-[#c8d4e6] bg-[#f6f8fb] px-3 py-2 text-sm font-semibold text-[#254265] hover:bg-[#eef3fb]">
                    Upload Photo
                    <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
                  </label>
                )}
                <h2 className="mb-1 mt-4 text-xl font-bold text-[#1b3a57]">{form.name || 'User'}</h2>
                <p className="m-0 text-sm font-semibold uppercase text-[#64748b]">{user.role || 'USER'}</p>
                <p className="mt-2 text-sm text-[#64748b]">CNIC: {form.cnic || '-'}</p>
              </div>
              {!edit ? (
                <button onClick={() => { setMessage(''); setEdit(true); }} className="mt-5 w-full rounded-lg bg-[#1b3a57] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#254a78]">
                  Edit Profile
                </button>
              ) : null}
            </section>

            <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.07)]">
              <h3 className="mb-4 mt-0 text-base font-bold text-[#1b3a57]">Complaint Stats</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Filed', count: complaintStats.filed, color: '#1b3a57' },
                  { label: 'Resolved', count: complaintStats.resolved, color: '#14863e' },
                  { label: 'Active', count: complaintStats.active, color: '#f59e0b' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <p className="m-0 text-2xl font-extrabold" style={{ color: item.color }}>{item.count}</p>
                    <p className="m-0 text-xs font-semibold text-[#64748b]">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-5">
            {message && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.includes('success') ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {message}
              </div>
            )}

            <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.07)]">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#e5e7eb] pb-3">
                <h3 className="m-0 text-base font-bold text-[#1b3a57]">Profile Details</h3>
                {edit ? (
                  <div className="flex gap-2">
                    <button onClick={saveProfile} disabled={saving} className="rounded-lg bg-[#14863e] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelEdit} className="rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-4 py-2 text-sm font-bold text-[#334155]">
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {fields.map(({ key, label, type }) => (
                  <label key={key} className={key === 'address' ? 'grid gap-1.5 text-sm font-bold text-[#314a6f] md:col-span-2' : 'grid gap-1.5 text-sm font-bold text-[#314a6f]'}>
                    {label}
                    <input
                      type={type || 'text'}
                      value={form[key]}
                      disabled={!edit || key === 'cnic' || key === 'email'}
                      max={type === 'date' ? today : undefined}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </section>

            {/* <section className="rounded-[14px] border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.07)]">
              <h3 className="mb-4 mt-0 text-base font-bold text-[#1b3a57]">Security Logs</h3>
              {logs.length === 0 ? (
                <p className="py-5 text-center text-sm text-[#64748b]">No login history yet.</p> */}
              {/* ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#f8fafc] text-[#334155]">
                        {['Date', 'Device', 'Location', 'Status'].map((heading) => (
                          <th key={heading} className="border-b border-[#e2e8f0] px-3 py-2 text-left font-bold">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, index) => (
                        <tr key={index} className="hover:bg-[#f8fafc]">
                          <td className="border-b border-[#f1f5f9] px-3 py-2">{log.date}</td>
                          <td className="border-b border-[#f1f5f9] px-3 py-2">{log.device}</td>
                          <td className="border-b border-[#f1f5f9] px-3 py-2">{log.location}</td>
                          <td className={`border-b border-[#f1f5f9] px-3 py-2 font-bold ${log.green ? 'text-green-600' : 'text-red-500'}`}>{log.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section> */}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}