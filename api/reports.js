import { timingSafeEqual } from 'node:crypto';

const memberReasons = new Set(['false-account', 'bullying', 'eligibility', 'wrong-space', 'other']);
const problemReasons = new Set(['bug', 'account', 'accessibility', 'content', 'other']);
const reportStatuses = new Set(['new', 'reviewing', 'resolved']);

function jsonResponse(body, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
    }
  });
}

function hasValidAdminToken(request) {
  const configuredToken = process.env.LEI_REPORTS_ADMIN_TOKEN;
  const authorization = request.headers.get('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!configuredToken || !suppliedToken) return false;

  const expected = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function hasStorageConfiguration() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(query, options = {}) {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
  return fetch(`${baseUrl}/rest/v1/lei_reports?${query}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

function validContact(contact) {
  return typeof contact === 'string' && contact.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
}

function validPageUrl(pageUrl) {
  if (pageUrl === undefined || pageUrl === '') return true;
  if (typeof pageUrl !== 'string' || pageUrl.length > 2048) return false;
  try {
    return ['http:', 'https:'].includes(new URL(pageUrl).protocol);
  } catch {
    return false;
  }
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return jsonResponse({}, 204);
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return jsonResponse({ error: 'Method not allowed.' }, 405);

  if (request.method !== 'POST') {
    if (!process.env.LEI_REPORTS_ADMIN_TOKEN) return jsonResponse({ error: 'Report review is not configured.' }, 503);
    if (!hasValidAdminToken(request)) return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  if (!hasStorageConfiguration()) return jsonResponse({ error: 'Report storage is not configured.' }, 503);

  try {
    if (request.method === 'POST') {
      const input = await request.json();
      const isMemberReport = input.reportType === 'member';
      const validReason = isMemberReport ? memberReasons.has(input.reason) : input.reportType === 'problem' && problemReasons.has(input.reason);
      const username = isMemberReport && typeof input.username === 'string' ? input.username.trim() : null;
      const details = typeof input.details === 'string' ? input.details.trim() : '';

      if (!validReason || details.length < 5 || details.length > 2000 || !validContact(input.contact) || !validPageUrl(input.pageUrl)) {
        return jsonResponse({ error: 'Check the report details and try again.' }, 400);
      }
      if (isMemberReport && (!username || username.length > 100)) {
        return jsonResponse({ error: 'Enter the reported member username.' }, 400);
      }

      const report = {
        report_type: input.reportType,
        username,
        reason: input.reason,
        details,
        contact: input.contact.trim(),
        page_url: typeof input.pageUrl === 'string' ? input.pageUrl : null
      };
      const response = await supabaseRequest('select=id,created_at', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(report)
      });
      if (!response.ok) return jsonResponse({ error: 'Unable to save the report right now.' }, 502);
      const [savedReport] = await response.json();
      return jsonResponse({ reportId: savedReport.id, createdAt: savedReport.created_at }, 201);
    }

    if (request.method === 'GET') {
      const requestedLimit = Number.parseInt(new URL(request.url).searchParams.get('limit') || '50', 10);
      const requestedOffset = Number.parseInt(new URL(request.url).searchParams.get('offset') || '0', 10);
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
      const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
      const columns = 'id,report_type,username,reason,details,contact,page_url,status,created_at';
      const response = await supabaseRequest(`select=${columns}&order=created_at.desc&limit=${limit}&offset=${offset}`);
      if (!response.ok) return jsonResponse({ error: 'Unable to load reports right now.' }, 502);
      const reports = await response.json();
      return jsonResponse({ reports, hasMore: reports.length === limit, nextOffset: offset + reports.length });
    }

    const input = await request.json();
    if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id) || !reportStatuses.has(input.status)) {
      return jsonResponse({ error: 'Choose a valid report and status.' }, 400);
    }
    const response = await supabaseRequest(`id=eq.${encodeURIComponent(input.id)}&select=id,status`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: input.status })
    });
    if (!response.ok) return jsonResponse({ error: 'Unable to update the report right now.' }, 502);
    const [updatedReport] = await response.json();
    if (!updatedReport) return jsonResponse({ error: 'Report not found.' }, 404);
    return jsonResponse({ report: updatedReport });
  } catch {
    return jsonResponse({ error: 'Unable to process the report request.' }, 500);
  }
}