import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Check, ChevronRight, Pencil, ArrowRight } from 'lucide-react';
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

// Contextual label for the "add an answer" affordance on a skipped question --
// named after what's missing (e.g. "+ Add power output") rather than a bare icon,
// so it reads as "answer this" rather than a generic edit control.
const ADD_PROMPT_COPY: Record<string, string> = {
  quantity: 'Add quantity',
  power: 'Add power output',
  phase: 'Add phase',
  gentype: 'Add type',
};

function addPromptFor(section: FilterSectionLike): string {
  return ADD_PROMPT_COPY[section.id] ?? `Add ${section.label.toLowerCase()}`;
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
  specSections, specsLoading, activeFilters, toggleFilter,
  quantityValue, setQuantityValue, quantityUnit, setQuantityUnit, quantityUnits,
  hasActiveFilters, onFindBestMatch, previewSellers,
  bestMatchId, priceRequestedIds, setPriceRequestedIds,
}: ConversationalCuratedProps) {
  const [stepIndex, setStepIndex] = useState(0);
  // Furthest point the buyer has ever reached. Editing an earlier answer (via the
  // history bubbles) moves stepIndex back, but every step between the edited one and
  // this frontier was already answered/skipped and shouldn't be re-walked or lost --
  // so after re-answering, we jump straight back to the frontier instead of just +1.
  const [maxStepReached, setMaxStepReached] = useState(0);

  const steps = specSections;
  const total = steps.length;

  const preview = useMemo(
    () => rankPreview(previewSellers, activeFilters),
    [previewSellers, activeFilters]
  );

  function goTo(i: number) {
    const clamped = Math.max(0, Math.min(total, i));
    setStepIndex(clamped);
    setMaxStepReached(m => Math.max(m, clamped));
  }

  // After answering/skipping, move on -- but never past less than the frontier already
  // reached, so editing an earlier question snaps back to where the buyer left off
  // rather than forcing them to re-click through every already-answered question again.
  function advancePast(i: number) {
    goTo(Math.max(i + 1, maxStepReached));
  }

  function answerPill(section: FilterSectionLike, option: string) {
    toggleFilter(option, section);
    advancePast(stepIndex);
  }

  function answerQuantity() {
    if (!quantityValue.trim()) return;
    advancePast(stepIndex);
  }

  // True once every question has been answered or skipped (no live question left to
  // render) -- this is the moment the CTA should stop looking like a step button and
  // start looking like the obvious next move.
  const allQuestionsDone = total > 0 && stepIndex >= total;

  // Keeps the live question in view as the chat grows, while the Find Best Match
  // footer below stays put — same feel as a real chat. Scrolls the live question
  // itself into view (not just the container's bottom) so that editing an earlier
  // answer brings the question back up right where it was clicked from, instead of
  // jumping all the way down past everything that comes after it.
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveQuestionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    liveQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [stepIndex]);

  // What the buyer actually answered for a given section — null when it was skipped
  // (or hasn't been reached yet), so skipped questions never get a fabricated reply.
  function answeredValueFor(section: FilterSectionLike): string | null {
    return section.type === 'quantity'
      ? (quantityValue.trim() ? `${quantityValue} ${quantityUnit}` : null)
      : (activeFilters.find(f => section.options.includes(f)) ?? null);
  }

  return (
    <div className="flex-1 flex min-w-0" style={{ height: '100%' }}>
      {/* ── Left rail — AI asks, buyer answers, requirement builds up, Find Best Match is the hero ── */}
      <div
        className="w-full md:flex-1 min-w-0 flex flex-col overflow-hidden border-slate-200 md:border-r bg-white"
        style={{ maxWidth: '430px' }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto results-scroll px-5 pt-4 pb-2">
          {specsLoading && (
            <div className="space-y-5 py-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-start gap-2.5 animate-pulse" style={{ animationDelay: `${i * 120}ms` }}>
                  <span className="w-7 h-7 rounded-full bg-slate-100 flex-shrink-0" />
                  <span className="h-8 rounded-2xl rounded-tl-sm bg-slate-100" style={{ width: `${70 - i * 12}%` }} />
                </div>
              ))}
            </div>
          )}

          {/* Chat, in question order. Every index up to the furthest the buyer has
              reached renders -- as a past Q&A bubble, or, at stepIndex, as the live
              question. Editing an earlier answer moves stepIndex back but never shrinks
              maxStepReached, so later already-answered questions stay put in the chat
              exactly where they are instead of disappearing until re-reached. */}
          {!specsLoading && steps.slice(0, Math.max(stepIndex + 1, maxStepReached)).map((section, i) => {
            if (i === stepIndex) {
              return (
                <div key={section.id} ref={liveQuestionRef} className="mb-5">
                  <div className="flex items-start gap-2.5 mb-3.5">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#1d8480] to-[#2e3192] flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </span>
                    <p className="text-sm font-semibold text-slate-900 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                      {questionFor(section)}
                    </p>
                  </div>

                  <div className="pl-9">
                    {section.type === 'quantity' ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoFocus
                          value={quantityValue}
                          onChange={e => setQuantityValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') answerQuantity(); }}
                          placeholder="Qty"
                          className="w-20 text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 transition-all"
                        />
                        {quantityUnits.map(unit => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => setQuantityUnit(unit)}
                            className={`text-sm px-3 py-2 rounded-full border transition-all ${
                              quantityUnit === unit
                                ? 'bg-teal-50 border-teal-500 text-teal-700 font-medium'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600'
                            }`}
                          >
                            {unit}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={answerQuantity}
                          disabled={!quantityValue.trim()}
                          aria-label="Continue"
                          className="flex items-center justify-center w-9 h-9 rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-30 disabled:cursor-not-allowed text-white flex-shrink-0 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {section.options.map(option => {
                          const active = activeFilters.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => answerPill(section, option)}
                              className={`flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-sm transition-all ${
                                active
                                  ? 'bg-teal-100 border-teal-600 text-teal-800 font-medium'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600'
                              }`}
                            >
                              {active && <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />}
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => advancePast(stepIndex)}
                      className="mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-teal-700 transition-colors group"
                    >
                      Skip this question
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            }

            const value = answeredValueFor(section);
            return (
              <div key={section.id} className="mb-4">
                <div className="flex items-start gap-2.5 mb-1.5">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#1d8480] to-[#2e3192] flex-shrink-0 mt-0.5 opacity-70">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </span>
                  <p className="text-sm font-medium text-slate-500 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2">
                    {questionFor(section)}
                  </p>
                </div>
                <div className="flex justify-end pl-9">
                  {value ? (
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      title="Tap to change your answer"
                      className="group relative flex items-center gap-1.5 text-sm font-medium text-teal-900 bg-[#d8efe7] hover:bg-[#c5e6db] rounded-2xl rounded-tr-sm pl-4 pr-3 py-2 transition-colors"
                    >
                      {value}
                      <Pencil className="w-3 h-3 flex-shrink-0 text-teal-700 opacity-0 -translate-x-1 group-hover:opacity-80 group-hover:translate-x-0 transition-all" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-teal-700 border border-dashed border-slate-200 hover:border-teal-300 rounded-full px-3 py-1.5 transition-colors"
                    >
                      + {addPromptFor(section)}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        </div>

        {/* Hero CTA — this is the AI doing the actual work across the full category,
            not just a step-nav button, so it gets the visual weight: layered gradient,
            an inner sheen, and a soft lift on hover instead of a flat filled button. */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3">
          {allQuestionsDone && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2 px-0.5 animate-loader-fade-in">
              <Check className="w-3 h-3 text-teal-600 animate-loader-check-pop" strokeWidth={3} />
              All set
            </p>
          )}
          <button
            onClick={onFindBestMatch}
            disabled={!hasActiveFilters}
            className={`group relative w-full py-3.5 rounded-2xl text-white font-semibold overflow-hidden transition-all duration-300 bg-teal-600 shadow-lg shadow-teal-900/25 ring-1 ring-white/15 hover:bg-teal-700 hover:shadow-xl hover:shadow-teal-900/30 hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
              allQuestionsDone ? 'animate-[cta-settle-glow_1.8s_ease-out_1]' : ''
            }`}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
            <Sparkles className="relative w-4 h-4 animate-[sparkle-pulse_1.6s_ease-in-out_infinite]" />
            <span className="relative text-sm tracking-wide">Find Best Match</span>
          </button>
        </div>
      </div>

      {/* ── Right rail — plain results, re-ranks after every answer. Same FinalResultCard
          the regular curated results screen uses, just given a shorter photo for this
          narrower column. ── */}
      <div
        className="hidden md:flex flex-1 flex-col min-w-0 bg-[#fafafa] overflow-y-auto"
        style={{ maxWidth: 450 }}
      >
        <div className="flex-shrink-0 px-5 pt-4 pb-1 sticky top-0 bg-[#fafafa]/95 backdrop-blur-sm">
          <p className="text-xs font-semibold text-slate-500">IndiaMART Search Results</p>
        </div>
        {preview.length === 0 && (
          <p className="px-5 pt-3 text-sm text-slate-500">
            No exact matches for that combination — showing closest options instead.
          </p>
        )}
        <div
          key={activeFilters.join('|')}
          className="px-5 pt-3 pb-5 grid grid-cols-2 gap-2.5 animate-loader-fade-in"
          style={{ gridTemplateColumns: 'repeat(2, minmax(0, 200px))' }}
        >
          {(preview.length > 0 ? preview : previewSellers).map(seller => (
            <FinalResultCard
              key={seller.id}
              seller={seller}
              photoHeight={110}
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
