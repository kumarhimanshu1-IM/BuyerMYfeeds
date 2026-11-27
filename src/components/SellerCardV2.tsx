import { useState } from 'react';
import { MapPin, Star, ShieldCheck, Check, Phone, CalendarDays, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SellerCard, SellerProduct } from './SearchModal';

// Variant of the final-result seller card (enabled with ?card=v2). Everything is centred and
// every card has the same three tiers so rows line up across a grid:
//   1. Seller introduction + facts (name -> paid URL, TrustSEAL, city, rating, vintage)
//   2. Catalog glimpse (product carousel: image, name, specs, price follow the active product)
//   3. Why connect (buyers served in 6 months / in your city, payment protection)
//   CTAs (Best Price, Call Now)
interface SellerCardV2Props {
  seller: SellerCard;
  ribbon?: string;
  ribbonTone?: 'amber' | 'teal' | 'slate';
}

// Same rule as the original card's highlight line (hidden under 5 buyers), but shows the actual count.
function formatBuyersServed(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.match(/^(\d+) buyers served in 6m$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n < 5 ? null : `${n} buyers served in 6 months`;
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

export default function SellerCardV2({ seller, ribbon, ribbonTone = 'teal' }: SellerCardV2Props) {
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
  const specRows = Object.entries(item.specs ?? {}).slice(0, SPEC_ROWS);
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

  const nameClass = 'text-[15px] font-bold leading-tight text-slate-900 line-clamp-2 text-center';

  return (
    <div className="relative flex h-full flex-col items-stretch rounded-2xl border border-slate-200 bg-white p-3.5 text-center shadow-sm">
      {ribbon && (
        <span className={`absolute -top-2 left-3 rounded px-2 py-0.5 text-[10px] font-bold ${RIBBON_TONE[ribbonTone]}`}>
          {ribbon}
        </span>
      )}

      {/* 1. Seller introduction + facts */}
      <div className="flex min-h-[38px] items-start justify-center gap-1">
        {seller.paidUrl ? (
          <a
            href={seller.paidUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`${nameClass} min-w-0 hover:text-teal-700 hover:underline underline-offset-2`}
          >
            {seller.name}
          </a>
        ) : (
          <h3 className={`${nameClass} min-w-0`}>{seller.name}</h3>
        )}
        {seller.hasTrustSEAL && (
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" aria-label="TrustSEAL" />
        )}
      </div>
      <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-slate-500">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{seller.city}</span>
      </p>
      <div className="mt-1.5 flex h-5 items-center justify-center gap-2 whitespace-nowrap text-[11px] text-slate-700">
        {seller.reviews > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{seller.rating.toFixed(1)}</span>
            <span className="text-slate-400">({seller.reviews})</span>
          </span>
        )}
        {years > 0 && (
          <span className="inline-flex items-center gap-1 border-l border-slate-200 pl-2">
            <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-semibold">{years} {years === 1 ? 'yr' : 'yrs'}</span>
          </span>
        )}
      </div>

      {/* 2. Catalog glimpse: carousel, specs and price follow the active product */}
      <div className="mt-2.5 rounded-lg bg-slate-50 px-2.5 py-2.5">
        <div className="relative mx-auto h-24 w-full">
          <img
            key={idx}
            src={item.image}
            alt=""
            className="mx-auto h-full max-w-full rounded-md object-contain"
            loading="lazy"
          />
          {items.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous product"
                onClick={e => go(-1, e)}
                className="absolute left-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next product"
                onClick={e => go(1, e)}
                className="absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <p className="mt-2 line-clamp-2 min-h-[32px] text-xs font-semibold leading-snug text-slate-800">{item.name}</p>
        <div className="mt-1 min-h-[54px] space-y-0.5 text-[11px] leading-snug text-slate-600">
          {specRows.map(([k, v]) => (
            <p key={k} className="truncate"><span className="text-slate-400">{k}:</span> <span className="font-medium">{v}</span></p>
          ))}
        </div>
        <p className="mt-1 min-h-[24px] text-base font-bold text-teal-700">
          {hasPrice ? (
            <>
              {item.price}
              {item.priceUnit ? <span className="text-xs font-semibold text-slate-500">{item.priceUnit}</span> : null}
            </>
          ) : (
            <span className="text-sm font-semibold text-slate-500">Ask for price</span>
          )}
        </p>
        {items.length > 1 && (
          <p className="mt-0.5 text-[10px] font-medium text-slate-400">{idx + 1} / {items.length} products</p>
        )}
      </div>

      {/* 3. Why connect: buyers served, payment protection */}
      <div className="mt-2.5 flex min-h-[56px] flex-col items-center justify-start gap-1.5 text-xs text-slate-700">
        {buyersServed && (
          <p className="flex items-center justify-center gap-1.5">
            <TrendingUp className="h-4 w-4 flex-shrink-0 text-slate-500" />
            {buyersServed}
          </p>
        )}
        {cityBuyers > 0 && (
          <p className="flex items-center justify-center gap-1.5 font-semibold text-teal-700">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            {cityBuyers} {cityBuyers === 1 ? 'buyer' : 'buyers'} served in your city
          </p>
        )}
      </div>
      <div className="h-9">
        {seller.hasTrustSEAL && (
          <a
            href={PAYMENT_PROTECTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            ₹5 Lac Payment Protection*
          </a>
        )}
      </div>

      {/* CTAs: Best Price (primary) + Call Now */}
      <div className="mt-auto flex flex-col gap-2 pt-3">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setPriceAsked(true); }}
          disabled={priceAsked}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white transition-colors ${
            priceAsked ? 'bg-emerald-600' : 'bg-teal-600 hover:bg-teal-700'
          }`}
        >
          {priceAsked ? <><Check className="h-4 w-4" strokeWidth={3} />Price requested</> : 'Best Price'}
        </button>
        <button
          type="button"
          onClick={handleCall}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-colors ${
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
