import { useState } from 'react';
import { Sparkles, ArrowLeft, ArrowRight, Check } from 'lucide-react';

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

// The Ask AI landing experience — replaces the static two-column refine panel
// with a guided, one-question-at-a-time step flow over the same spec data
// (step counter + progress bar, same pill/quantity controls as the regular
// refine panel — no chat/avatar framing). Buyers can go back, skip a step, or
// jump to Find Best Match as soon as any one answer is given.
export default function ConversationalCurated({
  productName, specSections, specsLoading, activeFilters, toggleFilter,
  quantityValue, setQuantityValue, quantityUnit, setQuantityUnit, quantityUnits,
  hasActiveFilters, onFindBestMatch,
}: ConversationalCuratedProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = specSections;
  const total = steps.length;
  const currentSection = steps[stepIndex];
  const isDone = stepIndex >= total;
  const progressPct = total > 0 ? Math.min(100, (stepIndex / total) * 100) : 0;

  function goTo(i: number) {
    setStepIndex(Math.max(0, Math.min(total, i)));
  }

  function answerPill(section: FilterSectionLike, option: string) {
    toggleFilter(option, section);
    goTo(stepIndex + 1);
  }

  function answeredValueFor(section: FilterSectionLike): string | null {
    if (section.type === 'quantity') {
      return quantityValue.trim() ? `${quantityValue} ${quantityUnit}` : null;
    }
    const picked = activeFilters.filter(f => section.options.includes(f));
    return picked.length > 0 ? picked.join(', ') : null;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Header — product name + step progress, reads like a search step, not a chat */}
      <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3 border-b border-slate-100">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          AI match for <span className="font-bold capitalize text-slate-800">{productName}</span>
        </p>
        {total > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="flex-shrink-0 text-xs font-medium text-slate-400 tabular-nums">
              {Math.min(stepIndex + 1, total)} of {total}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
        {specsLoading && (
          <p className="text-sm text-slate-400">Loading specs…</p>
        )}

        {!specsLoading && currentSection && !isDone && (
          <div className="space-y-3.5">
            <p className="text-base font-semibold text-slate-800">{questionFor(currentSection)}</p>

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
                  className="w-32 px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
                />
                <select
                  value={quantityUnit}
                  onChange={e => setQuantityUnit(e.target.value)}
                  className="px-2.5 py-2.5 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none"
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
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-teal-50 border-teal-500 text-teal-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50/50'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isDone && (
          <div className="flex flex-col items-center justify-center text-center gap-2 py-8">
            <div className="w-11 h-11 rounded-full bg-teal-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-teal-600" />
            </div>
            <p className="text-sm font-semibold text-slate-800">All set.</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Hit Find Best Match below, or go back to change an answer.
            </p>
          </div>
        )}

        {/* Answered-so-far recap — compact row list, lets a buyer see/jump back without re-reading chat history */}
        {steps.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-1.5">
            {steps.map((section, i) => {
              const value = answeredValueFor(section);
              if (i === stepIndex && !isDone) return null;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => goTo(i)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xs text-slate-500 truncate">{section.label || section.id}</span>
                  <span className={`text-xs font-medium flex-shrink-0 ${value ? 'text-slate-700' : 'text-slate-300'}`}>
                    {value ?? 'Skipped'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pinned bottom nav — Back / Skip / Find Best Match. Find Best Match unlocks as soon as
          one answer is given, same gating as the regular refine panel, never requires finishing
          every step. */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 border-t border-slate-200 flex items-center gap-2">
        <button
          type="button"
          onClick={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          aria-label="Back"
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent flex-shrink-0 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {!isDone && currentSection && (
          <button
            type="button"
            onClick={() => goTo(stepIndex + 1)}
            className="flex items-center justify-center gap-1 h-10 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            Skip
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onFindBestMatch}
          disabled={!hasActiveFilters}
          className="flex-1 py-2.5 text-white text-sm font-semibold rounded-lg transition-all duration-300 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Find Best Match
        </button>
      </div>
    </div>
  );
}
