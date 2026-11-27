// Windmill curated-seller-search flow: submit a job with the buyer's
// keyword/mcat/city/quantity/specs, then poll for the ranked seller list.
export interface SpecAnswer {
  question: string;
  answer: string;
}

export interface CuratedSearchPayload {
  offer_id: string;
  keyword: string;
  mcat_id: string;
  mcat_name: string;
  buyer_city_id: string;
  buyer_city: string;
  city_id: string;
  city_match: string;
  quantity: string;
  quantity_unit: string;
  specifications: SpecAnswer[];
}

export interface CuratedSeller {
  pns?: string;
  city?: string;
  rank?: number;
  image?: string;
  title?: string;
  cityid?: string | number | null;
  rating?: number | null;
  dist_km?: number;
  glusrid?: string;
  paidurl?: string;
  sources?: string[];
  paid_url?: string;
  seller_id?: string;
  title_url?: string;
  trustseal?: boolean;
  CustTypeWt?: number | string;
  base_score?: number;
  city_match?: boolean;
  final_rank?: number;
  companyname?: string;
  final_score?: number;
  memberSince?: string | null;
  boost_reason?: string;
  gst_verified?: string | boolean;
  rating_count?: number | string | null;
  custtype_name?: string;
  is_local_mcat?: boolean;
  product_match?: number;
  rank_position?: number;
  specs_matched?: number;
  vintage_years?: number;
  original_title?: string;
  gstVerifiedFlag?: string;
  price_formatted?: string;
  supplier_rating?: number | null;
  member_since_str?: string | null;
  pns_success_ratio?: number;
  pns_success_rate?: number;
  p2_breakdown?: { bl_mcat_6m?: number; bl_city?: number; productcount?: number; bl_mcat_city_6m?: number; [key: string]: unknown };
  // Other products this seller lists in the buyer's category (excluding or including the
  // primary one) — field names are the expected shape; confirm against the windmill output.
  products?: CuratedSellerProduct[];
  // Products the seller lists, grouped by MCAT (the buyer's MCAT plus related ones)
  mcat_products?: CuratedMcatProducts[];
  // Buyers from the buyer's own city served in the last 6 months, if sent top-level
  bl_mcat_city_6m?: number | string;
}

// Real shape of the pipeline's per-MCAT product lists (final_ranked_sellers[].mcat_products)
export interface CuratedMcatProduct {
  name?: string;
  image?: string;
  fob_price?: string | number;
  fob_price_unit?: string;
  title_url?: string;
  display_id?: string;
  specifications?: Record<string, string>;
}

export interface CuratedMcatProducts {
  mcat_id?: string | number;
  products?: CuratedMcatProduct[];
}

export interface CuratedSellerProduct {
  title?: string;
  image?: string;
  price_formatted?: string;
}

const CREATE_JOB_URL =
  'https://buyer.indiamart.com/miscreact/ajaxrequest/buyermy/curatedsellersearch/windmill';
const JOB_STATUS_URL =
  'https://buyer.indiamart.com/miscreact/ajaxrequest/buyermy/curatedsellersearch/windmill/status';

// ── Experiment pipeline (?pipeline=exp) ─────────────────────────────────────
// Calls the Windmill experiment script directly instead of the IndiaMART proxy.
// The bearer token is never in the code: it is asked for once and kept in this
// browser's localStorage (key "wm_token").
const WM_BASE = 'https://windmill-prod.intermesh.net/api/w/production';
const WM_EXP_SCRIPT = 'f/curated_sellers_script_exp/curated_sellers_pipeline';

function useExperimentPipeline(): boolean {
  try {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pipeline') === 'exp';
  } catch {
    return false;
  }
}

function getWindmillToken(): string | null {
  try {
    let token = window.localStorage.getItem('wm_token');
    if (!token) {
      token = window.prompt('Windmill token for the experiment pipeline (stored only in this browser):')?.trim() || null;
      if (token) window.localStorage.setItem('wm_token', token);
    }
    return token;
  } catch {
    return null;
  }
}

// Maps the proxy-style payload to the pipeline's own inputs (same shape the proxy
// produces: spec answers in isq + parallel arrays, quantity inside isq).
function toWindmillArgs(p: CuratedSearchPayload) {
  const isq: Record<string, string> = {};
  for (const sp of p.specifications) isq[sp.question] = sp.answer;
  if (p.quantity) isq['Quantity'] = p.quantity;
  if (p.quantity_unit) isq['Quantity Unit'] = p.quantity_unit;
  return {
    nodeflag: '',
    ak: '',
    debugger: false,
    buyer_id: '',
    offer_id: p.offer_id,
    mcat_id: p.mcat_id,
    mcat_name: p.mcat_name,
    query: p.keyword,
    city_id: p.city_id,
    cityname: p.buyer_city,
    isq,
    spec_question: p.specifications.map(sp => sp.question),
    spec_answer: p.specifications.map(sp => sp.answer),
    search_params: {
      query: p.keyword,
      max_price: '',
      min_price: '',
      categoryid: '',
      price_unit: '',
      mcategoryid: p.mcat_id,
    },
    buyer_context: {
      source: 'BuyerMY',
      city_id: p.city_id,
      city_data: p.buyer_city,
      city_match: p.city_match || 'exact',
      lang_explicit: 'en',
      for_country_data: 'IN',
      for_country_type: 'India',
      geo_country_code: 'IN',
      geo_country_name: 'India',
    },
  };
}

function extractJobId(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.job_id ?? obj.jobId ?? obj.job ?? obj.id ?? obj.data;
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object') return extractJobId(candidate);
  }
  return null;
}

export async function createCuratedSearchJob(
  payload: CuratedSearchPayload,
  signal?: AbortSignal
): Promise<string | null> {
  if (useExperimentPipeline()) {
    const token = getWindmillToken();
    if (!token) return null;
    const args = toWindmillArgs(payload);
    console.info('[exp pipeline] create job', args);
    const r = await fetch(`${WM_BASE}/jobs/run/p/${WM_EXP_SCRIPT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(args),
      signal,
    });
    if (!r.ok) {
      console.error('[exp pipeline] create failed', r.status, await r.text());
      return null;
    }
    const id = (await r.text()).trim().replace(/^"|"$/g, '');
    console.info('[exp pipeline] job id', id);
    return id || null;
  }

  const res = await fetch(CREATE_JOB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) return null;

  const raw = await res.text();
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    return extractJobId(data);
  } catch {
    return null;
  }
}

export type JobStatusResult =
  | { status: 'pending' }
  | { status: 'done'; sellers: CuratedSeller[] }
  | { status: 'error' };

function extractSellerList(raw: unknown): CuratedSeller[] | null {
  if (Array.isArray(raw)) return raw as CuratedSeller[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // Observed real shape: { completed, success, result: { final_ranked_sellers: [...] } }
    for (const key of [
      'final_ranked_sellers',
      'ranked_sellers',
      'data',
      'result',
      'results',
      'sellers',
      'cards',
      'items',
    ]) {
      const val = obj[key];
      if (Array.isArray(val)) return val as CuratedSeller[];
      // The seller list can be nested one or more levels deeper, e.g.
      // obj.result.final_ranked_sellers.
      if (val && typeof val === 'object') {
        const nested = extractSellerList(val);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function extractStatusFlag(raw: unknown): string | null {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // Explicit "success": false is a definite failure signal.
    if (obj.success === false) return 'error';
    const status = obj.status ?? obj.job_status ?? obj.state;
    if (typeof status === 'string') return status.toLowerCase();
  }
  return null;
}

export async function fetchCuratedSearchStatus(
  jobId: string,
  signal?: AbortSignal
): Promise<JobStatusResult> {
  let res: Response;
  if (useExperimentPipeline()) {
    const token = getWindmillToken();
    if (!token) return { status: 'error' };
    res = await fetch(`${WM_BASE}/jobs_u/completed/get_result_maybe/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (res.status === 404) return { status: 'pending' }; // not finished yet
  } else {
    res = await fetch(JOB_STATUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
      signal,
    });
  }
  if (!res.ok) return { status: 'error' };

  const raw = await res.text();
  if (!raw) return { status: 'pending' };

  try {
    const data = JSON.parse(raw);
    const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

    // "completed": true is the authoritative signal to stop polling —
    // use whatever seller data came back (even an empty list) at that point.
    if (obj.completed === true) {
      if (obj.success === false) {
        console.error('[curated search] job failed', obj.result);
        return { status: 'error' };
      }
      return { status: 'done', sellers: extractSellerList(data) ?? [] };
    }

    const sellers = extractSellerList(data);
    if (sellers && sellers.length > 0) return { status: 'done', sellers };

    const flag = extractStatusFlag(data);
    if (flag && ['failed', 'error', 'cancelled'].includes(flag)) return { status: 'error' };

    // Empty/ambiguous response — treat as "still processing" and let the
    // caller poll again, up to its own retry budget.
    return { status: 'pending' };
  } catch {
    return { status: 'error' };
  }
}
