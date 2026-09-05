import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { casesApi } from '../services/api';
import { RecoveryCase } from '../types';
import { LoadingState } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatAmount, formatDate, getStatusColor, getScoreBgColor } from '../utils/format';

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<RecoveryCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const fetchCase = useCallback(() => {
    if (!id) return;
    casesApi
      .get(id)
      .then((res) => {
        setCaseData(res.data.data ?? res.data);
      })
      .catch(() => setError('Failed to load case details.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleAnalyze = () => {
    if (!id) return;
    setActionLoading(true);
    casesApi
      .analyze(id)
      .then(() => {
        setTimeout(() => {
          fetchCase();
          setActionLoading(false);
        }, 2000);
      })
      .catch(() => {
        setError('Analysis failed.');
        setActionLoading(false);
      });
  };

  const handleApprove = () => {
    if (!id) return;
    setActionLoading(true);
    casesApi
      .approve(id)
      .then(() => {
        fetchCase();
        setShowLinkModal(true);
      })
      .catch((err: any) =>
        setError(err?.response?.data?.error || 'Approval failed.')
      )
      .finally(() => setActionLoading(false));
  };

  const handleReject = () => {
    if (!id) return;
    setActionLoading(true);
    casesApi
      .reject(id, rejectReason || undefined)
      .then(() => {
        fetchCase();
        setShowRejectInput(false);
      })
      .catch(() => setError('Rejection failed.'))
      .finally(() => setActionLoading(false));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <LoadingState />;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!caseData) return null;

  const shortId = `RC-${caseData.id.substring(0, 8).toUpperCase()}`;
  const paymentLink = caseData.paymentLinks?.[0];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/cases" className="text-sm text-blue-600 hover:underline mb-2 block">
            ← Back to Cases
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{shortId}</h2>
            <Badge className={getStatusColor(caseData.status)}>
              {caseData.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Amount at risk: <span className="font-semibold text-gray-900">{formatAmount(caseData.amountAtRisk)}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer & Payment Info */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Customer Details</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="font-medium text-gray-900">{caseData.customer?.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-gray-700">{caseData.customer?.email}</p>
            </div>
            {caseData.customer?.phone && (
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-gray-700">{caseData.customer.phone}</p>
              </div>
            )}
            {caseData.payment && (
              <>
                <hr className="border-gray-100" />
                <div>
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="text-gray-700">{caseData.payment.method}</p>
                </div>
                {caseData.payment.errorDescription && (
                  <div>
                    <p className="text-xs text-gray-500">Failure Reason</p>
                    <p className="text-red-600 text-sm">{caseData.payment.errorDescription}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Payment Date</p>
                  <p className="text-gray-700 text-sm">{formatDate(caseData.payment.createdAt)}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* AI Diagnosis */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">AI Diagnosis</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseData.failureCategory && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Failure Category</p>
                <Badge className="bg-gray-100 text-gray-700">
                  {caseData.failureCategory.replace(/_/g, ' ')}
                </Badge>
              </div>
            )}
            {caseData.recoverabilityScore != null && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Recoverability Score</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${getScoreBgColor(caseData.recoverabilityScore)}`}>
                    {caseData.recoverabilityScore}/100
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${caseData.recoverabilityScore >= 70 ? 'bg-green-500' : caseData.recoverabilityScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${caseData.recoverabilityScore}%` }}
                  />
                </div>
              </div>
            )}
            {caseData.aiConfidence != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">AI Confidence</span>
                <span className="font-medium text-gray-900">{(caseData.aiConfidence * 100).toFixed(0)}%</span>
              </div>
            )}
            {caseData.aiReason && caseData.aiReason.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">AI Analysis</p>
                <ul className="space-y-1">
                  {caseData.aiReason.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Why This Action */}
      {(caseData.recommendedAction || (caseData.aiReason && caseData.aiReason.length > 0)) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
              WHY DID RECOVERAI RECOMMEND THIS?
            </h3>
            {caseData.recommendedAction && (
              <div>
                <p className="text-xs text-blue-700 font-medium">Recommended Action</p>
                <p className="text-blue-900 font-semibold">{caseData.recommendedAction.replace(/_/g, ' ')}</p>
              </div>
            )}
            {caseData.aiReason && caseData.aiReason.length > 0 && (
              <div>
                <p className="text-xs text-blue-700 font-medium mb-2">Evidence</p>
                <ul className="space-y-1">
                  {caseData.aiReason.map((r, i) => (
                    <li key={i} className="text-sm text-blue-800 flex gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-xs text-blue-700 border-t border-blue-200 pt-3 space-y-1">
              <p>
                <span className="font-medium">Stopping Rules:</span> Maximum {caseData.maxAttempts} automated recovery attempts.
              </p>
              <p>Recovery window: 72 hours from failure.</p>
              {caseData.deadline && (
                <p>Deadline: {formatDate(caseData.deadline)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Actions</h3>
        </CardHeader>
        <CardContent>
          {caseData.status === 'OPEN' && (
            <div className="flex gap-3">
              <Button
                onClick={handleAnalyze}
                loading={actionLoading}
              >
                {actionLoading ? 'Analyzing...' : '🤖 Analyze with AI'}
              </Button>
            </div>
          )}

          {caseData.status === 'ACTION_PENDING' && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button onClick={handleApprove} loading={actionLoading}>
                  ✅ Approve &amp; Execute
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowRejectInput((v) => !v)}
                >
                  ✕ Reject
                </Button>
              </div>
              {showRejectInput && (
                <div className="flex gap-3 items-start">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <Button variant="danger" size="sm" onClick={handleReject} loading={actionLoading}>
                    Confirm Reject
                  </Button>
                </div>
              )}
            </div>
          )}

          {caseData.status === 'RECOVERED' && (
            <div className="flex items-center gap-3 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-semibold">Payment Recovered!</p>
                {paymentLink && (
                  <p className="text-sm">
                    Payment link:{' '}
                    <a
                      href={paymentLink.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-green-800"
                    >
                      {paymentLink.shortUrl}
                    </a>
                  </p>
                )}
                {caseData.recoveredAt && (
                  <p className="text-xs text-green-600 mt-1">Recovered at: {formatDate(caseData.recoveredAt)}</p>
                )}
              </div>
            </div>
          )}

          {(caseData.status === 'ANALYZING') && (
            <p className="text-blue-600 text-sm flex items-center gap-2">
              <span className="animate-spin inline-block">⏳</span> AI is analyzing this case…
            </p>
          )}

          {(caseData.status === 'ESCALATED') && (
            <p className="text-red-600 text-sm">⚠️ This case has been escalated for manual review.</p>
          )}

          {(caseData.status === 'EXPIRED') && (
            <p className="text-gray-500 text-sm">This case has expired. No further recovery actions can be taken.</p>
          )}
        </CardContent>
      </Card>

      {/* Audit Trail */}
      {caseData.auditLogs && caseData.auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Audit Trail</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.auditLogs.map((log) => (
                <div key={log.id} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className={`h-2 w-2 rounded-full mt-1.5 ${log.actorType === 'AI' ? 'bg-blue-500' : log.actorType === 'MERCHANT' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div className="w-px flex-1 bg-gray-200 mt-1" />
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${log.actorType === 'AI' ? 'bg-blue-100 text-blue-700' : log.actorType === 'MERCHANT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {log.actorType}
                      </span>
                      <span className="font-medium text-gray-900">{log.action}</span>
                      <span className="text-gray-400 text-xs">{formatDate(log.createdAt)}</span>
                    </div>
                    {log.reason && <p className="text-gray-500 mt-0.5">{log.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Link Modal */}
      <Modal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)} title="Action Approved">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">The recovery action has been approved and executed.</p>
          {paymentLink && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Payment Link</p>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-blue-600 text-sm flex-1 truncate">{paymentLink.shortUrl}</span>
                <button
                  onClick={() => handleCopy(paymentLink.shortUrl)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          <Button className="w-full" onClick={() => setShowLinkModal(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}
