import { useState, useEffect, useRef } from 'react';
import { casesApi } from '../services/api';
import { RecoveryCase } from '../types';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/Spinner';
import { formatAmount, formatDate, getStatusColor } from '../utils/format';
import { useNavigate } from 'react-router-dom';

export function AIActivity() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const fetchCases = () => {
    casesApi
      .list({ limit: 20 })
      .then((res) => {
        const data = res.data.data ?? res.data;
        setCases(Array.isArray(data) ? data : data.cases ?? []);
        setLastRefreshed(new Date());
      })
      .catch(() => {/* silent */})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCases();
    intervalRef.current = setInterval(fetchCases, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const activeCases = cases.filter((c) => c.status === 'ANALYZING' || c.status === 'ACTION_PENDING');

  if (loading) return <LoadingState />;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Activity</h2>
          <p className="text-gray-500 text-sm mt-1">Real-time AI recovery operations</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          Auto-refreshing every 5s &nbsp;·&nbsp; Last: {lastRefreshed.toLocaleTimeString()}
        </div>
      </div>

      {/* Active cases */}
      {activeCases.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900">⚡ Active AI Operations ({activeCases.length})</h3>
          {activeCases.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-blue-100 cursor-pointer hover:border-blue-300 transition-colors"
              onClick={() => navigate(`/cases/${c.id}`)}
            >
              <div>
                <span className="font-mono text-sm font-medium text-gray-900">
                  RC-{c.id.substring(0, 8).toUpperCase()}
                </span>
                <span className="ml-3 text-sm text-gray-600">{c.customer?.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">{formatAmount(c.amountAtRisk)}</span>
                <Badge className={getStatusColor(c.status)}>{c.status.replace(/_/g, ' ')}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity feed */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity Feed</h3>
        <div className="space-y-2">
          {cases.map((c) => {
            const lastLog = c.auditLogs?.[c.auditLogs.length - 1];
            return (
              <div
                key={c.id}
                className="flex items-start gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => navigate(`/cases/${c.id}`)}
              >
                <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${c.status === 'RECOVERED' ? 'bg-green-500' : c.status === 'ANALYZING' ? 'bg-blue-500' : c.status === 'ACTION_PENDING' ? 'bg-amber-500' : c.status === 'ESCALATED' ? 'bg-red-500' : 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-medium text-gray-700">
                      RC-{c.id.substring(0, 8).toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-900">{c.customer?.name}</span>
                    <Badge className={`${getStatusColor(c.status)} text-xs`}>
                      {c.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {lastLog && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="font-medium">{lastLog.actorType}</span>: {lastLog.action}
                      {lastLog.reason && ` — ${lastLog.reason}`}
                    </p>
                  )}
                  {!lastLog && c.failureCategory && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.failureCategory.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-gray-900">{formatAmount(c.amountAtRisk)}</p>
                  <p className="text-xs text-gray-400">{formatDate(c.createdAt)}</p>
                </div>
              </div>
            );
          })}
          {cases.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
