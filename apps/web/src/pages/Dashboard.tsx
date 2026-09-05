import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { dashboardApi } from '../services/api';
import { DashboardSummary } from '../types';
import { LoadingState } from '../components/ui/Spinner';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { formatAmount, formatDateShort } from '../utils/format';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

interface TrendPoint {
  date: string;
  attempted: number;
  recovered: number;
}

interface BreakdownItem {
  category: string;
  count: number;
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      dashboardApi.getSummary(),
      dashboardApi.getRecoveryTrends(),
      dashboardApi.getFailureBreakdown(),
    ])
      .then(([summaryRes, trendsRes, breakdownRes]) => {
        setSummary(summaryRes.data.data ?? summaryRes.data);
        setTrends(trendsRes.data.data ?? trendsRes.data ?? []);
        setBreakdown(breakdownRes.data.data ?? breakdownRes.data ?? []);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!summary) return null;

  const primaryStats = [
    { label: 'Revenue at Risk', value: formatAmount(summary.revenueAtRisk), icon: '⚠️', color: 'text-amber-600' },
    { label: 'Recovered Revenue', value: formatAmount(summary.recoveredRevenue), icon: '✅', color: 'text-green-600' },
    { label: 'Recovery Rate', value: `${(summary.recoveryRate * 100).toFixed(1)}%`, icon: '📈', color: 'text-blue-600' },
    { label: 'Open Cases', value: summary.openCases.toString(), icon: '📂', color: 'text-gray-700' },
  ];

  const secondaryStats = [
    { label: 'Failed Payments', value: summary.failedPayments },
    { label: 'Payment Links', value: summary.paymentLinksGenerated },
    { label: 'Successful Recoveries', value: summary.successfulRecoveries },
    { label: 'Escalated Cases', value: summary.escalatedCases },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">AI-powered revenue recovery overview</p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4">
              <span className="text-3xl">{stat.icon}</span>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recovery Trend */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Recovery Trend (30 days)</h3>
          </CardHeader>
          <CardContent>
            {trends.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No trend data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => formatDateShort(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'recovered' ? formatAmount(Number(value)) : value,
                      name === 'recovered' ? 'Recovered' : 'Attempted',
                    ]}
                    labelFormatter={(label) => formatDateShort(String(label))}
                  />
                  <Line type="monotone" dataKey="attempted" stroke="#3b82f6" strokeWidth={2} dot={false} name="attempted" />
                  <Line type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={2} dot={false} name="recovered" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Failure Breakdown */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Failure Category Breakdown</h3>
          </CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No breakdown data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={breakdown}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${(name ?? '').replace(/_/g, ' ')} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {breakdown.map((_entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend formatter={(value: string) => value.replace(/_/g, ' ')} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
