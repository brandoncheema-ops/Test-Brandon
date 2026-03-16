import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workflowApi } from '../services/api';
import {
  HiringWorkflow,
  AuditLogEntry,
  WorkflowStatus,
  HiringFields,
  FIELD_LABELS,
  ConfidenceLevel,
} from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfidenceBadge from '../components/ConfidenceBadge';

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<HiringWorkflow | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string | null>>({});
  const [revisionNotes, setRevisionNotes] = useState('');
  const [missingInfoDraft, setMissingInfoDraft] = useState('');
  const [activeTab, setActiveTab] = useState<'fields' | 'email' | 'audit' | 'draft'>('fields');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  const fetchWorkflow = async () => {
    if (!id) return;
    try {
      const [wf, auditRes] = await Promise.all([
        workflowApi.get(id),
        workflowApi.getAudit(id),
      ]);
      setWorkflow(wf as HiringWorkflow);
      setAudit((auditRes as { items: AuditLogEntry[] }).items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setActionLoading(action);
    setError('');
    try {
      await fn();
      await fetchWorkflow();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveFields = () => {
    if (!id) return;
    handleAction('save', async () => {
      await workflowApi.updateFields(id, editedFields);
      setEditMode(false);
      setEditedFields({});
    });
  };

  const startEditing = () => {
    if (!workflow?.extractedFields) return;
    const current: Record<string, string | null> = {};
    for (const [key, field] of Object.entries(workflow.extractedFields)) {
      current[key] = (field as { value: string | null }).value;
    }
    setEditedFields(current);
    setEditMode(true);
  };

  const handleGetMissingInfoDraft = async () => {
    if (!id) return;
    handleAction('draft', async () => {
      const res = await workflowApi.getMissingInfoDraft(id);
      setMissingInfoDraft(res.draft);
      setActiveTab('draft');
    });
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading workflow...</div>;
  }

  if (!workflow) {
    return <div className="text-center py-12 text-red-500">Workflow not found</div>;
  }

  const fields = workflow.extractedFields;
  const status = workflow.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600">
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {fields?.fullLegalName?.value || 'New Hire Request'}
          </h1>
          <StatusBadge status={status} />
        </div>
        {workflow.contractType && (
          <span className="text-sm text-gray-500">
            {workflow.contractType.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Classification info */}
      {workflow.classificationResult && !workflow.classificationResult.isHireRequest && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
          <p className="text-sm font-medium text-yellow-800">
            This email was classified as NOT a hire request
          </p>
          <p className="text-sm text-yellow-700 mt-1">
            Reasoning: {workflow.classificationResult.reasoning}
          </p>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-2">
          {/* Edit fields */}
          {(status === WorkflowStatus.READY_FOR_REVIEW ||
            status === WorkflowStatus.NEEDS_MORE_INFO ||
            status === WorkflowStatus.CLASSIFIED) && (
            <>
              {!editMode && (
                <button
                  onClick={startEditing}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Edit Fields
                </button>
              )}
              {editMode && (
                <>
                  <button
                    onClick={handleSaveFields}
                    disabled={actionLoading === 'save'}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading === 'save' ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setEditedFields({}); }}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </>
              )}
            </>
          )}

          {/* Approve fields */}
          {(status === WorkflowStatus.READY_FOR_REVIEW || status === WorkflowStatus.NEEDS_MORE_INFO) && !editMode && (
            <button
              onClick={() => handleAction('approve-fields', () => workflowApi.approveFields(id!))}
              disabled={!!actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'approve-fields' ? 'Approving...' : 'Approve Fields & Generate'}
            </button>
          )}

          {/* Generate contract */}
          {status === WorkflowStatus.READY_TO_GENERATE && (
            <button
              onClick={() => handleAction('generate', () => workflowApi.generate(id!))}
              disabled={!!actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {actionLoading === 'generate' ? 'Generating...' : 'Generate Contract'}
            </button>
          )}

          {/* Approve contract */}
          {status === WorkflowStatus.GENERATED && (
            <>
              <button
                onClick={() => handleAction('approve-contract', () => workflowApi.approveContract(id!))}
                disabled={!!actionLoading}
                className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading === 'approve-contract' ? 'Approving...' : 'Approve Contract'}
              </button>
              <button
                onClick={() => {
                  const notes = prompt('Enter revision notes:');
                  if (notes) handleAction('revision', () => workflowApi.requestRevision(id!, notes));
                }}
                disabled={!!actionLoading}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                Request Revision
              </button>
            </>
          )}

          {/* Revision back to review */}
          {status === WorkflowStatus.REVISION_REQUESTED && (
            <button
              onClick={() => handleAction('back-review', () => workflowApi.backToReview(id!))}
              disabled={!!actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Back to Review
            </button>
          )}

          {/* Mark as signed */}
          {status === WorkflowStatus.WAITING_FOR_SIGNATURE && (
            <button
              onClick={() => handleAction('mark-signed', () => workflowApi.markSigned(id!))}
              disabled={!!actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'mark-signed' ? 'Marking...' : 'Mark as Signed'}
            </button>
          )}

          {/* File to SharePoint */}
          {status === WorkflowStatus.SIGNED_MARKED && (
            <button
              onClick={() => handleAction('file-sp', () => workflowApi.fileToSharePoint(id!))}
              disabled={!!actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {actionLoading === 'file-sp' ? 'Filing...' : 'File to SharePoint'}
            </button>
          )}

          {/* Missing info draft */}
          {status === WorkflowStatus.NEEDS_MORE_INFO && (
            <button
              onClick={handleGetMissingInfoDraft}
              disabled={!!actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:opacity-50"
            >
              {actionLoading === 'draft' ? 'Preparing...' : 'Prepare Missing Info Draft'}
            </button>
          )}
        </div>
      </div>

      {/* Revision notes */}
      {workflow.revisionNotes && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-md">
          <p className="text-sm font-medium text-red-800">Revision Notes:</p>
          <p className="text-sm text-red-700 mt-1">{workflow.revisionNotes}</p>
          <p className="text-xs text-red-500 mt-2">Revision #{workflow.revisionCount}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {(['fields', 'email', 'audit', 'draft'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'fields' ? 'Extracted Fields' : tab === 'email' ? 'Original Email' : tab === 'audit' ? 'Audit Log' : 'Missing Info Draft'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg shadow">
        {/* FIELDS TAB */}
        {activeTab === 'fields' && fields && (
          <div className="divide-y divide-gray-200">
            {(Object.entries(fields) as [keyof HiringFields, { value: string | null; confidence: ConfidenceLevel; source: string; rawExcerpt?: string }][]).map(
              ([key, field]) => (
                <div key={key} className="px-6 py-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">
                        {FIELD_LABELS[key]}
                      </span>
                      <ConfidenceBadge confidence={field.confidence} />
                      {field.source === 'edited' && (
                        <span className="text-xs text-blue-600">(edited)</span>
                      )}
                    </div>
                    {editMode ? (
                      <input
                        type="text"
                        value={editedFields[key] || ''}
                        onChange={(e) =>
                          setEditedFields({ ...editedFields, [key]: e.target.value || null })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder={`Enter ${FIELD_LABELS[key]}`}
                      />
                    ) : (
                      <p className="mt-1 text-sm text-gray-900">
                        {field.value || <span className="text-red-400 italic">Not extracted</span>}
                      </p>
                    )}
                    {field.rawExcerpt && !editMode && (
                      <p className="mt-1 text-xs text-gray-400 italic">
                        Source: "{field.rawExcerpt}"
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
            {workflow.overallExtractionConfidence !== null && (
              <div className="px-6 py-4 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">
                  Overall Extraction Confidence:{' '}
                  <span className="font-bold">
                    {(workflow.overallExtractionConfidence * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'fields' && !fields && (
          <div className="px-6 py-8 text-center text-gray-500">
            No extracted fields available yet.
          </div>
        )}

        {/* EMAIL TAB */}
        {activeTab === 'email' && (
          <div className="p-6 space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-500">From:</span>{' '}
              <span className="text-sm text-gray-900">{workflow.emailFrom}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Subject:</span>{' '}
              <span className="text-sm text-gray-900">{workflow.emailSubject}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Received:</span>{' '}
              <span className="text-sm text-gray-900">
                {new Date(workflow.emailReceivedAt).toLocaleString()}
              </span>
            </div>
            <hr />
            <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-md max-h-96 overflow-y-auto">
              {workflow.emailBody}
            </div>
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'audit' && (
          <div className="divide-y divide-gray-200">
            {audit.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No audit entries.</div>
            ) : (
              audit.map((entry) => (
                <div key={entry.id} className="px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        {entry.eventType}
                      </span>
                      <span className="text-sm text-gray-700">{entry.description}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(entry.createdAt).toLocaleString()} by {entry.actor}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* MISSING INFO DRAFT TAB */}
        {activeTab === 'draft' && (
          <div className="p-6">
            {missingInfoDraft || workflow.missingInfoDraft ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Copy this draft and send it via email to request missing information:
                </p>
                <textarea
                  value={missingInfoDraft || workflow.missingInfoDraft || ''}
                  readOnly
                  rows={10}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono bg-gray-50"
                />
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(
                      missingInfoDraft || workflow.missingInfoDraft || ''
                    )
                  }
                  className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Copy to Clipboard
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No missing info draft available. Click "Prepare Missing Info Draft" to generate one.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Workflow Info</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">ID:</span>{' '}
            <span className="font-mono text-xs">{workflow.id}</span>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>{' '}
            {new Date(workflow.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="text-gray-500">Updated:</span>{' '}
            {new Date(workflow.updatedAt).toLocaleString()}
          </div>
          <div>
            <span className="text-gray-500">Reminders sent:</span>{' '}
            {workflow.reminderInfo.reminderCount}
          </div>
          {workflow.generatedContractPath && (
            <div>
              <span className="text-gray-500">Contract file:</span>{' '}
              <span className="font-mono text-xs">{workflow.generatedContractPath}</span>
            </div>
          )}
          {workflow.sharepointFileUrl && (
            <div>
              <span className="text-gray-500">SharePoint:</span>{' '}
              <a
                href={workflow.sharepointFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View in SharePoint
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
