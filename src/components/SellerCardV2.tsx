import { useState } from 'react';
import { MapPin, Star, ShieldCheck, Check, X, Minus, Phone, CalendarDays, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SellerCard, SellerProduct } from './SearchModal';

// Variant of the final-result seller card (enabled with ?card=v2). Centred, three tiers, no inner
// divider lines (tiers are told apart by spacing and one light fill on the catalog):
//   1. Seller introduction + facts (name -> paid URL, city, rating, vintage, TrustSEAL)
//   2. Catalog glimpse: product image (with ‹ 1/10 › pager) on the left; name, how the product
//      matches the buyer's requirement, specs and price on the right. All follow the active product.
//   3. Why connect (buyers served in 6 months / in <city>, payment protection)
//   CTAs (Best Price, Call Now) side by side
interface SellerCardV2Props {
  seller: SellerCard;
  ribbon?: string;
  ribbonTone?: 'amber' | 'teal' | 'slate';
  // Short mobile layout: name, facts, one product row, one buyers line, CTAs
  compact?: boolean;
}

// Same rule as the original card's highlight line (hidden under 5 buyers), but shows the actual count.
function formatBuyersServed(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.match(/^(\d+) buyers served in 6m$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n < 5 ? null : `${n} buyers served in 6 months`;
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

type SpecStatus = 'match' | 'diff' | 'missing' | 'other';
interface SpecRow { key: string; value: string; status: SpecStatus; want?: string; }
interface SpecView { rows: SpecRow[]; matched: number; total: number; }

// Compares the product's specs with what the buyer asked for:
//   match   - product has the spec and its value covers the buyer's answer
//   diff    - product has the spec with a different value
//   missing - product doesn't list the spec
// Buyer-requested specs come first (matches, then differences, then missing), then the rest.
function buildSpecView(specs: Record<string, string> | undefined, buyer: { question: string; answer: string }[] | undefined): SpecView {
  const entries = Object.entries(specs ?? {});
  const used = new Set<string>();
  const req: SpecRow[] = [];
  const valueCovers = (value: string, answer: string) => {
    const na = norm(answer);
    return value.split(';').some(tok => { const nt = norm(tok); return !!nt && !!na && (nt === na || na.includes(nt) || nt.includes(na)); });
  };
  for (const b of buyer ?? []) {
    const nq = norm(b.question);
    const byKey = entries.find(([k]) => { const nk = norm(k); return !used.has(k) && !!nq && !!nk && (nq === nk || nq.includes(nk) || nk.includes(nq)); });
    if (byKey) {
      used.add(byKey[0]);
      req.push({ key: byKey[0], value: byKey[1], status: valueCovers(byKey[1], b.answer) ? 'match' : 'diff', want: b.answer });
      continue;
    }
    const byValue = entries.find(([k, v]) => !used.has(k) && valueCovers(v, b.answer));
    if (byValue) {
      used.add(byValue[0]);
      req.push({ key: byValue[0], value: byValue[1], status: 'match', want: b.answer });
    } else {
      req.push({ key: b.question, value: 'Not specified', status: 'missing', want: b.answer });
    }
  }
  const order: Record<SpecStatus, number> = { match: 0, diff: 1, missing: 2, other: 3 };
  req.sort((a, b) => order[a.status] - order[b.status]);
  const others: SpecRow[] = entries.filter(([k]) => !used.has(k)).map(([key, value]) => ({ key, value, status: 'other' as const }));
  return { rows: [...req, ...others], matched: req.filter(r => r.status === 'match').length, total: req.length };
}

// BuyerMY payment safety page (opened from the green strip)
const PAYMENT_PROTECTION_URL = 'https://buyer.indiamart.com/?utm_source=Desktop_BuyerMY&tabname=paymentsafety';

// Spec rows shown under the active product
const SPEC_ROWS = 3;

const RIBBON_TONE: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  teal: 'bg-teal-600 text-white',
  slate: 'bg-slate-600 text-white',
};

function SpecIcon({ status }: { status: SpecStatus }) {
  if (status === 'match') return <Check className="mr-0.5 inline h-3 w-3 flex-shrink-0" strokeWidth={3} />;
  if (status === 'diff') return <X className="mr-0.5 inline h-3 w-3 flex-shrink-0" strokeWidth={3} />;
  if (status === 'missing') return <Minus className="mr-0.5 inline h-3 w-3 flex-shrink-0" strokeWidth={3} />;
  return null;
}

const ROW_TONE: Record<SpecStatus, string> = {
  match: 'rounded bg-teal-100/80 px-1 text-teal-800',
  diff: 'rounded bg-amber-50 px-1 text-amber-800',
  missing: 'px-1 italic text-slate-400',
  other: 'px-1 text-slate-600',
};

export default function SellerCardV2({ seller, ribbon, ribbonTone = 'teal', compact = false }: SellerCardV2Props) {
  const [callRevealed, setCallRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [priceAsked, setPriceAsked] = useState(false);
  const [active, setActive] = useState(0);

  const years = Math.round(seller.years);
  const buyersServed = formatBuyersServed(seller.matchHighlight);
  const cityBuyers = seller.cityBuyers6m ?? 0;

  // Carousel items: the seller's catalog in the buyer's MCAT, else the single primary product
  const items: SellerProduct[] = seller.catalog && seller.catalog.length > 0
    ? seller.catalog
    : [{
        name: seller.productName || seller.name,
        price: seller.askPrice ? 'Ask for price' : seller.price,
        priceUnit: seller.priceUnit,
        image: seller.image,
      }];
  const idx = Math.min(active, items.length - 1);
  const item = items[idx];
  const hasPrice = item.price && item.price !== 'Ask for price';
  const view = buildSpecView(item.specs, seller.buyerSpecs);
  const specRows = view.rows.slice(0, SPEC_ROWS);
  const place = seller.buyerCity || 'your city';
  // "X buyers served in 6 months, Y in <buyer city>"
  const servedLine = buyersServed
    ? <>{buyersServed}{cityBuyers > 0 && <>, <span className="font-semibold text-teal-700">{cityBuyers} in {place}</span></>}</>
    : cityBuyers > 0 ? <span className="font-semibold text-teal-700">{cityBuyers} {cityBuyers === 1 ? 'buyer' : 'buyers'} served in {place}</span> : null;
  const summaryTone = view.total === 0 ? '' : view.matched === view.total ? 'text-teal-700' : view.matched === 0 ? 'text-slate-500' : 'text-amber-700';

  function go(delta: number, e: React.MouseEvent) {
    e.stopPropagation();
    setActive((idx + delta + items.length) % items.length);
  }

  function handleCall(e: React.MouseEvent) {
    e.stopPropagation();
    if (!callRevealed) { setCallRevealed(true); return; }
    if (seller.phone) {
      navigator.clipboard.writeText(seller.phone).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  const priceNode = hasPrice
    ? <>{item.price}{item.priceUnit ? <span className="text-xs font-semibold text-slate-500">{item.priceUnit}</span> : null}</>
    : <span className="text-sm font-semibold text-slate-500">Ask for price</span>;

  // ‹ 1/10 › pager that sits on the product image, so it is clearly the product that changes
  const pager = items.length > 1 && (
    <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-slate-900/75 text-white">
      <button type="button" aria-label="Previous product" onClick={e => go(-1, e)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/20"><ChevronLeft className="h-3.5 w-3.5" /></button>
      <span className="px-0.5 text-[10px] font-semibold tabular-nums">{idx + 1}/{items.length}</span>
      <button type="button" aria-label="Next product" onClick={e => go(1, e)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/20"><ChevronRight className="h-3.5 w-3.5" /></button>
    </div>
  );

  const ribbonEl = ribbon && (
    <span className={`absolute -top-2 left-3 rounded px-2 py-0.5 text-[10px] font-bold ${RIBBON_TONE[ribbonTone]}`}>
      {ribbon}
    </span>
  );

  const call = (
    <button
      type="button"
      onClick={handleCall}
      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[13px] font-semibold transition-colors ${
        callRevealed
          ? `border-transparent text-white ${copied ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'}`
          : 'border-teal-600 bg-white text-teal-700 hover:bg-teal-50'
      }`}
    >
      <Phone className="h-4 w-4" />
      {callRevealed ? (copied ? 'Copied' : seller.phone ?? 'Call Now') : 'Call Now'}
    </button>
  );
  const bestPrice = (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); setPriceAsked(true); }}
      disabled={priceAsked}
      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold text-white transition-colors ${
        priceAsked ? 'bg-emerald-600' : 'bg-teal-600 hover:bg-teal-700'
      }`}
    >
      {priceAsked ? <><Check className="h-4 w-4" strokeWidth={3} />Requested</> : 'Best Price'}
    </button>
  );

  const nameNode = seller.paidUrl ? (
    <a
      href={seller.paidUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={seller.name}
      className="block min-w-0 truncate text-center text-[15px] font-bold leading-tight text-slate-900 hover:text-teal-700 hover:underline underline-offset-2"
    >
      {seller.name}
    </a>
  ) : (
    <h3 title={seller.name} className="min-w-0 truncate text-center text-[15px] font-bold leading-tight text-slate-900">{seller.name}</h3>
  );

  const dot = <span className="text-slate-300">·</span>;

  if (compact) {
    return (
      <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-2.5 text-center shadow-sm">
        {ribbonEl}
        {nameNode}
        <div className="mt-0.5 flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] text-slate-600">
          <span className="inline-flex min-w-0 items-center gap-0.5"><MapPin className="h-3 w-3 flex-shrink-0" /><span className="max-w-[80px] truncate">{seller.city}</span></span>
          {seller.reviews > 0 && <>{dot}<span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="font-semibold text-slate-700">{seller.rating.toFixed(1)}</span></span></>}
          {years > 0 && <>{dot}<span className="font-semibold text-slate-700">{years} {years === 1 ? 'yr' : 'yrs'}</span></>}
          {seller.hasTrustSEAL && <>{dot}<span className="inline-flex items-center gap-0.5 font-semibold text-amber-700"><ShieldCheck className="h-3 w-3 text-amber-500" />TrustSEAL</span></>}
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 p-1.5">
          <div className="relative h-14 w-14 flex-shrink-0">
            <img key={idx} src={item.image} alt="" className="h-full w-full rounded-md bg-white object-contain" loading="lazy" />
            {pager}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
            <p className="truncate text-[10px]">
              {view.rows.length === 0 ? ' ' : view.rows.slice(0, 2).map((r, n) => (
                <span key={r.key} className={r.status === 'match' ? 'font-semibold text-teal-700' : r.status === 'diff' ? 'text-amber-700' : 'text-slate-500'}>
                  {n > 0 ? ' · ' : ''}{r.status === 'match' ? '✓ ' : r.status === 'diff' ? '✗ ' : ''}{r.key}: {r.value}
                </span>
              ))}
            </p>
            <p className="text-sm font-bold text-teal-700">{priceNode}</p>
          </div>
        </div>

        {(servedLine || seller.hasTrustSEAL) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-slate-700">
            {servedLine && <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3 flex-shrink-0 text-slate-500" /><span>{servedLine}</span></span>}
            {seller.hasTrustSEAL && (
              <a href={PAYMENT_PROTECTION_URL} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <ShieldCheck className="h-3 w-3" />₹5 Lac Payment Protection*
              </a>
            )}
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">{bestPrice}{call}</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col items-stretch rounded-2xl border border-slate-200 bg-white p-3.5 text-center shadow-sm">
      {ribbonEl}

      {/* 1. Seller introduction + facts */}
      {nameNode}
      <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{seller.city}</span>
      </p>
      <div className="mt-2 flex h-5 items-center justify-center gap-2 whitespace-nowrap text-[11px] text-slate-700">
        {seller.reviews > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{seller.rating.toFixed(1)}</span>
            <span className="text-slate-400">({seller.reviews})</span>
          </span>
        )}
        {years > 0 && <>{seller.reviews > 0 && dot}<span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-slate-500" /><span className="font-semibold">{years} {years === 1 ? 'yr' : 'yrs'}</span></span></>}
        {seller.hasTrustSEAL && <>{dot}<span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-amber-500" /><span className="font-semibold text-amber-700">TrustSEAL</span></span></>}
      </div>

      {/* 2. Catalog glimpse: image + pager left; name, requirement match, specs, price right */}
      <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 text-left">
        <div className="relative h-[88px] w-[88px] flex-shrink-0">
          <img key={idx} src={item.image} alt="" className="h-full w-full rounded-md bg-white object-contain" loading="lazy" />
          {pager}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 min-h-[30px] text-xs font-semibold leading-snug text-slate-800">{item.name}</p>
          <p className={`mt-0.5 min-h-[16px] text-[11px] font-semibold ${summaryTone}`}>
            {view.total > 0 && `${view.matched} of ${view.total} ${view.total === 1 ? 'requirement matches' : 'requirements match'}`}
          </p>
          <div className="min-h-[52px] space-y-0.5 text-[11px] leading-snug">
            {specRows.map(r => (
              <p key={r.key} title={r.want ? `You chose: ${r.want}` : undefined} className={`truncate ${ROW_TONE[r.status]}`}>
                <SpecIcon status={r.status} />
                <span className={r.status === 'other' ? 'text-slate-400' : 'opacity-80'}>{r.key}:</span> <span className="font-medium">{r.value}</span>
              </p>
            ))}
          </div>
          <p className="mt-1 text-base font-bold leading-tight text-teal-700">{priceNode}</p>
        </div>
      </div>

      {/* 3. Why connect: buyers served, payment protection */}
      <div className="mt-3 flex min-h-[74px] flex-col gap-1.5 text-xs text-slate-700">
        {servedLine && (
          <p className="flex items-center justify-center gap-1.5 text-center leading-snug">
            <TrendingUp className="h-4 w-4 flex-shrink-0 text-slate-500" />
            <span>{servedLine}</span>
          </p>
        )}
        {seller.hasTrustSEAL && (
          <a
            href={PAYMENT_PROTECTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="mt-auto flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            ₹5 Lac Payment Protection*
          </a>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">{bestPrice}{call}</div>
    </div>
  );
}
