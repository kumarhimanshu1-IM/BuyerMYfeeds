import { useState } from 'react';
import { MapPin, Star, ShieldCheck, Check, Phone, CalendarDays, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SellerCard, SellerProduct } from './SearchModal';

// Variant of the final-result seller card (enabled with ?card=v2). Everything is centred and
// every card has the same three tiers so rows line up across a grid:
//   1. Seller introduction + facts (name -> paid URL, city, rating, vintage, TrustSEAL)
//   2. Catalog glimpse (product carousel: image, name, specs, price follow the active product)
//   3. Why connect (buyers served in 6 months / in your city, payment protection)
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

interface RankedSpec { key: string; value: string; match: boolean; }

// Product specs the buyer also filled come first; a spec whose value also matches the buyer's
// answer is flagged (match) so it can be highlighted. Remaining specs follow in API order.
function rankSpecs(specs: Record<string, string> | undefined, buyer: { question: string; answer: string }[] | undefined): RankedSpec[] {
  const rows = Object.entries(specs ?? {});
  if (!buyer || buyer.length === 0) return rows.map(([key, value]) => ({ key, value, match: false }));
  const scored = rows.map(([key, value], i) => {
    const nk = norm(key);
    const b = buyer.find(x => { const q = norm(x.question); return q && nk && (q === nk || q.includes(nk) || nk.includes(q)); });
    const na = b ? norm(b.answer) : '';
    const match = !!b && value.split(';').some(tok => { const nt = norm(tok); return nt && na && (nt === na || na.includes(nt) || nt.includes(na)); });
    return { key, value, match, keyHit: !!b, i };
  });
  scored.sort((a, b) => (Number(b.match) - Number(a.match)) || (Number(b.keyHit) - Number(a.keyHit)) || a.i - b.i);
  return scored.map(({ key, value, match }) => ({ key, value, match }));
}

// BuyerMY payment safety page (opened from the green strip)
const PAYMENT_PROTECTION_URL = 'https://buyer.indiamart.com/?utm_source=Desktop_BuyerMY&tabname=paymentsafety';

// Spec rows shown under the active product
const SPEC_ROWS = 3;
const SPEC_ROWS_MAX = 4;

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
  const ranked = rankSpecs(item.specs, seller.buyerSpecs);
  const matchCount = ranked.filter(r => r.match).length;
  const specRows = ranked.slice(0, Math.min(SPEC_ROWS_MAX, Math.max(SPEC_ROWS, matchCount)));
  const place = seller.buyerCity || 'your city';
  // "X buyers served in 6 months, Y in <buyer city>"
  const servedLine = buyersServed
    ? <>{buyersServed}{cityBuyers > 0 && <>, <span className="font-semibold text-teal-700">{cityBuyers} in {place}</span></>}</>
    : cityBuyers > 0 ? <span className="font-semibold text-teal-700">{cityBuyers} {cityBuyers === 1 ? 'buyer' : 'buyers'} served in {place}</span> : null;
  const hasPrice = item.price && item.price !== 'Ask for price';

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


  if (compact) {
    return (
      <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-2.5 text-center shadow-sm">
        {ribbon && (
          <span className={`absolute -top-2 left-3 rounded px-2 py-0.5 text-[10px] font-bold ${RIBBON_TONE[ribbonTone]}`}>
            {ribbon}
          </span>
        )}
        {/* Intro: name, then city / rating / vintage / TrustSEAL on one line */}
        {seller.paidUrl ? (
          <a href={seller.paidUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="truncate text-sm font-bold text-slate-900 hover:text-teal-700">
            {seller.name}
          </a>
        ) : (
          <h3 className="truncate text-sm font-bold text-slate-900">{seller.name}</h3>
        )}
        <div className="mt-0.5 flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] text-slate-600">
          <span className="inline-flex min-w-0 items-center gap-0.5"><MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate max-w-[80px]">{seller.city}</span></span>
          {seller.reviews > 0 && (
            <span className="inline-flex items-center gap-0.5 border-l border-slate-200 pl-1.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-slate-700">{seller.rating.toFixed(1)}</span>
            </span>
          )}
          {years > 0 && <span className="border-l border-slate-200 pl-1.5 font-semibold text-slate-700">{years} {years === 1 ? 'yr' : 'yrs'}</span>}
          {seller.hasTrustSEAL && (
            <span className="inline-flex items-center gap-0.5 border-l border-slate-200 pl-1.5 font-semibold text-amber-700">
              <ShieldCheck className="h-3 w-3 text-amber-500" />TrustSEAL
            </span>
          )}
        </div>

        {/* Catalog: one product row, arrows to switch */}
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
          <div className="relative h-12 w-12 flex-shrink-0">
            <img key={idx} src={item.image} alt="" className="h-full w-full rounded-md bg-white object-contain" loading="lazy" />
            {items.length > 1 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-slate-900/75 px-1 text-[9px] font-semibold text-white">{idx + 1}/{items.length}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
            <p className="truncate text-[10px] text-slate-500">
              {ranked.length === 0 ? '\u00a0' : ranked.slice(0, 2).map((r, n) => (
                <span key={r.key} className={r.match ? 'font-semibold text-teal-700' : ''}>{n > 0 ? ' · ' : ''}{r.match ? '✓ ' : ''}{r.key}: {r.value}</span>
              ))}
            </p>
            <p className="text-sm font-bold text-teal-700">
              {hasPrice ? <>{item.price}{item.priceUnit ? <span className="text-[10px] font-semibold text-slate-500">{item.priceUnit}</span> : null}</> : <span className="text-xs font-semibold text-slate-500">Ask for price</span>}
            </p>
          </div>
          {items.length > 1 && (
            <div className="flex flex-shrink-0 flex-col gap-1">
              <button type="button" aria-label="Previous product" onClick={e => go(-1, e)} className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 shadow"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next product" onClick={e => go(1, e)} className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 shadow"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {/* Why connect: buyers served + payment protection on one line */}
        {(servedLine || seller.hasTrustSEAL) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-lg border border-teal-100 bg-teal-50/60 px-2 py-1 text-[11px] text-slate-700">
            {servedLine && <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3 flex-shrink-0 text-slate-500" /><span>{servedLine}</span></span>}
            {seller.hasTrustSEAL && (
              <a href={PAYMENT_PROTECTION_URL} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <ShieldCheck className="h-3 w-3" />₹5 Lac Payment Protection*
              </a>
            )}
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setPriceAsked(true); }}
            disabled={priceAsked}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[13px] font-semibold text-white ${priceAsked ? 'bg-emerald-600' : 'bg-teal-600'}`}
          >
            {priceAsked ? <><Check className="h-4 w-4" strokeWidth={3} />Requested</> : 'Best Price'}
          </button>
          <button
            type="button"
            onClick={handleCall}
            className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[13px] font-semibold ${callRevealed ? `border-transparent text-white ${copied ? 'bg-emerald-600' : 'bg-slate-900'}` : 'border-teal-600 bg-white text-teal-700'}`}
          >
            <Phone className="h-4 w-4" />
            {callRevealed ? (copied ? 'Copied' : seller.phone ?? 'Call Now') : 'Call Now'}
          </button>
        </div>
      </div>
    );
  }

  const nameClass = 'text-[15px] font-bold leading-tight text-slate-900 truncate text-center';

  return (
    <div className="relative flex h-full flex-col items-stretch rounded-2xl border border-slate-200 bg-white p-3.5 text-center shadow-sm">
      {ribbon && (
        <span className={`absolute -top-2 left-3 rounded px-2 py-0.5 text-[10px] font-bold ${RIBBON_TONE[ribbonTone]}`}>
          {ribbon}
        </span>
      )}

      {/* 1. Seller introduction + facts */}
      <div className="flex items-center justify-center">
        {seller.paidUrl ? (
          <a
            href={seller.paidUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title={seller.name}
            className={`${nameClass} min-w-0 hover:text-teal-700 hover:underline underline-offset-2`}
          >
            {seller.name}
          </a>
        ) : (
          <h3 title={seller.name} className={`${nameClass} min-w-0`}>{seller.name}</h3>
        )}
      </div>
      <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{seller.city}</span>
      </p>
      <div className="mt-2 flex h-5 items-center justify-center gap-2.5 whitespace-nowrap text-[11px] text-slate-700">
        {seller.reviews > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{seller.rating.toFixed(1)}</span>
            <span className="text-slate-400">({seller.reviews})</span>
          </span>
        )}
        {years > 0 && (
          <span className="inline-flex items-center gap-1 border-l border-slate-200 pl-2.5">
            <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-semibold">{years} {years === 1 ? 'yr' : 'yrs'}</span>
          </span>
        )}
        {seller.hasTrustSEAL && (
          <span className="inline-flex items-center gap-1 border-l border-slate-200 pl-2.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-semibold text-amber-700">TrustSEAL</span>
          </span>
        )}
      </div>

      {/* 2. Catalog glimpse: image left, specs right; price + arrows below follow the active product */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5">
        <div className="flex items-start gap-2.5 text-left">
          <div className="relative h-[84px] w-[84px] flex-shrink-0">
            <img key={idx} src={item.image} alt="" className="h-full w-full rounded-md bg-white object-contain" loading="lazy" />
            {items.length > 1 && (
              <span className="absolute right-1 top-1 rounded-full bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {idx + 1}/{items.length}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 min-h-[30px] text-xs font-semibold leading-snug text-slate-800">{item.name}</p>
            <div className="mt-1 min-h-[64px] space-y-0.5 text-[11px] leading-snug text-slate-600">
              {specRows.map(r => (
                <p key={r.key} className={`truncate ${r.match ? 'rounded bg-teal-100/80 px-1 text-teal-800' : ''}`}>
                  {r.match && <Check className="mr-0.5 inline h-3 w-3" strokeWidth={3} />}
                  <span className={r.match ? 'text-teal-700' : 'text-slate-400'}>{r.key}:</span> <span className="font-medium">{r.value}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-1.5">
          {items.length > 1 ? (
            <button type="button" aria-label="Previous product" onClick={e => go(-1, e)} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow hover:text-teal-700">
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : <span className="w-6" />}
          <p className="min-h-[24px] text-base font-bold text-teal-700">
            {hasPrice ? (
              <>
                {item.price}
                {item.priceUnit ? <span className="text-xs font-semibold text-slate-500">{item.priceUnit}</span> : null}
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-500">Ask for price</span>
            )}
          </p>
          {items.length > 1 ? (
            <button type="button" aria-label="Next product" onClick={e => go(1, e)} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow hover:text-teal-700">
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : <span className="w-6" />}
        </div>
      </div>

      {/* 3. Why connect: buyers served, payment protection */}
      <div className="mt-2.5 flex min-h-[84px] flex-col justify-start gap-1.5 rounded-lg border border-teal-100 bg-teal-50/60 px-2.5 py-2 text-xs text-slate-700">
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
            className="mt-auto flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-emerald-100 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            ₹5 Lac Payment Protection*
          </a>
        )}
      </div>

      {/* CTAs: Best Price (primary) + Call Now */}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setPriceAsked(true); }}
          disabled={priceAsked}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold text-white transition-colors ${
            priceAsked ? 'bg-emerald-600' : 'bg-teal-600 hover:bg-teal-700'
          }`}
        >
          {priceAsked ? <><Check className="h-4 w-4" strokeWidth={3} />Price requested</> : 'Best Price'}
        </button>
        <button
          type="button"
          onClick={handleCall}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[13px] font-semibold transition-colors ${
            callRevealed
              ? `border-transparent text-white ${copied ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'}`
              : 'border-teal-600 bg-white text-teal-700 hover:bg-teal-50'
          }`}
        >
          <Phone className="h-4 w-4" />
          {callRevealed ? (copied ? 'Copied' : seller.phone ?? 'Call Now') : 'Call Now'}
        </button>
      </div>
    </div>
  );
}
