import { useState } from 'react';
import { MapPin, Star, ShieldCheck, Check, Phone, Package } from 'lucide-react';
import type { SellerCard } from './SearchModal';

// Variant of the final-result seller card (enabled with ?card=v2).
// Sections: seller name + logo, location, trust signals, "Supplier for" product,
// product detail, payment protection, request update, Call Now / View Product CTAs.
interface SellerCardV2Props {
  seller: SellerCard;
  ribbon?: string;
  ribbonTone?: 'amber' | 'teal' | 'slate';
}

const RIBBON_TONE: Record<string, string> = {
  amber: 'bg-amber-500 text-white',
  teal: 'bg-teal-600 text-white',
  slate: 'bg-slate-600 text-white',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-px" aria-hidden>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3 h-3 ${rating >= i - 0.25 ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
        />
      ))}
    </span>
  );
}

export default function SellerCardV2({ seller, ribbon, ribbonTone = 'teal' }: SellerCardV2Props) {
  const [callRevealed, setCallRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const price = seller.askPrice ? null : seller.price;
  const cityBuyers = seller.cityBuyers6m ?? 0;
  const productName = seller.productName || seller.products?.[0]?.name || seller.spec;
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

  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      {ribbon && (
        <span className={`absolute -top-2 left-3 rounded px-2 py-0.5 text-[10px] font-bold ${RIBBON_TONE[ribbonTone]}`}>
          {ribbon}
        </span>
      )}

      {/* 1 + 2: logo (product image), seller name, location */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
          {seller.image ? (
            <img src={seller.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="text-base font-bold text-slate-500">{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-tight text-slate-900 line-clamp-2">{seller.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{seller.city}</span>
          </p>
        </div>
      </div>

      {/* 3: trust signals */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
        {seller.hasGST && (
          <span className="inline-flex items-center gap-1 font-semibold">
            GST <Check className="h-3.5 w-3.5 rounded-sm bg-emerald-600 p-px text-white" strokeWidth={3} />
          </span>
        )}
        {seller.hasTrustSEAL && (
          <span className="inline-flex items-center gap-1 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> TrustSEAL
          </span>
        )}
        {seller.reviews > 0 && (
          <span className="inline-flex w-full items-center gap-1">
            <Stars rating={seller.rating} />
            <span className="font-semibold">{seller.rating.toFixed(1)}</span>
            <span className="text-slate-400">({seller.reviews})</span>
          </span>
        )}
      </div>

      {/* 4: supplier for */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] text-slate-500">Supplier for</p>
        <p className="mt-0.5 text-[15px] font-bold leading-snug text-slate-900 line-clamp-2">{productName}</p>
      </div>

      {/* 5: product / range detail */}
      <div className="mt-2.5 flex items-start gap-2.5 rounded-lg bg-sky-50 px-3 py-2.5 text-xs text-slate-600">
        <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
        <p className="leading-snug">
          {seller.years > 0 ? `${seller.years} yrs on IndiaMART. ` : ''}
          Contact this seller for pricing and availability.
        </p>
      </div>

      {/* 6: payment protection (TrustSEAL sellers) */}
      {seller.hasPayProtected && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          Covered up to ₹5 Lac Payment Protection*
        </div>
      )}

      {/* update for your request */}
      <div className="mt-3">
        <p className="text-[11px] text-slate-500">Update for your request</p>
        <p className="mt-1 text-sm font-bold text-slate-900 truncate">{seller.name}</p>
        {price && (
          <p className="mt-0.5 text-sm font-bold text-teal-700">
            {price}
            {seller.priceUnit ? <span className="text-xs font-semibold text-slate-500">{seller.priceUnit}</span> : null}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">Please contact the seller regarding this request.</p>
        {cityBuyers > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
            <MapPin className="h-3 w-3" />
            {cityBuyers} {cityBuyers === 1 ? 'buyer' : 'buyers'} served in your city
          </p>
        )}
      </div>

      {/* 7 + 8: CTAs */}
      <div className="mt-auto flex flex-col gap-2 pt-3.5">
        <button
          type="button"
          onClick={handleCall}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-colors ${
            callRevealed
              ? `border-transparent text-white ${copied ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'}`
              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Phone className="h-4 w-4" />
          {callRevealed ? (copied ? 'Copied' : seller.phone ?? 'Call Now') : 'Call Now'}
        </button>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-semibold text-[#2e3192] hover:bg-slate-50 transition-colors"
        >
          View Product
        </button>
      </div>
    </div>
  );
}
