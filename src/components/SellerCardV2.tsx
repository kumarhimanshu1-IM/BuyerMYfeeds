import { useRef, useState } from 'react';
import { MapPin, Star, ShieldCheck, Check, Phone, CalendarDays, TrendingUp } from 'lucide-react';
import type { SellerCard, SellerProduct } from './SearchModal';

// Variant of the final-result seller card (enabled with ?card=v2). Centred, three tiers, no inner
// divider lines (tiers are told apart by spacing and one light fill on the catalog):
//   1. Seller introduction + facts (name -> paid URL, city, rating, vintage, TrustSEAL)
//   2. Catalog glimpse (own shade): product image on the left; name and specs on the right (specs the
//      buyer asked for are highlighted); price and a dot scroller below. All follow the active product.
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

interface SpecRow { key: string; value: string; match: boolean; }

// The product's own specs only. A spec whose value covers what the buyer picked (matched by spec
// name first, else by value) is flagged and listed first; the rest keep their order, unhighlighted.
function buildSpecView(specs: Record<string, string> | undefined, buyer: { question: string; answer: string }[] | undefined): SpecRow[] {
  const entries = Object.entries(specs ?? {});
  const matched = new Set<string>();
  const hinted = new Set<string>();
  const valueCovers = (value: string, answer: string) => {
    const na = norm(answer);
    return value.split(';').some(tok => { const nt = norm(tok); return !!nt && !!na && (nt === na || na.includes(nt) || nt.includes(na)); });
  };
  for (const b of buyer ?? []) {
    const nq = norm(b.question);
    const byKey = entries.find(([k]) => { const nk = norm(k); return !matched.has(k) && !!nq && !!nk && (nq === nk || nq.includes(nk) || nk.includes(nq)); });
    if (byKey) {
      if (valueCovers(byKey[1], b.answer)) matched.add(byKey[0]); else hinted.add(byKey[0]);
      continue;
    }
    const byValue = entries.find(([k, v]) => !matched.has(k) && valueCovers(v, b.answer));
    if (byValue) matched.add(byValue[0]);
  }
  const rank = (k: string) => (matched.has(k) ? 0 : hinted.has(k) ? 1 : 2);
  return entries
    .map(([key, value], i) => ({ key, value, match: matched.has(key), r: rank(key), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ key, value, match }) => ({ key, value, match }));
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

export default function SellerCardV2({ seller, ribbon, ribbonTone = 'teal', compact = false }: SellerCardV2Props) {
  const [callRevealed, setCallRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [priceAsked, setPriceAsked] = useState(false);
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);

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
        url: seller.paidUrl,
      }];
  const idx = Math.min(active, items.length - 1);
  const item = items[idx];
  const hasPrice = item.price && item.price !== 'Ask for price';
  const specRows = buildSpecView(item.specs, seller.buyerSpecs).slice(0, SPEC_ROWS);
  const place = seller.buyerCity || 'your city';
  // "X buyers served in 6 months, Y in <buyer city>"
  const servedLine = buyersServed
    ? <>{buyersServed}{cityBuyers > 0 && <>, <span className="font-semibold text-teal-700">{cityBuyers} in {place}</span></>}</>
    : cityBuyers > 0 ? <span className="font-semibold text-teal-700">{cityBuyers} {cityBuyers === 1 ? 'buyer' : 'buyers'} served in {place}</span> : null;

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

  // Product image / name open the product's page (title_url) in a new tab
  const productLink = (children: React.ReactNode, className = '') => item.url
    ? <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title={item.name} className={className}>{children}</a>
    : <span className={className}>{children}</span>;

  // Dot scroller for the product carousel (tap a dot, or swipe the product section)
  const dots = items.length > 1 && (
    <div className="flex items-center gap-1" role="tablist" aria-label="Products">
      {items.map((_, n) => (
        <button
          key={n}
          type="button"
          role="tab"
          aria-selected={n === idx}
          aria-label={`Product ${n + 1} of ${items.length}`}
          onClick={e => { e.stopPropagation(); setActive(n); }}
          className={`h-1.5 rounded-full transition-all ${n === idx ? 'w-4 bg-teal-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`}
        />
      ))}
    </div>
  );
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current == null || items.length < 2) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) > 40) setActive((idx + (dx < 0 ? 1 : -1) + items.length) % items.length);
    },
  };

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

        <div {...swipe} className="mt-2.5 rounded-lg bg-slate-100/80 p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-14 w-14 flex-shrink-0">
              {productLink(<img key={idx} src={item.image} alt="" className="h-full w-full rounded-md bg-white object-contain" loading="lazy" />, 'block h-full w-full')}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-semibold text-slate-800">{productLink(item.name, item.url ? 'hover:text-teal-700 hover:underline' : '')}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                {specRows.length === 0 ? '\u00a0' : specRows.slice(0, 2).map((r, n) => (
                  <span key={r.key} className={r.match ? 'rounded bg-teal-100 px-1 font-semibold text-teal-800' : ''}>{n > 0 ? ' ' : ''}{r.match ? '✓ ' : ''}{r.key}: {r.value}</span>
                ))}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm font-bold leading-tight text-teal-700">{priceNode}</p>
            {dots}
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

      {/* 2. Catalog glimpse: image left; name + specs right; price and dot scroller below */}
      <div {...swipe} className="mt-3.5 rounded-xl bg-slate-100/80 p-3 text-left">
        <div className="flex items-start gap-3">
          <div className="h-[84px] w-[84px] flex-shrink-0">
            {productLink(<img key={idx} src={item.image} alt="" className="h-full w-full rounded-lg bg-white object-contain" loading="lazy" />, 'block h-full w-full')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 min-h-[32px] text-xs font-semibold leading-snug text-slate-800">{productLink(item.name, item.url ? 'hover:text-teal-700 hover:underline underline-offset-2' : '')}</p>
            <div className="mt-1.5 min-h-[58px] space-y-1 text-[11px] leading-snug">
              {specRows.map(r => (
                <p key={r.key} title={r.match ? 'Matches your requirement' : undefined} className={`truncate ${r.match ? '-mx-1 rounded bg-teal-100 px-1 text-teal-800' : 'text-slate-600'}`}>
                  {r.match && <Check className="mr-0.5 inline h-3 w-3" strokeWidth={3} />}
                  <span className={r.match ? 'opacity-80' : 'text-slate-400'}>{r.key}:</span> <span className="font-medium">{r.value}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex min-h-[24px] items-center justify-between gap-2">
          <p className="text-base font-bold leading-tight text-teal-700">{priceNode}</p>
          {dots}
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
