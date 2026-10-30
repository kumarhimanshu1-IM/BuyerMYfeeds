import { useEffect, useRef, useState } from 'react';
import { Sparkles, Check, ChevronRight, Pencil, ArrowRight, Image as ImageIcon, X } from 'lucide-react';
import { type SellerCard } from './SearchModal';

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

// Plain, uniform "Enter <label>" phrasing for every question -- no per-id copy
// needed, so a new/unknown mcat's specs work the same way without anything
// added here, and it stays consistent with the quantity field's own
// "Enter quantity here" placeholder.
function questionFor(section: FilterSectionLike): string {
  return `Enter ${section.label}`;
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


// The Ask AI landing experience, modelled on a search-engine AI split view:
// a left rail where the AI asks one spec question at a time and the buyer's
// answers build up a visible requirement summary, with Find Best Match as
// the hero action — and a right rail of matching sellers that re-ranks after
// every answer, always on screen rather than tucked below the fold.
export default function ConversationalCurated({
  productName, specSections, specsLoading, activeFilters, toggleFilter,
  quantityValue, setQuantityValue, quantityUnit, setQuantityUnit, quantityUnits,
  onFindBestMatch, previewSellers,
}: ConversationalCuratedProps) {
  const [stepIndex, setStepIndex] = useState(0);
  // Furthest point the buyer has ever reached. Editing an earlier answer (via the
  // history bubbles) moves stepIndex back, but every step between the edited one and
  // this frontier was already answered/skipped and shouldn't be re-walked or lost --
  // so after re-answering, we jump straight back to the frontier instead of just +1.
  const [maxStepReached, setMaxStepReached] = useState(0);

  const steps = specSections;
  const total = steps.length;

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
    // Empty value is a valid submit here -- it just advances, same as "I'm not sure",
    // so the button never needs to be disabled while the field is blank.
    advancePast(stepIndex);
  }

  // True once every question has been answered or skipped (no live question left to
  // render) -- this is the moment the CTA should stop looking like a step button and
  // start looking like the obvious next move. Find Best Match stays enabled even with
  // nothing answered -- landing here at all is enough intent to search.
  const allQuestionsDone = total > 0 && stepIndex >= total;

  // Keeps the live question in view as the chat grows, while the Find Best Match
  // footer below stays put — same feel as a real chat. Scrolls the live question
  // itself into view (not just the container's bottom) so that editing an earlier
  // answer brings the question back up right where it was clicked from, instead of
  // jumping all the way down past everything that comes after it.
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveQuestionRef = useRef<HTMLDivElement>(null);
  const closingMessageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    liveQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [stepIndex]);
  useEffect(() => {
    if (allQuestionsDone) closingMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [allQuestionsDone]);

  // What the buyer actually answered for a given section — null when it was skipped
  // (or hasn't been reached yet), so skipped questions never get a fabricated reply.
  function answeredValueFor(section: FilterSectionLike): string | null {
    return section.type === 'quantity'
      ? (quantityValue.trim() ? `${quantityValue} ${quantityUnit}` : null)
      : (activeFilters.find(f => section.options.includes(f)) ?? null);
  }

  // Spec rows for the requirement card -- only questions the buyer actually answered
  // (skipped ones are left out entirely, same rule as the chat's history bubbles). Keeps
  // each row's step index so clicking it can jump back to that question to edit it,
  // same as tapping an answered bubble in the chat does.
  const answeredSpecs = steps
    .map((section, i) => ({ stepIndex: i, label: section.label, value: answeredValueFor(section) }))
    .filter((row): row is { stepIndex: number; label: string; value: string } => row.value !== null);

  // Representative photo for the requirement card -- there's no dedicated category/mcat
  // image source wired in yet, so known product names get a real reference photo here;
  // anything else falls back to the first preview seller's photo as a stand-in.
  const requirementPhoto =
    productName.trim().toLowerCase().includes('diesel generator')
      ? 'https://5.imimg.com/data5/SELLER/Default/2022/3/UK/YY/WU/16312742/10kva-kirloskar-koel-diesel-generator-500x500.jpg'
      : previewSellers[0]?.image;

  // Buyer's own reference/spec image -- when provided, this takes over the card's
  // photo slot (it's what actually represents what they want) and overrides the
  // generic category photo above.
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImage(url => {
      if (url) URL.revokeObjectURL(url);
      return URL.createObjectURL(file);
    });
    e.target.value = '';
  }
  const cardPhoto = uploadedImage ?? requirementPhoto;

  // No logged-in buyer name is wired into this flow yet -- stand-in until real
  // session data reaches this component.
  const buyerFirstName = 'Abir';

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
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            autoFocus
                            value={quantityValue}
                            onChange={e => setQuantityValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') answerQuantity(); }}
                            placeholder="Enter quantity here"
                            className="flex-1 text-sm border-2 border-slate-900 rounded-full px-4 py-2.5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={answerQuantity}
                            aria-label="Continue"
                            className="flex items-center justify-center w-9 h-9 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex-shrink-0 transition-colors"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
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
                        </div>
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

                    {section.type !== 'quantity' && (
                      <button
                        type="button"
                        onClick={() => advancePast(stepIndex)}
                        className="mt-3 inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-teal-700 transition-colors group"
                      >
                        I'm not sure
                        <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
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
                      {/* Persistent, not hover-only -- a hover-gated hint is invisible on
                          touch devices, so this needs to always show the bubble is tappable. */}
                      <Pencil className="w-3 h-3 flex-shrink-0 text-teal-700 opacity-70 group-hover:opacity-100 transition-opacity" />
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

          {allQuestionsDone && (
            <div ref={closingMessageRef} className="flex items-start gap-2.5 mb-2 animate-loader-fade-in">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#1d8480] to-[#2e3192] flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </span>
              <p className="text-sm font-semibold text-slate-900 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                Your best matching suppliers are just a tap away.
              </p>
            </div>
          )}

        </div>

        {/* Hero CTA — this is the AI doing the actual work across the full category,
            not just a step-nav button, so it gets the visual weight: layered gradient,
            an inner sheen, and a soft lift on hover instead of a flat filled button. */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3">
          <button
            onClick={onFindBestMatch}
            className={`group relative w-full py-3.5 rounded-2xl text-white font-semibold overflow-hidden transition-all duration-300 bg-teal-600 shadow-lg shadow-teal-900/25 ring-1 ring-white/15 hover:bg-teal-700 hover:shadow-xl hover:shadow-teal-900/30 hover:-translate-y-0.5 flex items-center justify-center gap-1.5 ${
              allQuestionsDone ? 'animate-[cta-settle-glow_1.8s_ease-out_1]' : ''
            }`}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
            <Sparkles className="relative w-4 h-4 animate-[sparkle-pulse_1.6s_ease-in-out_infinite]" />
            <span className="relative text-sm tracking-wide">Find Best Match</span>
          </button>
        </div>
      </div>

      {/* ── Right rail — the requirement building up as a single product-style card.
          Vertically centred and sized to actually use the rail's space (rather than a
          small card floating in a mostly-empty column), with a richer layout: photo,
          product identity, a progress readout, then every answered spec as its own
          row with a teal check marker -- growing as the chat is answered. ── */}
      <div
        className="hidden md:flex flex-1 flex-col min-w-0 bg-[#fafafa] overflow-hidden"
        style={{ maxWidth: 450 }}
      >
        <div className="flex-shrink-0 px-5 pt-4 pb-1">
          <p className="text-xs font-semibold text-slate-500">Building {buyerFirstName}'s requirement</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-8">
          <div className="w-full max-w-[340px] rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {cardPhoto ? (
              <>
                <div className="relative w-full h-48 bg-white overflow-hidden flex items-center justify-center">
                  {/* object-contain, not object-cover -- the photo's own aspect ratio is kept intact
                      (no cropping/zooming into it), so a non-16:9 image just letterboxes within this
                      fixed rectangle rather than getting cut off or stretched. */}
                  <img src={cardPhoto} alt={productName} className="w-full h-full object-contain" />
                  {uploadedImage && (
                    <button
                      type="button"
                      onClick={() => setUploadedImage(url => { if (url) URL.revokeObjectURL(url); return null; })}
                      aria-label="Remove your photo"
                      className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-white/95 border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {/* Upload control sits in its own strip below the photo, not overlaid on top of
                    it -- an absolute badge was covering parts of the actual image. */}
                <label className="flex items-center justify-center gap-1.5 w-full py-2 border-y border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">
                    {uploadedImage ? 'Replace reference image' : 'Attach reference image'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1.5 w-full h-32 border-b border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">Attach reference image</span>
                <span className="text-[11px] text-slate-400">Helps suppliers quote against your exact requirement</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            )}
            <div className="p-5">
              <p className="text-base font-bold text-slate-900 capitalize truncate">{productName}</p>

              {answeredSpecs.length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {answeredSpecs.map(row => (
                    <button
                      type="button"
                      key={row.label}
                      onClick={() => goTo(row.stepIndex)}
                      title="Tap to change your answer"
                      className="group flex items-center gap-2.5 w-full text-left animate-loader-fade-in"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 flex-shrink-0">
                        <Check className="w-3 h-3 text-teal-600" strokeWidth={3} />
                      </span>
                      <span className="flex-1 flex items-baseline justify-between gap-3 text-sm min-w-0">
                        <span className="text-slate-500 flex-shrink-0">{row.label}</span>
                        <span className="font-semibold text-slate-900 text-right truncate underline decoration-dotted decoration-transparent underline-offset-2 group-hover:decoration-teal-500 group-hover:text-teal-700 transition-colors">
                          {row.value}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
