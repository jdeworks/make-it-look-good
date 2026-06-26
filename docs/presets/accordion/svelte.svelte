<!-- snippet: content-accordion
     category: content
     rationale: components/navigation.md
     requires: tailwindcss
-->

<script>
  const generalItems = [
    { id: 'accordion-panel-1', question: 'What is your return policy?', answer: '30-day returns on unused items in original packaging.' },
    { id: 'accordion-panel-2', question: 'How long does shipping take?', answer: 'Standard: 5–7 days. Expedited options available at checkout.' },
    { id: 'accordion-panel-3', question: 'What payment methods do you accept?', answer: 'Cards, PayPal, Apple Pay, and Google Pay accepted.' },
  ];

  const accountItems = [
    { id: 'accordion-multi-1', question: 'How do I change my subscription?', answer: 'Change your plan anytime from Account Settings.' },
    { id: 'accordion-multi-2', question: 'Can I get a refund?', answer: 'Full refunds available within 14 days of purchase.' },
  ];

  let openSingle = $state(0);
  let openMulti = $state(new Set());

  function toggleSingle(idx) {
    openSingle = openSingle === idx ? -1 : idx;
  }

  function toggleMulti(idx) {
    const next = new Set(openMulti);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    openMulti = next;
  }
</script>

<div class="min-h-screen flex flex-col justify-center items-center py-4 px-4 sm:p-8 bg-slate-50 dark:bg-slate-900">
  <main class="w-full max-w-2xl">
    <div class="space-y-8">

      <!-- FAQ Header -->
      <header class="text-center">
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
      </header>

      <!-- Single open section -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-3">General</h3>
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700" aria-label="Frequently asked questions">
          {#each generalItems as item, idx (item.id)}
            <div class={`accordion-item${openSingle === idx ? ' border-l-[3px] border-l-blue-700 dark:border-l-blue-400 pl-0' : ''}`}>
              <h4>
                <button
                  class="flex items-center justify-between w-full min-h-11 px-4 sm:px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                  aria-expanded={openSingle === idx}
                  aria-controls={item.id}
                  onclick={() => toggleSingle(idx)}
                >
                  <span>{item.question}</span>
                  <svg
                    class={`w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0 ml-4 transition-transform duration-200${openSingle === idx ? ' rotate-180' : ''}`}
                    fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </h4>
              <div
                id={item.id}
                role="region"
                aria-hidden={openSingle !== idx ? true : undefined}
                class={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${openSingle === idx ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div class="min-h-0 overflow-hidden">
                  <div class="px-4 sm:px-6 pb-4">
                    <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Multi open section -->
      <div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-3">Account &amp; Billing</h3>
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700" aria-label="Account questions">
          {#each accountItems as item, idx (item.id)}
            <div class={`accordion-item${openMulti.has(idx) ? ' border-l-[3px] border-l-blue-700 dark:border-l-blue-400 pl-0' : ''}`}>
              <h4>
                <button
                  class="flex items-center justify-between w-full min-h-11 px-4 sm:px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                  aria-expanded={openMulti.has(idx)}
                  aria-controls={item.id}
                  onclick={() => toggleMulti(idx)}
                >
                  <span>{item.question}</span>
                  <svg
                    class={`w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0 ml-4 transition-transform duration-200${openMulti.has(idx) ? ' rotate-180' : ''}`}
                    fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </h4>
              <div
                id={item.id}
                role="region"
                aria-hidden={!openMulti.has(idx) ? true : undefined}
                class={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${openMulti.has(idx) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div class="min-h-0 overflow-hidden">
                  <div class="px-4 sm:px-6 pb-4">
                    <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

    </div>
  </main>
</div>
