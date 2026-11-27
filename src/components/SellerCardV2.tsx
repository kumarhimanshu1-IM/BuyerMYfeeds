import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Star, ShieldCheck, Check, Phone, MessageSquare, TrendingUp, X } from 'lucide-react';
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
const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();

// Strict value match: identical, or one fully contains the other as whole words and the contained
// part is at least 3 characters ("Half Bag (1/2)" covers "Half Bag"; "125 kVA" does NOT cover "1").
function sameValue(a: string, b: string): boolean {
  const wa = words(a), wb = words(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return short.length >= 3 && new RegExp(`(^| )${short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(long);
}

interface SpecRow { key: string; value: string; match: boolean; }

// The product's own specs only. A spec whose value covers what the buyer picked (matched by spec
// name first, else by value) is flagged and listed first; the rest keep their order, unhighlighted.
function buildSpecView(specs: Record<string, string> | undefined, buyer: { question: string; answer: string }[] | undefined): SpecRow[] {
  const entries = Object.entries(specs ?? {});
  const matched = new Set<string>();
  const hinted = new Set<string>();
  const valueCovers = (value: string, answer: string) => value.split(';').some(tok => sameValue(tok, answer));
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

function CatalogPanel({ seller, items, activeIdx, onPick, onClose }: {
  seller: SellerCard;
  items: SellerProduct[];
  activeIdx: number;
  onPick: (n: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/40 md:items-center" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div
        role="dialog"
        aria-label={`${seller.name} products`}
        className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:max-w-md md:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{seller.name}</p>
            <p className="text-xs text-slate-500">{items.length} products in this category</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <ul className="divide-y divide-slate-100 overflow-y-auto">
          {items.map((it, n) => {
            const specs = buildSpecView(it.specs, seller.buyerSpecs).slice(0, 3);
            const hasP = it.price && it.price !== 'Ask for price';
            return (
              <li key={`${it.name}-${n}`} className={n === activeIdx ? 'bg-teal-50/50' : ''}>
                <div className="flex w-full items-start gap-3 px-4 py-3 text-left">
                  <button type="button" onClick={() => onPick(n)} className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-50" aria-label={`Show ${it.name} on the card`}>
                    <img src={it.image} alt="" className="h-full w-full object-contain" loading="lazy" />
                  </button>
                  <div className="min-w-0 flex-1">
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-xs font-semibold text-slate-800 hover:text-teal-700 hover:underline">{it.name}</a>
                    ) : (
                      <p className="line-clamp-2 text-xs font-semibold text-slate-800">{it.name}</p>
                    )}
                    <div className="mt-1 space-y-0.5 text-[11px] leading-snug">
                      {specs.map(r => (
                        <p key={r.key} className={`truncate ${r.match ? 'rounded bg-teal-100 px-1 text-teal-800' : 'text-slate-600'}`}>
                          {r.match && <Check className="mr-0.5 inline h-3 w-3" strokeWidth={3} />}
                          <span className={r.match ? 'opacity-80' : 'text-slate-400'}>{r.key}:</span> <span className="font-medium">{r.value}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <p className="text-sm font-bold text-teal-700">{hasP ? <>{it.price}<span className="text-[10px] font-semibold text-slate-500">{it.priceUnit}</span></> : <span className="text-xs font-semibold text-slate-500">Ask for price</span>}</p>
                    <button type="button" onClick={() => onPick(n)} className="rounded-md border border-teal-600 px-2 py-0.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-50">{n === activeIdx ? 'Showing' : 'Show'}</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
export default function SellerCardV2({ seller, ribbon, ribbonTone = 'teal', compact = false }: SellerCardV2Props) {
  const [callRevealed, setCallRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [priceAsked, setPriceAsked] = useState(false);
  const [active, setActive] = useState(0);
  // Direction of the last product change; drives the slide-in animation (none until the first change)
  const [anim, setAnim] = useState<'next' | 'prev' | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const touchX = useRef<number | null>(null);

  const buyersServed = formatBuyersServed(seller.matchHighlight);
  const cityBuyers = seller.cityBuyers6m ?? 0;

  // Carousel items: the seller's catalog in the buyer's MCAT (products without an image skipped),
  // best match to the buyer's specs first; else the single primary product
  const catalogItems = (seller.catalog ?? []).filter(p => !p.noImage);
  const items: SellerProduct[] = catalogItems.length > 0
    ? catalogItems
        .map((p, i) => ({ p, i, m: buildSpecView(p.specs, seller.buyerSpecs).filter(r => r.match).length }))
        .sort((a, b) => b.m - a.m || a.i - b.i)
        .map(x => x.p)
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

  function select(n: number, direction?: 'next' | 'prev') {
    if (n === idx) return;
    setAnim(direction ?? (n > idx ? 'next' : 'prev'));
    setActive(n);
  }
  const animClass = anim === 'next' ? 'v2-slide-next' : anim === 'prev' ? 'v2-slide-prev' : '';

  // Thumbnail strip: 3 products at a glance (tap to switch) + a "+N more" tile that opens the full
  // catalog. When a product beyond the first 3 is active it takes the last slot so it stays visible.
  const VISIBLE = 3;
  const shownIdx = items.length <= VISIBLE
    ? items.map((_, n) => n)
    : idx < VISIBLE ? [0, 1, 2] : [0, 1, idx];
  const moreCount = items.length > VISIBLE ? items.length - VISIBLE : 0;
  const thumbs = items.length > 1 && (
    <div className="flex items-center gap-1.5">
      {shownIdx.map(n => (
        <button
          key={n}
          type="button"
          title={items[n].name}
          aria-label={`Show ${items[n].name}`}
          aria-current={n === idx}
          onClick={e => { e.stopPropagation(); select(n); }}
          className={`h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-white transition-all ${n === idx ? 'ring-2 ring-teal-600' : 'opacity-70 ring-1 ring-slate-200 hover:opacity-100'}`}
        >
          <img src={items[n].image} alt="" className="h-full w-full object-contain" loading="lazy" />
        </button>
      ))}
      {moreCount > 0 && (
        <button
          type="button"
          aria-label={`View all ${items.length} products`}
          onClick={e => { e.stopPropagation(); setPanelOpen(true); }}
          className="flex h-10 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-white px-2.5 text-[11px] font-bold text-teal-700 ring-1 ring-teal-600 hover:bg-teal-50"
        >
          +{moreCount} more
        </button>
      )}
    </div>
  );
  // Dot scroller (mobile): tap a dot or swipe the product section
  const dots = items.length > 1 && (
    <div className="flex items-center justify-center gap-1" role="tablist" aria-label="Products">
      {items.map((_, n) => (
        <button
          key={n}
          type="button"
          role="tab"
          aria-selected={n === idx}
          aria-label={`Product ${n + 1} of ${items.length}`}
          onClick={e => { e.stopPropagation(); select(n); }}
          className={`h-1.5 rounded-full transition-all ${n === idx ? 'w-4 bg-teal-600' : 'w-1.5 bg-slate-300'}`}
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
      if (Math.abs(dx) > 40) select((idx + (dx < 0 ? 1 : -1) + items.length) % items.length, dx < 0 ? 'next' : 'prev');
    },
  };

  const panel = panelOpen && (
    <CatalogPanel
      seller={seller}
      items={items}
      activeIdx={idx}
      onPick={n => { select(n); setPanelOpen(false); }}
      onClose={() => setPanelOpen(false)}
    />
  );

  const responseNode = seller.responseRate ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Phone className="h-3 w-3 text-teal-600" />
      <span className="font-semibold text-slate-700">{seller.responseRate}% response rate</span>
    </span>
  ) : null;

  const payPill = seller.hasTrustSEAL && (
    <a
      href={PAYMENT_PROTECTION_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
    >
      <ShieldCheck className="h-3 w-3 flex-shrink-0" />
      ₹5 Lac Payment Protection*
    </a>
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
      {priceAsked ? <><Check className="h-4 w-4" strokeWidth={3} />Requested</> : <><MessageSquare className="h-4 w-4" />Best Price</>}
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
      <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-sm">
        {ribbonEl}
        {nameNode}
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-600">
          <span className="inline-flex min-w-0 items-center gap-0.5"><MapPin className="h-3 w-3 flex-shrink-0" /><span className="max-w-[80px] truncate">{seller.city}</span></span>
          {seller.reviews > 0 && <>{dot}<span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="font-semibold text-slate-700">{seller.rating.toFixed(1)}</span></span></>}
          {seller.hasTrustSEAL && <>{dot}<span className="inline-flex items-center gap-0.5 font-semibold text-amber-700"><ShieldCheck className="h-3 w-3 text-amber-500" />TrustSEAL</span></>}
          {responseNode && <>{dot}{responseNode}</>}
        </div>
        {payPill && <div className="mt-1.5 flex justify-center">{payPill}</div>}

        <div {...swipe} className="relative mt-3 rounded-lg bg-slate-100/80 p-2.5">
          <div className="overflow-hidden">
            <div key={idx} className={`flex items-stretch gap-3 ${animClass}`}>
              <div className="min-h-[88px] w-24 flex-shrink-0">
                {productLink(<img src={item.image} alt="" className="h-full w-full rounded-md bg-white object-contain" loading="lazy" />, 'block h-full w-full')}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-semibold text-slate-800">{productLink(item.name, item.url ? 'hover:text-teal-700 hover:underline' : '')}</p>
                <div className="mt-1 space-y-1 text-[11px] leading-snug">
                  {specRows.map(r => (
                    <p key={r.key} className={`truncate ${r.match ? '-mx-1 rounded bg-teal-100 px-1 text-teal-800' : 'text-slate-600'}`}>
                      {r.match && <Check className="mr-0.5 inline h-3 w-3" strokeWidth={3} />}
                      <span className={r.match ? 'opacity-80' : 'text-slate-400'}>{r.key}:</span> <span className="font-medium">{r.value}</span>
                    </p>
                  ))}
                </div>
                <p className="mt-1.5 text-sm font-bold leading-tight text-teal-700">{priceNode}</p>
              </div>
            </div>
          </div>
          {dots && <div className="mt-2.5">{dots}</div>}
        </div>

        {servedLine && (
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-slate-700">
            <TrendingUp className="h-3 w-3 flex-shrink-0 text-slate-500" /><span>{servedLine}</span>
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">{bestPrice}{call}</div>
        {panel}
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
      <div className="mt-2 flex min-h-5 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-slate-700">
        {seller.reviews > 0 && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{seller.rating.toFixed(1)}</span>
          </span>
        )}
        {seller.hasTrustSEAL && <><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-amber-500" /><span className="font-semibold text-amber-700">TrustSEAL</span></span></>}
        {responseNode}
      </div>
      <div className="mt-1.5 flex h-5 justify-center">{payPill}</div>

      {/* 2. Catalog glimpse: image left; name + specs right; price and thumbnails below */}
      <div {...swipe} className="relative mt-3.5 rounded-xl bg-slate-100/80 p-3.5 text-left">
        <div className="overflow-hidden">
        <div key={idx} className={animClass}>
        <div className="flex items-start gap-3">
          <div className="h-[96px] w-[96px] flex-shrink-0">
            {productLink(<img src={item.image} alt="" className="h-full w-full rounded-lg bg-white object-contain" loading="lazy" />, 'block h-full w-full')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 min-h-[32px] text-xs font-semibold leading-snug text-slate-800">{productLink(item.name, item.url ? 'hover:text-teal-700 hover:underline underline-offset-2' : '')}</p>
            <div className="mt-2 min-h-[66px] space-y-1.5 text-[11px] leading-snug">
              {specRows.map(r => (
                <p key={r.key} title={r.match ? 'Matches your requirement' : undefined} className={`truncate ${r.match ? '-mx-1 rounded bg-teal-100 px-1 text-teal-800' : 'text-slate-600'}`}>
                  {r.match && <Check className="mr-0.5 inline h-3 w-3" strokeWidth={3} />}
                  <span className={r.match ? 'opacity-80' : 'text-slate-400'}>{r.key}:</span> <span className="font-medium">{r.value}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3.5 min-h-[24px] text-base font-bold leading-tight text-teal-700">{priceNode}</p>
        </div>
        </div>
        <div className="mt-3 min-h-[40px]">{thumbs}</div>
      </div>

      {/* 3. Why connect: buyers served, payment protection */}
      <div className="mt-3 flex min-h-[36px] items-center justify-center text-xs text-slate-700">
        {servedLine && (
          <p className="flex items-center justify-center gap-1.5 text-center leading-snug">
            <TrendingUp className="h-4 w-4 flex-shrink-0 text-slate-500" />
            <span>{servedLine}</span>
          </p>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">{bestPrice}{call}</div>
      {panel}
    </div>
  );
}
