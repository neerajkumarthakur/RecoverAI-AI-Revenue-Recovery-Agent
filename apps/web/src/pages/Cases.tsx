import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesApi } from '../services/api';
import { RecoveryCase } from '../types';
import { LoadingState } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatAmount, formatDate, getStatusColor, getScoreColor } from '../utils/format';

const TABS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Action Pending', value: 'ACTION_PENDING' },
  { label: 'Actioned', value: 'ACTIONED' },
  { label: 'Recovered', value: 'RECOVERED' },
  { label: 'Escalated', value: 'ESCALATED' },
  { label: 'Expired', value: 'EXPIRED' },
];

export function Cases() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    casesApi
      .list({ status: activeTab || undefined, page, limit: LIMIT })
      .then((res) => {
        const data = res.data.data ?? res.data;
        setCases(Array.isArray(data) ? data : data.cases ?? []);
        setTotal(res.data.total ?? res.data.pagination?.total ?? 0);
      })
      .catch(() => setError('Failed to load recovery cases.'))
      .finally(() => setLoading(false));
  }, [activeTab, page]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recovery Cases</h2>
        <p className="text-gray-500 text-sm mt-1">All failed payment recovery cases</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : cases.length === 0 ? (
        <EmptyState title="No cases found" description="There are no recovery cases matching the current filter." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Failure Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.customer?.name ?? '—'}</div>
                      <div className="text-gray-400 text-xs">{c.customer?.email ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatAmount(c.amountAtRisk)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.failureCategory ? c.failureCategory.replace(/_/g, ' ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.recoverabilityScore != null ? (
                        <span className={`font-semibold ${getScoreColor(c.recoverabilityScore)}`}>
                          {c.recoverabilityScore}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/cases/${c.id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
