import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '../services/api';
import { DashboardSummary } from '../types';
import { LoadingState } from '../components/ui/Spinner';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { formatAmount } from '../utils/format';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

interface BreakdownItem {
  category: string;
  count: number;
}

export function Analytics() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([dashboardApi.getSummary(), dashboardApi.getFailureBreakdown()])
      .then(([summaryRes, breakdownRes]) => {
        setSummary(summaryRes.data.data ?? summaryRes.data);
        setBreakdown(breakdownRes.data.data ?? breakdownRes.data ?? []);
      })
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!summary) return null;

  const recoveryRate = (summary.recoveryRate * 100).toFixed(1);
  const total = summary.failedPayments || 1;
  const recoveredPct = Math.round((summary.successfulRecoveries / total) * 100);
  const escalationRate = ((summary.escalatedCases / total) * 100).toFixed(1);

  const statusCounts = [
    { label: 'Open', value: summary.openCases, color: 'bg-gray-400' },
    { label: 'Analyzing', value: summary.analyzingCases, color: 'bg-blue-500' },
    { label: 'Action Pending', value: summary.actionPendingCases, color: 'bg-amber-500' },
    { label: 'Actioned', value: summary.actionedCases, color: 'bg-purple-500' },
    { label: 'Recovered', value: summary.successfulRecoveries, color: 'bg-green-500' },
    { label: 'Escalated', value: summary.escalatedCases, color: 'bg-red-500' },
  ];

  const barData = breakdown.map((b, i) => ({
    name: b.category.replace(/_/g, ' '),
    count: b.count,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="text-gray-500 text-sm mt-1">Recovery performance metrics</p>
      </div>

      {/* Revenue bar */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Revenue Recovery Progress</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Revenue at Risk</span>
            <span className="font-semibold text-gray-900">{formatAmount(summary.revenueAtRisk)}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-6 relative overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.min(recoveredPct, 100)}%` }}
            >
              {recoveredPct > 10 && (
                <span className="text-white text-xs font-medium">{recoveredPct}%</span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-600 font-medium">Recovered: {formatAmount(summary.recoveredRevenue)}</span>
            <span className="text-gray-500">
              Remaining: {formatAmount(summary.revenueAtRisk - summary.recoveredRevenue)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs text-gray-500">Recovery Rate</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{recoveryRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-gray-500">Payment Links Generated</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{summary.paymentLinksGenerated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-gray-500">Total Failed Payments</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.failedPayments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-gray-500">Escalation Rate</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{escalationRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Status counts */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Cases by Status</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {statusCounts.map((s) => (
              <div key={s.label} className="text-center">
                <div className={`h-1 rounded-full ${s.color} mb-2`} />
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Failure category bar chart */}
      {barData.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Failures by Category</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Cases">
                  {barData.map((entry, index) => (
                    <rect key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
