// =============================================================================
// API Client - Communicates with the backend
// =============================================================================

const API_BASE = '/hire-onboarding/api';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (response.status === 401) {
    // Redirect to login if unauthorized
    if (!window.location.pathname.endsWith('/login')) {
      window.location.href = '/hire-onboarding/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    request<{ success: boolean; username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<{ authenticated: boolean; username?: string }>('/auth/me'),
};

// Workflows
export const workflowApi = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: unknown[]; total: number }>(`/workflows${query}`);
  },
  get: (id: string) => request<unknown>(`/workflows/${id}`),
  getStats: () => request<Record<string, number>>('/workflows/stats'),
  getAudit: (id: string) =>
    request<{ items: unknown[]; total: number }>(`/workflows/${id}/audit`),
  updateFields: (id: string, fields: Record<string, string | null>) =>
    request(`/workflows/${id}/fields`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    }),
  approveFields: (id: string) =>
    request(`/workflows/${id}/approve-fields`, { method: 'POST' }),
  generate: (id: string) =>
    request(`/workflows/${id}/generate`, { method: 'POST' }),
  approveContract: (id: string) =>
    request(`/workflows/${id}/approve-contract`, { method: 'POST' }),
  requestRevision: (id: string, notes: string) =>
    request(`/workflows/${id}/request-revision`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  backToReview: (id: string) =>
    request(`/workflows/${id}/back-to-review`, { method: 'POST' }),
  markSigned: (id: string, signedContractPath?: string) =>
    request(`/workflows/${id}/mark-signed`, {
      method: 'POST',
      body: JSON.stringify({ signedContractPath }),
    }),
  fileToSharePoint: (id: string) =>
    request(`/workflows/${id}/file-to-sharepoint`, { method: 'POST' }),
  getMissingInfoDraft: (id: string) =>
    request<{ draft: string }>(`/workflows/${id}/missing-info-draft`, {
      method: 'POST',
    }),
  pollNow: () => request('/workflows/poll-now', { method: 'POST' }),
};
