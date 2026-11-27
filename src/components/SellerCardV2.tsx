import { useState } from 'react';
import { MapPin, Star, ShieldCheck, Check, Phone, CalendarDays, TrendingUp, Package } from 'lucide-react';
import type { SellerCard } from './SearchModal';

// Variant of the final-result seller card (enabled with ?card=v2).
// Every card has the same sections in the same order so rows line up across a grid:
//   header (logo, name -> paid URL, city, vintage + rating, TrustSEAL)
//   stats (products listed, buyers served in 6m, buyers served in your city)
//   payment protection slot
//   price
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

const RIBBON_TONE: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  teal: 'bg-teal-600 text-white',
  slate: 'bg-slate-600 text-white',
};

export default function SellerCardV2({ seller, ribbon, ribbonTone = 'teal' }: SellerCardV2Props) {
  const [callRevealed, setCallRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [priceAsked, setPriceAsked] = useState(false);

  const years = Math.round(seller.years);
  const buyersServed = formatBuyersServed(seller.matchHighlight);
  const cityBuyers = seller.cityBuyers6m ?? 0;
  const productCount = seller.productCount ?? 0;
  const price = seller.askPrice ? null : seller.price;
  const initial = (seller.name || '?').trim().charAt(0).toUpperCase();

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

  const nameClass = 'text-[15px] font-bold leading-tight text-slate-900 line-clamp-2 min-h-[38px]';

  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      {ribbon && (
        <span className={`absolute -top-2 left-3 rounded px-2 py-0.5 text-[10px] font-bold ${RIBBON_TONE[ribbonTone]}`}>
          {ribbon}
        </span>
      )}

      {/* Header: logo (product image), name, city */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {seller.image ? (
            <img src={seller.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="text-base font-bold text-slate-500">{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
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
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{seller.city}</span>
          </p>
        </div>
      </div>

      {/* Trust row: rating, vintage, TrustSEAL on one line */}
      <div className="mt-2.5 flex h-5 items-center gap-2 whitespace-nowrap text-[11px] text-slate-700">
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

      {/* Stats: products listed, buyers served */}
      <div className="mt-2.5 flex min-h-[84px] flex-col justify-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
        {productCount > 0 && (
          <p className="flex items-center gap-2">
            <Package className="h-4 w-4 flex-shrink-0 text-slate-500" />
            {productCount} {productCount === 1 ? 'product' : 'products'} listed
          </p>
        )}
        {buyersServed && (
          <p className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 flex-shrink-0 text-slate-500" />
            {buyersServed}
          </p>
        )}
        {cityBuyers > 0 && (
          <p className="flex items-center gap-2 font-semibold text-teal-700">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            {cityBuyers} {cityBuyers === 1 ? 'buyer' : 'buyers'} served in your city
          </p>
        )}
      </div>

      {/* Payment protection slot (blank when the seller doesn't have it, to keep rows aligned) */}
      <div className="mt-2.5 h-9">
        {seller.hasTrustSEAL && (
          <a
            href={PAYMENT_PROTECTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            ₹5 Lac Payment Protection*
          </a>
        )}
      </div>

      {/* Price */}
      <div className="mt-2.5 min-h-[28px] border-t border-slate-100 pt-2.5">
        {price && (
          <p className="text-base font-bold text-teal-700">
            {price}
            {seller.priceUnit ? <span className="text-xs font-semibold text-slate-500">{seller.priceUnit}</span> : null}
          </p>
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
