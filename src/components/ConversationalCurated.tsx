import { useMemo, useState } from 'react';
import { Sparkles, Check, Star } from 'lucide-react';

interface FilterSectionLike {
  id: string;
  label: string;
  type: 'pill' | 'checkbox' | 'quantity';
  options: string[];
  singleSelect?: boolean;
}

// Minimal shape this widget needs from SearchModal's full SellerCard — kept
// narrow on purpose so this component doesn't depend on that type directly.
interface PreviewSeller {
  id: number;
  name: string;
  city: string;
  spec: string;
  price: string;
  priceUnit: string;
  rating: number;
  distance: number;
  image: string;
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
  previewSellers: PreviewSeller[];
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

// Ranks/filters the preview row as filters accumulate. Specs this demo data
// actually carries (power, e.g. "25 kVA") narrow the list; filters it has no
// matching field for (phase, type) still move the ranking — sellers are
// re-scored by rating/distance each time — so every answer visibly reorders
// or trims the row, even when it can't literally filter on that attribute.
function rankPreview(sellers: PreviewSeller[], activeFilters: string[]): PreviewSeller[] {
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
  return scored.slice(0, 4).map(x => x.seller);
}

// The Ask AI landing experience — a single, uncluttered one-question-at-a-time
// step over the same spec data the regular refine panel uses, with a live
// preview row of matching sellers underneath that updates after every answer.
// Progress line up top, the AI's question as a speech bubble, the answer
// control, the live card row, and one footer row (Back · Skip · Find Best
// Match). Buyers can jump to Find Best Match the moment any one answer is given.
export default function ConversationalCurated({
  productName, specSections, specsLoading, activeFilters, toggleFilter,
  quantityValue, setQuantityValue, quantityUnit, setQuantityUnit, quantityUnits,
  hasActiveFilters, onFindBestMatch, previewSellers,
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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Progress — one thin line, one label, nothing else competing for attention up top.
          Product name isn't repeated here — the modal header above already shows it. */}
      <div className="flex-shrink-0 px-5 md:px-8 pt-4 pb-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 mb-2">
          <Sparkles className="w-3 h-3 flex-shrink-0" />
          AI match for <span className="font-bold capitalize text-slate-800">{productName}</span>
        </p>
        <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-slate-400">
          {isDone ? 'All set' : `Question ${stepIndex + 1} of ${total}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-8 py-2 flex flex-col">
        {specsLoading && <p className="text-sm text-slate-400 py-6">Loading specs…</p>}

        {!specsLoading && currentSection && !isDone && (
          <div className="py-5">
            {/* AI message — small avatar + speech-bubble question, so the question itself
                still reads as the AI asking, not a bare form label */}
            <div className="flex items-start gap-2.5 mb-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#1d8480] to-[#2e3192] flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </span>
              <p className="text-base font-semibold text-slate-900 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[90%]">
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
                    className="w-32 h-11 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
                  />
                  <select
                    value={quantityUnit}
                    onChange={e => setQuantityUnit(e.target.value)}
                    className="h-11 px-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none"
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
                        className={`flex items-center gap-1.5 h-11 px-4 rounded-lg text-sm font-medium border transition-colors ${
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
            </div>
          </div>
        )}

        {isDone && (
          <div className="flex flex-col items-center justify-center text-center gap-2 py-6">
            <div className="w-11 h-11 rounded-full bg-teal-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-teal-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">That's everything.</p>
            <p className="text-xs text-slate-500">Hit Find Best Match below, or go back to change an answer.</p>
          </div>
        )}

        {/* Live preview row — reflects the picks so far; re-ranks/narrows after every
            answer so the buyer sees the match sharpen in real time, before committing
            to Find Best Match. */}
        {hasActiveFilters && preview.length > 0 && (
          <div className="mt-2 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 mb-2.5">Updating matches…</p>
            <div key={activeFilters.join('|')} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-loader-fade-in">
              {preview.map(seller => (
                <div
                  key={seller.id}
                  className="rounded-lg border border-slate-200 overflow-hidden bg-white"
                >
                  <img src={seller.image} alt={seller.name} className="w-full h-20 object-cover" />
                  <div className="p-2">
                    <p className="text-xs font-semibold text-slate-800 truncate">{seller.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{seller.spec} · {seller.city}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-semibold text-slate-900">{seller.price}</span>
                      <span className="flex items-center gap-0.5 text-[11px] text-amber-600">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        {seller.rating}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Single footer row — Back (text, appears once there's somewhere to go back to), Skip,
          Find Best Match. Find Best Match unlocks as soon as one filter is picked — same gating
          as the regular refine panel, never requires finishing every question — and leads into
          the same curated-results loader as the normal flow. */}
      <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 flex items-center gap-4">
        <button
          type="button"
          onClick={() => goTo(stepIndex - 1)}
          className={`text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors ${stepIndex === 0 ? 'invisible' : ''}`}
        >
          Back
        </button>
        {!isDone && currentSection && (
          <button
            type="button"
            onClick={() => goTo(stepIndex + 1)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip
          </button>
        )}
        <button
          onClick={onFindBestMatch}
          disabled={!hasActiveFilters}
          className="flex-1 h-11 text-white text-sm font-semibold rounded-lg transition-all duration-300 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Find Best Match
        </button>
      </div>
    </div>
  );
}
