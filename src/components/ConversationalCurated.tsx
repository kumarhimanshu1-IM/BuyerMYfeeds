import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowRight, SkipForward } from 'lucide-react';

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

// Friendlier, conversational phrasing per known spec id — falls back to a
// generic "Any preference on <label>?" for categories this map doesn't cover,
// so a new/unknown mcat's specs still work without needing copy added here.
const QUESTION_COPY: Record<string, string> = {
  quantity: "How many do you need?",
  power: "What power output works for you?",
  phase: "Single phase or three phase?",
  gentype: "Any preference on the type?",
};

function questionFor(section: FilterSectionLike): string {
  return QUESTION_COPY[section.id] ?? `Any preference on ${section.label}?`;
}

// The Ask AI landing experience — replaces the static two-column refine panel
// with a guided, chat-style walkthrough of the same spec data (one question at
// a time, AI-bubble + buyer-bubble), so the handoff from the Ask AI entry point
// doesn't go flat into a generic form. Buyers can still jump to Find Best Match
// as soon as any one answer is given — this never gates completion.
export default function ConversationalCurated({
  productName, specSections, specsLoading, activeFilters, toggleFilter,
  quantityValue, setQuantityValue, quantityUnit, setQuantityUnit, quantityUnits,
  hasActiveFilters, onFindBestMatch,
}: ConversationalCuratedProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = specSections;
  const currentSection = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [stepIndex, activeFilters.length]);

  function advance() {
    setStepIndex(i => Math.min(i + 1, steps.length));
  }

  function answerPill(section: FilterSectionLike, option: string) {
    toggleFilter(option, section);
    setAnswered(a => ({ ...a, [section.id]: true }));
    // Small delay so the buyer sees their own selection land before the next question appears.
    setTimeout(advance, 280);
  }

  function answerQuantity() {
    setAnswered(a => ({ ...a, quantity: true }));
    advance();
  }

  const answeredSummaries = steps.slice(0, stepIndex).filter(s => answered[s.id]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
        {/* Intro bubble */}
        <ChatBubble from="ai">
          <span className="font-semibold capitalize">{productName}</span> — got it. Let's narrow this down so I can find your best match.
        </ChatBubble>

        {/* Already-answered steps, collapsed as a short recap */}
        {answeredSummaries.map(section => (
          <div key={section.id} className="space-y-2">
            <ChatBubble from="ai">{questionFor(section)}</ChatBubble>
            <ChatBubble from="buyer">
              {section.type === 'quantity'
                ? `${quantityValue || '—'} ${quantityUnit}`
                : activeFilters.filter(f => section.options.includes(f)).join(', ') || 'Skipped'}
            </ChatBubble>
          </div>
        ))}

        {/* Current question */}
        {!specsLoading && currentSection && (
          <div className="space-y-2.5">
            <ChatBubble from="ai">{questionFor(currentSection)}</ChatBubble>

            {currentSection.type === 'quantity' ? (
              <div className="flex items-center gap-2 pl-9">
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={quantityValue}
                  onChange={e => setQuantityValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && quantityValue.trim()) answerQuantity(); }}
                  placeholder="Enter quantity"
                  className="w-28 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
                />
                <select
                  value={quantityUnit}
                  onChange={e => setQuantityUnit(e.target.value)}
                  className="px-2.5 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none"
                >
                  {quantityUnits.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  type="button"
                  onClick={answerQuantity}
                  disabled={!quantityValue.trim()}
                  aria-label="Next"
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white flex-shrink-0 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pl-9">
                {currentSection.options.map(option => {
                  const active = activeFilters.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => answerPill(currentSection, option)}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={advance}
              className="ml-9 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              <SkipForward className="w-3 h-3" />
              Skip this
            </button>
          </div>
        )}

        {isLastStep && stepIndex >= steps.length && (
          <ChatBubble from="ai">
            That's everything I need. Hit <span className="font-semibold">Find Best Match</span> below whenever you're ready.
          </ChatBubble>
        )}
      </div>

      {/* Pinned bottom CTA — always available, same "jump ahead anytime" behavior as the
          regular refine panel: unlocks as soon as one answer is given, never gated on
          finishing every question. */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 border-t border-slate-200">
        <button
          onClick={onFindBestMatch}
          disabled={!hasActiveFilters}
          className="w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-all duration-300 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Find Best Match
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ from, children }: { from: 'ai' | 'buyer'; children: React.ReactNode }) {
  if (from === 'ai') {
    return (
      <div className="flex items-start gap-2.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#1d8480] to-[#2e3192] flex-shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3 text-white" />
        </span>
        <p className="max-w-[85%] text-sm text-slate-800 bg-slate-50 rounded-2xl rounded-tl-sm px-3.5 py-2">
          {children}
        </p>
      </div>
    );
  }
  return (
    <div className="flex justify-end pl-9">
      <p className="max-w-[85%] text-sm font-medium text-white bg-teal-600 rounded-2xl rounded-tr-sm px-3.5 py-2">
        {children}
      </p>
    </div>
  );
}
