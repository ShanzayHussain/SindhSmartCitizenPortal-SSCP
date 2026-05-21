import { useEffect, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

import AdminLayout from './AdminLayout';
import { apiFetch } from '../../lib/api';

const STATUS_STYLES = {
  Pending: { background: '#f59e0b', color: 'white' },
  'In Progress': { background: '#3b82f6', color: 'white' },
  Resolved: { background: '#14863e', color: 'white' },
  Closed: { background: '#dc2626', color: 'white' },
};

function getDepartmentTextStyle(department = '') {
  const normalized = department
    .toLowerCase()
    .replace(/[\s-]/g, '');

  if (normalized.includes('ssgc'))
    return {
      color: '#14863e',
      fontWeight: 700
    };

  if (
    normalized.includes('ke') ||
    normalized.includes('kelectric')
  )
    return {
      color: '#f97316',
      fontWeight: 700
    };

  if (
    normalized.includes('waterboard') ||
    normalized.includes('water')
  )
    return {
      color: '#2563eb',
      fontWeight: 700
    };

  return { color: '#374151' };
}

export default function AdminDashboard() {
  const [data, setData] = useState({
    stats: {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0
    },
    recentComplaints: [],
  });

  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/admin/dashboard')
      .then((res) => {
        if (!res.ok)
          throw new Error(
            'Failed to load admin dashboard.'
          );

        return res.json();
      })
      .then(setData)
      .catch((err) =>
        setError(err.message)
      );
  }, []);

  const cards = [
    {
      label: 'Total Complaints',
      value: data.stats.total,
      color: '#f97316'
    },
    {
      label: 'Pending',
      value: data.stats.pending,
      color: '#f59e0b'
    },
    {
      label: 'In Progress',
      value: data.stats.inProgress,
      color: '#3b82f6'
    },
    {
      label: 'Resolved',
      value: data.stats.resolved,
      color: '#14863e'
    },
    {
      label: 'Closed',
      value: data.stats.closed,
      color: '#dc2626'
    },
  ];

  const chartData = [
    {
      name: 'Pending',
      value: data.stats.pending,
      color:
        STATUS_STYLES.Pending.background
    },
    {
      name: 'In Progress',
      value: data.stats.inProgress,
      color:
        STATUS_STYLES[
          'In Progress'
        ].background
    },
    {
      name: 'Resolved',
      value: data.stats.resolved,
      color:
        STATUS_STYLES.Resolved.background
    },
    {
      name: 'Closed',
      value: data.stats.closed,
      color:
        STATUS_STYLES.Closed.background
    },
  ];

  return (
    <AdminLayout>
      <div
        style={{
          fontFamily:
            "'Segoe UI', sans-serif",
          color: '#1f2937'
        }}
      >
        <h1
          style={{
            color: '#1b3a57',
            margin: 0,
            fontSize: '1.6rem',
            fontWeight: 800
          }}
        >
          Admin Dashboard
        </h1>

        {error ? (
          <p
            style={{
              color: '#b91c1c',
              marginBottom: '12px'
            }}
          >
            {error}
          </p>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(5,1fr)',
            gap: '12px',
            marginBottom: '18px'
          }}
        >
          {cards.map((card) => (
            <div
              key={card.label}
              style={{
                background:
                  card.color,
                color: 'white',
                borderRadius:
                  '12px',
                padding:
                  '14px 16px'
              }}
            >
              <div
                style={{
                  fontSize:
                    '0.8rem',
                  opacity: 0.9
                }}
              >
                {card.label}
              </div>

              <div
                style={{
                  fontSize:
                    '1.6rem',
                  fontWeight: 800
                }}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0,1.45fr) minmax(300px,0.55fr)',
            gap: '18px'
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius:
                '14px',
              padding: '20px',
              boxShadow:
                '0 2px 10px rgba(0,0,0,0.07)'
            }}
          >
            <h2
              style={{
                marginTop: 0,
                color: '#1b3a57'
              }}
            >
              Recent Complaints
            </h2>

            <table
              style={{
                width: '100%',
                borderCollapse:
                  'collapse',
                fontSize:
                  '0.88rem'
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      '#f9fafb'
                  }}
                >
                  {[
                    'ID',
                    'Title',
                    'Citizen',
                    'Department',
                    'Status',
                    'Date'
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign:
                          'left',
                        padding:
                          '10px 12px'
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.recentComplaints.map(
                  (c) => (
                    <tr
                      key={
                        c.complaint_id
                      }
                      style={{
                        borderBottom:
                          '1px solid #f3f4f6'
                      }}
                    >
                      <td style={{padding:'10px 12px'}}>
                        {c.complaint_id}
                      </td>

                      <td style={{padding:'10px 12px'}}>
                        {c.title}
                      </td>

                      <td style={{padding:'10px 12px'}}>
                        {c.citizen_name}
                      </td>

                      <td
                        style={{
                          padding:'10px 12px',
                          ...getDepartmentTextStyle(
                            c.department
                          )
                        }}
                      >
                        {c.department}
                      </td>

                      <td style={{padding:'10px 12px'}}>
                        <span
                          style={{
                            ...(STATUS_STYLES[
                              c.status
                            ] || {
                              background:
                                '#64748b',
                              color:
                                'white'
                            }),
                            display:
                              'inline-block',
                            minWidth:
                              '86px',
                            textAlign:
                              'center',
                            borderRadius:
                              '999px',
                            padding:
                              '4px 10px',
                            fontSize:
                              '0.78rem',
                            fontWeight:700
                          }}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td style={{padding:'10px 12px'}}>
                        {c.date_filed}
                      </td>
                    </tr>
                  )
                )}

                {data.recentComplaints
                  .length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding:
                          '12px',
                        textAlign:
                          'center',
                        color:
                          '#6b7280'
                      }}
                    >
                      No complaints found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              background:'white',
              borderRadius:'14px',
              padding:'20px',
              boxShadow:
                '0 2px 10px rgba(0,0,0,0.07)'
            }}
          >
            <h2
              style={{
                marginTop:0,
                color:'#1b3a57'
              }}
            >
              Status Breakdown
            </h2>

            <ResponsiveContainer
              width="100%"
              height={260}
            >
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={3}
                >
                  {chartData.map(
                    (entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.color
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}