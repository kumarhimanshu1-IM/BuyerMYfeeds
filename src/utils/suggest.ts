// Fetches product/service name suggestions from IndiaMART's suggester API as the
// user types. The exact response shape isn't confirmed from this environment
// (the sandbox this was built in can't reach suggest.imimg.com directly), so
// this parses defensively across the shapes such suggester endpoints commonly
// return: a bare array of strings, an array of objects with a label/value/text
// field, or a wrapper object like { suggestions: [...] }.
export async function fetchSuggestions(query: string, signal?: AbortSignal): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url =
    'https://suggest.imimg.com/suggest/suggester.php' +
    `?q=${encodeURIComponent(trimmed)}` +
    '&mcatid=0&catid=0&fields=type_data,sort_order&match=fuzzy' +
    '&display_fields=label&tag=suggestions&limit=40&type=product&v=412';

  const res = await fetch(url, { signal });
  if (!res.ok) return [];

  const raw = await res.text();
  if (!raw) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // Some suggester endpoints return JSONP, e.g. callback({...}) — try to
    // unwrap a single top-level function call before giving up.
    const match = raw.match(/^[a-zA-Z0-9_]+\((.*)\)\s*;?\s*$/s);
    if (match) {
      try {
        data = JSON.parse(match[1]);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  return extractLabels(data);
}

function extractLabels(data: unknown): string[] {
  if (!data) return [];

  // Bare array: ["Bolts", "Bolts and Nuts", ...] or [{label: "..."}]
  if (Array.isArray(data)) {
    return data.map(itemToLabel).filter((s): s is string => !!s);
  }

  // Wrapper object — try common keys the suggestion list might live under.
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['suggestions', 'data', 'results', 'items', 'products']) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).map(itemToLabel).filter((s): s is string => !!s);
      }
    }
  }

  return [];
}

function itemToLabel(item: unknown): string | null {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const candidate = obj.label ?? obj.value ?? obj.text ?? obj.name ?? obj.type_data;
    if (typeof candidate === 'string') return candidate;
  }
  return null;
}

// Resolves a city name to IndiaMART's location_id via the location suggester
// (response shape: { location: [{ value, label, data: { location_id, state, flname } }] }).
// Cached per name; returns null when the lookup fails so callers can fall back.
const cityIdCache = new Map<string, string>();
export async function fetchCityId(city: string, signal?: AbortSignal): Promise<string | null> {
  const name = city.trim();
  if (!name) return null;
  const key = name.toLowerCase();
  const cached = cityIdCache.get(key);
  if (cached) return cached;

  const url =
    'https://suggest.imimg.com/suggest/suggest.php' +
    `?q=${encodeURIComponent(name)}&tag=suggestions&limit=40&type=location` +
    '&fields=location_id,state%2Cid%2Cstateid%2Cflname%2Calias' +
    '&display_fields=value%2C%3Dstate&display_separator=%2C+&match=exact&catid=0&mcatid=0&v=412';

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = JSON.parse(await res.text()) as {
      location?: { value?: string; label?: string; data?: { location_id?: string | number } }[];
    };
    const list = data.location ?? [];
    const hit = list.find(l => (l.value ?? l.label ?? '').toLowerCase() === key) ?? list[0];
    const id = hit?.data?.location_id;
    if (id === undefined || id === null || id === '') return null;
    cityIdCache.set(key, String(id));
    return String(id);
  } catch {
    return null;
  }
}
