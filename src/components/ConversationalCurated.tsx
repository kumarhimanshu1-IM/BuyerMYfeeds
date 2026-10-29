import { useMemo, useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { FinalResultCard, type SellerCard } from './SearchModal';

interface FilterSectionLike {
  id: string;
  label: string;
  type: 'pill' | 'checkbox' | 'quantity';
  options: string[];
  singleSelect?: boolean;
}

interface ConversationalCuratedProps {
  productName: string;
  specSections: FilterSectionLike[];
  specsLoading: boolean;
  activeFilters: string[];
  toggleFilter: (filter: string, section?: FilterSectionLike) => void;
  quantityValue: string;
  setQuantityValue: (v: string) => void;
  quantityUnit: string;
  setQuantityUnit: (v: string) => void;
  quantityUnits: string[];
  hasActiveFilters: boolean;
  onFindBestMatch: () => void;
  // Full seller list (same data/shape the regular curated results screen uses) so the
  // right rail can render the exact same FinalResultCard, just re-ranked per answer.
  previewSellers: SellerCard[];
  bestMatchId: number | null;
  priceRequestedIds: number[];
  setPriceRequestedIds: React.Dispatch<React.SetStateAction<number[]>>;
}

// Plain-language question per known spec id — falls back to a generic
// "Any preference on <label>?" for categories this map doesn't cover, so a
// new/unknown mcat's specs still work without needing copy added here.
const QUESTION_COPY: Record<string, string> = {
  quantity: 'How many do you need?',
  power: 'What power output works for you?',
  phase: 'Single phase or three phase?',
  gentype: 'Any preference on the type?',
};

function questionFor(section: FilterSectionLike): string {
  return QUESTION_COPY[section.id] ?? `Any preference on ${section.label}?`;
}

// Ranks/filters the right-rail results as answers accumulate. Specs this demo
// data actually carries (power, e.g. "25 kVA") narrow the list; filters it has
// no matching field for (phase, type) still move the ranking — sellers are
// re-scored by rating/distance each time — so every answer visibly reorders
// or trims the list, even when it can't literally filter on that attribute.
function rankPreview(sellers: SellerCard[], activeFilters: string[]): SellerCard[] {
  const powerPick = activeFilters.find(f => /kva/i.test(f));
  const pool = powerPick
    ? sellers.filter(s => s.spec.toLowerCase() === powerPick.toLowerCase())
    : sellers;
  const base = pool.length > 0 ? pool : sellers;

  // Deterministic "re-ranking" nudge per extra filter answered, so the order
  // visibly shifts on each answer rather than just trimming the same list.
  const nudge = activeFilters.length;
  const scored = base.map(s => ({
    seller: s,
    score: s.rating * 10 - s.distance / 50 + ((s.id + nudge) % 3),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map(x => x.seller);
}

// The Ask AI landing experience, modelled on a search-engine AI split view:
// a left rail where the AI asks one spec question at a time and the buyer's
// answers build up a visible requirement summary, with Find Best Match as
// the hero action — and a right rail of matching sellers that re-ranks after
// every answer, always on screen rather than tucked below the fold.
export default function ConversationalCurated({
  productName, specSections, specsLoading, activeFilters, toggleFilter,
  quantityValue, setQuantityValue, quantityUnit, setQuantityUnit, quantityUnits,
  hasActiveFilters, onFindBestMatch, previewSellers,
  bestMatchId, priceRequestedIds, setPriceRequestedIds,
}: ConversationalCuratedProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = specSections;
  const total = steps.length;
  const currentSection = steps[stepIndex];
  const isDone = stepIndex >= total;
  const progressPct = total > 0 ? ((isDone ? total : stepIndex) / total) * 100 : 0;

  const preview = useMemo(
    () => rankPreview(previewSellers, activeFilters),
    [previewSellers, activeFilters]
  );

  function goTo(i: number) {
    setStepIndex(Math.max(0, Math.min(total, i)));
  }

  function answerPill(section: FilterSectionLike, option: string) {
    toggleFilter(option, section);
    goTo(stepIndex + 1);
  }

  // The requirement summary — one chip per spec the buyer has actually
  // answered, in question order, so "what I've told the AI" stays visible
  // and editable (tap a chip to jump back to that question) the whole time.
  const requirementChips = steps
    .map((section, i) => {
      const value = section.type === 'quantity'
        ? (quantityValue.trim() ? `${quantityValue} ${quantityUnit}` : null)
        : (activeFilters.find(f => section.options.includes(f)) ?? null);
      return value ? { section, i, value } : null;
    })
    .filter((x): x is { section: FilterSectionLike; i: number; value: string } => x !== null);

  return (
    <div className="flex-1 flex min-w-0" style={{ height: '100%' }}>
      {/* ── Left rail — AI asks, buyer answers, requirement builds up, Find Best Match is the hero ── */}
      <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col overflow-y-auto border-slate-200 md:border-r bg-white">
        <div className="flex-1 px-5 pt-4 pb-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 mb-3">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            AI match for <span className="font-bold capitalize text-slate-800">{productName}</span>
          </p>

          {total > 0 && (
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {specsLoading && <p className="text-sm text-slate-400 py-4">Loading specs…</p>}

          {!specsLoading && currentSection && !isDone && (
            <div className="mb-5">
              <div className="flex items-start gap-2.5 mb-3.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#1d8480] to-[#2e3192] flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </span>
                <p className="text-base font-semibold text-slate-900 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                  {questionFor(currentSection)}
                </p>
              </div>

              <div className="pl-9">
                {currentSection.type === 'quantity' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={quantityValue}
                      onChange={e => setQuantityValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && quantityValue.trim()) goTo(stepIndex + 1); }}
                      placeholder="Enter quantity"
                      className="w-28 h-10 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
                    />
                    <select
                      value={quantityUnit}
                      onChange={e => setQuantityUnit(e.target.value)}
                      className="h-10 px-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none"
                    >
                      {quantityUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {currentSection.options.map(option => {
                      const active = activeFilters.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => answerPill(currentSection, option)}
                          className={`flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-sm font-medium border transition-colors ${
                            active
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50/60'
                          }`}
                        >
                          {active && <Check className="w-3.5 h-3.5" />}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => goTo(stepIndex + 1)}
                  className="mt-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Skip this
                </button>
              </div>
            </div>
          )}

          {isDone && total > 0 && (
            <div className="flex items-center gap-2.5 mb-5">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#1d8480] to-[#2e3192] flex-shrink-0">
                <Check className="w-3.5 h-3.5 text-white" />
              </span>
              <p className="text-sm font-semibold text-slate-800">
                That's everything — hit Find Best Match, or tap a requirement below to change it.
              </p>
            </div>
          )}

          {/* Requirement so far — this is the spec the AI is building up from the buyer's
              answers; each chip is editable (jumps back to that question). */}
          {requirementChips.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 mb-2">Your requirement so far</p>
              <div className="flex flex-wrap gap-1.5">
                {requirementChips.map(({ section, i, value }) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => goTo(i)}
                    className="group flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-100 hover:border-teal-300 transition-colors"
                  >
                    <span className="text-teal-500">{section.label || section.id}:</span>
                    {value}
                    <X className="w-3 h-3 text-teal-400 group-hover:text-teal-700" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hero CTA — this is the AI doing the actual work across the full category,
            not just a step-nav button, so it gets the visual weight. */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3">
          <button
            onClick={onFindBestMatch}
            disabled={!hasActiveFilters}
            className="w-full py-3.5 rounded-xl text-white font-semibold transition-all duration-300 bg-gradient-to-r from-[#1d8480] to-[#2e3192] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5 shadow-sm"
          >
            <span className="flex items-center gap-1.5 text-sm">
              <Sparkles className="w-4 h-4" />
              Find Best Match
            </span>
            <span className="text-[11px] font-normal text-white/80">
              AI compares sellers across the category for you
            </span>
          </button>
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => goTo(stepIndex - 1)}
              className="mt-2 w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* ── Right rail — matching sellers, always visible, re-ranks after every answer.
          Same FinalResultCard the regular curated results screen uses, forced into its
          msite row layout (compact) since this rail is narrower than the desktop grid. ── */}
      <div className="hidden md:flex flex-1 flex-col min-w-0 bg-[#fafafa] overflow-y-auto">
        <div className="flex-shrink-0 px-5 pt-4 pb-2 sticky top-0 bg-[#fafafa]/95 backdrop-blur-sm">
          <p className="text-xs font-semibold text-slate-500">
            {hasActiveFilters ? 'Matching sellers · updated' : 'Sellers in this category'}
          </p>
        </div>
        <div
          key={activeFilters.join('|')}
          className="px-5 pb-5 grid grid-cols-2 gap-2.5 animate-loader-fade-in"
        >
          {preview.map(seller => (
            <FinalResultCard
              key={seller.id}
              seller={seller}
              isBestMatch={seller.id === bestMatchId && !!seller.isBestMatch}
              priceRequested={priceRequestedIds.includes(seller.id)}
              onAskPrice={() => setPriceRequestedIds(prev => prev.includes(seller.id) ? prev : [...prev, seller.id])}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
