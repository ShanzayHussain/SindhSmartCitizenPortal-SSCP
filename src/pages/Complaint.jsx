import React, { useEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SelectInput, TextArea, TextInput } from '../components/ui/FormField';
import DashboardLayout from './DashboardLayout';
import { apiFetch } from '../lib/api';

const API = 'http://localhost:5000/api';

const statusClassMap = {
  Pending:       'bg-amber-400',
  'In Progress': 'bg-brand-500',
  Resolved:      'bg-emerald-600',
  Closed:        'bg-red-600',
};

function getTimeline(status) {
  const steps = ['Submitted', 'Under Review', 'Assigned to Officer', 'Resolved'];
  const doneUpTo = {
    Pending:               1,
    'In Progress':         2,
    'Assigned to Officer': 3,
    Resolved:              4,
    Closed:                4,
  };
  const doneCount = doneUpTo[status] ?? 1;
  return steps.map((label, i) => ({ label, done: i < doneCount }));
}
function getDepartmentTextStyle(department = '') {
  const normalized = department.toLowerCase().replace(/[\s-]/g, '');
  if (normalized.includes('ssgc')) return { color: '#14863e', fontWeight: 700 };
  if (normalized.includes('ke') || normalized.includes('kelectric')) return { color: '#f97316', fontWeight: 700 };
  if (normalized.includes('waterboard') || normalized.includes('water')) return { color: '#2563eb', fontWeight: 700 };
  return undefined;
}

// ── Detail Modal ─────────────────────────────────────────────────
function DetailModal({ complaintId, onClose }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!complaintId) return;
    setLoading(true);
    apiFetch(`/complaints/${complaintId}`)
      .then(r => r.json())
      .then(data => { setDetail(data); setLoading(false); })
      .catch(() => { setError('Failed to load details.'); setLoading(false); });
  }, [complaintId]);

  // Close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const timeline = detail ? getTimeline(detail.STATUS) : [];

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 backdrop-blur-[2px]"
    >
      <div className="relative w-full max-w-lg rounded-lg border border-[#d5dce8] bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e0e6ef] px-5 py-3.5">
          <div>
            <h2 className="text-[1rem] font-semibold text-[#1e3354]">
              {detail ? `CMP-${String(detail.COMPLAINT_ID).padStart(5, '0')}` : 'Loading…'}
            </h2>
            {detail && (
              <p className="text-[0.75rem] text-[#6b82a8]"><span style={getDepartmentTextStyle(detail.DEPARTMENT)}>{detail.DEPARTMENT}</span> · Filed {detail.DATE_FILED}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#6b82a8] hover:bg-[#f0f4fa] hover:text-[#1e3354]"
          >✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading && <p className="py-6 text-center text-[0.85rem] text-[#8a9abb]">Loading…</p>}
          {error   && <p className="py-6 text-center text-[0.85rem] text-red-500">{error}</p>}

          {detail && !loading && (
            <div className="space-y-4">

              {/* Status + Officer row */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide text-[#8a9abb]">Status</p>
                  <span className={`inline-block rounded-[3px] px-2 py-[3px] text-[0.72rem] font-bold text-white ${statusClassMap[detail.STATUS] ?? 'bg-gray-400'}`}>
                    {detail.STATUS}
                  </span>
                </div>
                <div>
                  <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide text-[#8a9abb]">Assigned Officer</p>
                  <p className="text-[0.83rem] font-semibold text-[#1e3354]">{detail.OFFICER}</p>
                </div>
                {detail.DATE_RESOLVED && (
                  <div>
                    <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide text-[#8a9abb]">Resolved On</p>
                    <p className="text-[0.83rem] text-[#1e3354]">{detail.DATE_RESOLVED}</p>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide text-[#8a9abb]">Subject</p>
                <p className="text-[0.85rem] font-semibold text-[#1e3354]">{detail.TITLE}</p>
              </div>

              {/* Description */}
              {detail.DESCRIPTION && (
                <div>
                  <p className="mb-1 text-[0.72rem] font-semibold uppercase tracking-wide text-[#8a9abb]">Description</p>
                  <p className="rounded-md bg-[#f6f8fb] px-3 py-2.5 text-[0.83rem] leading-relaxed text-[#2c4368]">
                    {detail.DESCRIPTION}
                  </p>
                </div>
              )}

              {/* Mini Timeline */}
              <div>
                <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-[#8a9abb]">Progress</p>
                <ul className="flex flex-col gap-2.5">
                  {timeline.map((step, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[0.83rem] font-semibold text-[#2c4368]">
                      <span className={step.done
                        ? 'relative h-[13px] w-[13px] flex-shrink-0 rounded-full bg-[#1ca87f]'
                        : 'h-[13px] w-[13px] flex-shrink-0 rounded-full border-[3px] border-[#3f62a1]'}
                      >
                        {step.done && (
                          <span className="absolute left-[3px] top-[1px] h-[7px] w-1 rotate-45 border-b-2 border-r-2 border-white" />
                        )}
                      </span>
                      <span className={step.done ? 'text-[#1e3354]' : 'text-[#8a9abb]'}>{step.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#e0e6ef] px-5 py-3">
          <Button
            type="button"
            onClick={onClose}
            className="rounded-[3px] border border-[#c8d4e6] bg-[#f6f8fb] px-4 py-1.5 text-sm text-[#254265] hover:bg-[#eef3fb]"
          >
            Close
          </Button>
        </div>

      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
function Complaint() {
  const user   = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?.user_id;

  const [departments,  setDepartments]  = useState([]);
  const [complaints,   setComplaints]   = useState([]);
  const [selected,     setSelected]     = useState(null);   // timeline row
  const [modalId,      setModalId]      = useState(null);   // detail modal
  const [loading,      setLoading]      = useState(false);
  const [submitMsg,    setSubmitMsg]    = useState('');

  const [deptId,       setDeptId]       = useState('');
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [fileData,     setFileData]     = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    fetch(`${API}/departments`)
      .then(r => r.json())
      .then(data => { setDepartments(data); if (data.length) setDeptId(data[0].DEPT_ID); })
      .catch(console.error);
  }, []);

  const fetchComplaints = () => {
    if (!userId) return;
    apiFetch(`/complaints/user/${userId}`)
      .then(r => r.json())
      .then(data => {
        setComplaints(data);
        if (data.length) setSelected(prev => prev ?? data[0]);
      })
      .catch(console.error);
  };

  useEffect(() => { fetchComplaints(); }, [userId]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFileData({ name: file.name, base64: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return setSubmitMsg('Please enter a subject.');
    if (!deptId)       return setSubmitMsg('Please select a department.');
    setLoading(true); setSubmitMsg('');
    try {
      const res  = await apiFetch('/complaints', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, dept_id: deptId, title, description }),
      });
      const data = await res.json();
      if (!res.ok) return setSubmitMsg(data.message || 'Submission failed.');

      if (fileData) {
        await apiFetch(`/complaints/${data.complaint_id}/documents`, {
          method: 'POST',
          body: JSON.stringify({ file_name: fileData.name, file_data: fileData.base64 }),
        });
      }

      setSubmitMsg('✅ Complaint submitted successfully!');
      setTitle(''); setDescription(''); setFileData(null);
      if (fileRef.current) fileRef.current.value = '';
      fetchComplaints();
    } catch {
      setSubmitMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const timelineStatus = selected?.STATUS ?? 'Pending';
  const timeline       = getTimeline(timelineStatus);

  return (
    <DashboardLayout>
      {/* Detail Modal */}
      {modalId && <DetailModal complaintId={modalId} onClose={() => setModalId(null)} />}

      <div className="min-h-full font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-[#15213b]">
        <section className="px-3 py-4 sm:px-5 sm:pb-6">
          <h1 style={{ color: '#1b3a57', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Submit Your Concern</h1>

          <div className="grid items-start gap-3 lg:grid-cols-[1fr_260px]">

            {/* Submit Form */}
            <Card className="overflow-hidden rounded-xl border border-[#d5dce8] bg-white p-0 shadow-[0_2px_10px_rgba(12,30,59,0.08)]">
              <div className="border-b border-[#e0e6ef] bg-[#f8fafc] px-5 py-4">
                <h2 className="m-0 text-[1.05rem] font-bold text-[#1b3a57]">Submit New Complaint</h2>
                <p className="mt-1 text-[0.82rem] text-[#64748b]">Add the department, subject, description, and any supporting document.</p>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label htmlFor="department" className="grid gap-1.5 text-[0.83rem] font-bold text-[#314a6f]">
                    Department
                    <SelectInput id="department" value={deptId} onChange={e => setDeptId(e.target.value)}
                      className="rounded-lg border-[#ccd4e2] bg-white px-3 py-2 text-[0.88rem] focus:ring-1">
                      {departments.map(d => <option key={d.DEPT_ID} value={d.DEPT_ID}>{d.DEPT_NAME}</option>)}
                    </SelectInput>
                  </label>
                  <label htmlFor="subject" className="grid gap-1.5 text-[0.83rem] font-bold text-[#314a6f]">
                    Subject
                    <TextInput id="subject" type="text" value={title} onChange={e => setTitle(e.target.value)}
                      className="rounded-lg border-[#ccd4e2] bg-white px-3 py-2 text-[0.88rem] focus:ring-1" />
                  </label>
                </div>

                <label htmlFor="desc" className="grid gap-1.5 text-[0.83rem] font-bold text-[#314a6f]">
                  Complaint Description
                  <TextArea id="desc" value={description} onChange={e => setDescription(e.target.value)}
                    className="min-h-24 resize-none rounded-lg border-[#ccd4e2] bg-white px-3 py-2 text-[0.88rem] focus:ring-1" />
                </label>

                <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f7] pt-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <Button type="button" variant="muted" onClick={() => fileRef.current?.click()}
                      className="rounded-lg border border-[#c8d4e6] bg-[#f6f8fb] px-3 py-2 text-sm font-semibold text-[#254265] hover:bg-[#eef3fb]">
                      {fileData ? `Attached: ${fileData.name}` : 'Upload Document'}
                    </Button>
                    {fileData && (
                      <button onClick={() => { setFileData(null); if (fileRef.current) fileRef.current.value = ''; }}
                        className="rounded-md px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600">Remove</button>
                    )}
                  </div>
                  <Button type="button" variant="success" onClick={handleSubmit} disabled={loading}
                    className="rounded-lg bg-[#14863e] px-5 py-2 text-sm font-bold disabled:opacity-60">
                    {loading ? 'Submitting...' : 'Submit Complaint'}
                  </Button>
                </div>
                {submitMsg && (
                  <p className={`rounded-lg px-3 py-2 text-[0.82rem] font-semibold ${submitMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {submitMsg}
                  </p>
                )}
              </div>
            </Card>
            {/* Timeline */}
            <Card className="rounded-md border-[#d5dce8] px-3.5 py-3 shadow-[0_1px_2px_rgba(12,30,59,0.08)]">
              <h2 className="mb-1 mt-0.5 text-base font-semibold text-[#243c63]">Complaint Timeline</h2>
              {selected && (
                <p className="mb-3 text-[0.72rem] text-[#6b82a8]">
                  {`CMP-${String(selected.COMPLAINT_ID).padStart(5, '0')}`} · {selected.STATUS}
                </p>
              )}
              <ul className="flex list-none flex-col gap-3.5 p-0">
                {timeline.map((step, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[0.86rem] font-semibold text-[#2c4368]">
                    <span className={step.done
                      ? 'relative h-[13px] w-[13px] rounded-full bg-[#1ca87f]'
                      : 'h-[13px] w-[13px] rounded-full border-[3px] border-[#3f62a1]'}>
                      {step.done && <span className="absolute left-[3px] top-[1px] h-[7px] w-1 rotate-45 border-b-2 border-r-2 border-white" />}
                    </span>
                    <span className={step.done ? 'text-[#1e3354]' : 'text-[#8a9abb]'}>{step.label}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Complaints Table */}
          <Card className="mt-3.5 rounded-md border-[#d5dce8] px-3.5 py-3 shadow-[0_1px_2px_rgba(12,30,59,0.08)]">
            <h2 className="mb-3 mt-0.5 text-base font-semibold text-[#243c63]">My Complaints</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Complaint ID','Department','Date','Status','Assigned Officer','Action'].map(h => (
                      <th key={h} className="border-b border-[#e0e6ef] bg-[#f0f4fa] px-2.5 py-2 text-left text-[0.8rem] font-bold text-[#2e4870]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {complaints.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[0.82rem] text-[#8a9abb]">No complaints found.</td>
                    </tr>
                  ) : complaints.map(item => {
                    const isSelected = selected?.COMPLAINT_ID === item.COMPLAINT_ID;
                    return (
                    <tr key={item.COMPLAINT_ID}
                      onClick={() => setSelected(item)}
                      className={`cursor-pointer transition-colors hover:bg-[#f5f8fd] ${isSelected ? 'bg-[#dbeafe] shadow-[inset_4px_0_0_#2563eb]' : ''}`}
                    >
                      <td className="border-b border-[#e0e6ef] px-2.5 py-2 text-[0.8rem]">
                        {`CMP-${String(item.COMPLAINT_ID).padStart(5, '0')}`}
                      </td>
                      <td className="border-b border-[#e0e6ef] px-2.5 py-2 text-[0.8rem]" style={getDepartmentTextStyle(item.DEPARTMENT)}>{item.DEPARTMENT}</td>
                      <td className="border-b border-[#e0e6ef] px-2.5 py-2 text-[0.8rem]">{item.DATE_FILED}</td>
                      <td className="border-b border-[#e0e6ef] px-2.5 py-2 text-[0.8rem]">
                        <span className={`inline-block min-w-[74px] rounded-[3px] px-1.5 py-[3px] text-center text-[0.72rem] font-bold text-white ${statusClassMap[item.STATUS] ?? 'bg-gray-400'}`}>
                          {item.STATUS}
                        </span>
                      </td>
                      <td className="border-b border-[#e0e6ef] px-2.5 py-2 text-[0.8rem]">{item.OFFICER}</td>
                      <td className="border-b border-[#e0e6ef] px-2.5 py-2 text-[0.8rem]">
                        <Button
                          type="button"
                          onClick={e => { e.stopPropagation(); setModalId(item.COMPLAINT_ID); }}
                          className="rounded-[3px] bg-[#2f69b3] px-2 py-[5px] text-[0.72rem] hover:bg-[#255a9b]"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

        </section>
      </div>
    </DashboardLayout>
  );
}

export default Complaint;
