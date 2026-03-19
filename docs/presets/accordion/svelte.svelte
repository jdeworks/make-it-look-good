<!-- snippet: content-accordion
     category: content
     rationale: components/navigation.md
     requires: tailwindcss
-->

<script>
  let { items = defaultItems, allowMultiple = false } = $props();
  let openIndex = $state(0);
  let openIndices = $state(new Set([0]));

  const defaultItems = [
    { id: 'return', question: 'What is your return policy?', answer: 'We offer a 30-day return policy for all unused items in their original packaging. Simply contact our support team to initiate a return, and we will provide a prepaid shipping label.' },
    { id: 'shipping', question: 'How long does shipping take?', answer: 'Standard shipping takes 5-7 business days. Expedited shipping (2-3 days) and overnight options are available at checkout for an additional fee.' },
    { id: 'international', question: 'Do you offer international shipping?', answer: 'Yes, we ship to over 50 countries worldwide. International shipping rates and delivery times vary by destination. Check our shipping calculator at checkout for exact costs.' },
    { id: 'tracking', question: 'How can I track my order?', answer: 'Once your order ships, you will receive an email with a tracking number. You can also track your order anytime from your account dashboard under "Order History."' },
    { id: 'payment', question: 'What payment methods do you accept?', answer: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay. All transactions are secured with 256-bit SSL encryption.' },
  ];

  function isOpen(idx) {
    return allowMultiple ? openIndices.has(idx) : openIndex === idx;
  }

  function toggle(idx) {
    if (allowMultiple) {
      const next = new Set(openIndices);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      openIndices = next;
    } else {
      openIndex = openIndex === idx ? -1 : idx;
    }
  }
</script>

<div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
  {#each items as item, idx (item.id)}
    <div>
      <h3>
        <button
          class="flex items-center justify-between w-full min-h-11 px-4 sm:px-6 py-4 text-left text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
          aria-expanded={isOpen(idx)}
          aria-controls={`accordion-panel-${item.id}`}
          onclick={() => toggle(idx)}
        >
          <span>{item.question}</span>
          <svg
            class={`w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 ml-4 transition-transform duration-200 ${isOpen(idx) ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </h3>
      <div
        id={`accordion-panel-${item.id}`}
        role="region"
        class="grid transition-[grid-template-rows] duration-200 ease-out"
        style={`grid-template-rows: ${isOpen(idx) ? '1fr' : '0fr'};`}
      >
        <div class="overflow-hidden">
          <p class="px-4 sm:px-6 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  {/each}
</div>
