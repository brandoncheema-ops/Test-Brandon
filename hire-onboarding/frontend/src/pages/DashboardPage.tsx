import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { workflowApi } from '../services/api';
import { HiringWorkflow, WorkflowStatus, STATUS_LABELS } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage() {
  const [workflows, setWorkflows] = useState<HiringWorkflow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchData = async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;

      const [listRes, statsRes] = await Promise.all([
        workflowApi.list(params),
        workflowApi.getStats(),
      ]);
      setWorkflows(listRes.items as HiringWorkflow[]);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handlePollNow = async () => {
    setPolling(true);
    try {
      await workflowApi.pollNow();
      // Wait a moment then refresh
      setTimeout(fetchData, 3000);
    } catch (err) {
      console.error('Poll failed:', err);
    } finally {
      setPolling(false);
    }
  };

  const actionableCount =
    (stats[WorkflowStatus.NEEDS_MORE_INFO] || 0) +
    (stats[WorkflowStatus.READY_FOR_REVIEW] || 0) +
    (stats[WorkflowStatus.GENERATED] || 0) +
    (stats[WorkflowStatus.REVISION_REQUESTED] || 0) +
    (stats[WorkflowStatus.WAITING_FOR_SIGNATURE] || 0) +
    (stats[WorkflowStatus.SIGNED_MARKED] || 0);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Workflow Dashboard</h1>
        <button
          onClick={handlePollNow}
          disabled={polling}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {polling ? 'Polling...' : 'Poll Inbox Now'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Total Workflows</div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">
            {Object.values(stats).reduce((a, b) => a + b, 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Action Required</div>
          <div className="mt-1 text-3xl font-semibold text-orange-600">{actionableCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Awaiting Signature</div>
          <div className="mt-1 text-3xl font-semibold text-amber-600">
            {stats[WorkflowStatus.WAITING_FOR_SIGNATURE] || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-500">Completed</div>
          <div className="mt-1 text-3xl font-semibold text-green-600">
            {stats[WorkflowStatus.FILED_TO_SHAREPOINT] || 0}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All</option>
          {Object.values(WorkflowStatus).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Workflow List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Candidate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                From
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Received
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workflows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No workflows found. Forward a hiring email to the automation inbox to get started.
                </td>
              </tr>
            ) : (
              workflows.map((wf) => (
                <tr key={wf.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/workflows/${wf.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {wf.extractedFields?.fullLegalName?.value || wf.emailSubject.substring(0, 40)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{wf.emailFrom}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {wf.contractType?.replace(/_/g, ' ') || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={wf.status} />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {wf.overallExtractionConfidence !== null
                      ? `${(wf.overallExtractionConfidence * 100).toFixed(0)}%`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(wf.emailReceivedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
