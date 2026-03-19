<!-- snippet: form-signup
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->

<script>
  let { onSubmit } = $props();

  let firstName = $state('');
  let lastName = $state('');
  let email = $state('');
  let phone = $state('');
  let password = $state('');
  let confirm = $state('');
  let company = $state('');
  let address = $state('');
  let city = $state('');
  let zip = $state('');
  let country = $state('');
  let state = $state('');
  let terms = $state(false);
  let errors = $state({});
  let loading = $state(false);

  function passwordStrength(pw) {
    if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' };
    let score = 0;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (pw.length >= 12) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-amber-500', width: 'w-1/2' };
    if (score <= 2) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
  }

  let strength = $derived(password ? passwordStrength(password) : null);

  function validate() {
    const errs = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (password !== confirm) errs.confirm = 'Passwords do not match';
    if (!address.trim()) errs.address = 'Address is required';
    if (!city.trim()) errs.city = 'City is required';
    if (!zip.trim()) errs.zip = 'ZIP is required';
    if (!country) errs.country = 'Country is required';
    if (!state) errs.state = 'State is required';
    if (!terms) errs.terms = 'You must accept the terms';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    errors = errs;
    if (Object.keys(errs).length > 0) return;
    loading = true;
    try {
      await onSubmit?.({ firstName, lastName, email, phone, password, company, address, city, zip, country, state });
    } finally {
      loading = false;
    }
  }

  function inputClass(field) {
    return `w-full bg-transparent border-0 border-b outline-none pb-2 text-base text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 transition-colors min-h-11 ${
      errors[field]
        ? 'border-b-red-500 dark:border-b-red-400'
        : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-400'
    }`;
  }

  function selectClass(field) {
    return `w-full bg-transparent border-0 border-b outline-none pb-2 text-base text-slate-900 dark:text-white transition-colors min-h-11 ${
      errors[field]
        ? 'border-b-red-500 dark:border-b-red-400'
        : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-400'
    }`;
  }
</script>

<form onsubmit={handleSubmit} class="flex flex-col gap-8" novalidate>
  <!-- First name -->
  <div>
    <label for="signup-first-name" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">First name</label>
    <input id="signup-first-name" type="text" bind:value={firstName} placeholder="Jane" class={inputClass('firstName')} autocomplete="given-name" />
    {#if errors.firstName}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.firstName}</p>
    {/if}
  </div>

  <!-- Last name -->
  <div>
    <label for="signup-last-name" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Last name</label>
    <input id="signup-last-name" type="text" bind:value={lastName} placeholder="Smith" class={inputClass('lastName')} autocomplete="family-name" />
    {#if errors.lastName}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.lastName}</p>
    {/if}
  </div>

  <!-- Email -->
  <div>
    <label for="signup-email" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Email address</label>
    <input id="signup-email" type="email" bind:value={email} placeholder="jane@example.com" class={inputClass('email')} autocomplete="email" />
    {#if errors.email}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
    {/if}
  </div>

  <!-- Phone -->
  <div>
    <label for="signup-phone" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Phone</label>
    <input id="signup-phone" type="tel" bind:value={phone} placeholder="+1 (555) 000-0000" class={inputClass('phone')} autocomplete="tel" />
  </div>

  <!-- Password -->
  <div>
    <label for="signup-password" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Password</label>
    <input id="signup-password" type="password" bind:value={password} class={inputClass('password')} autocomplete="new-password" />
    {#if strength}
      <div class="mt-2">
        <div class="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div class={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{strength.label}</p>
      </div>
    {/if}
    {#if errors.password}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
    {/if}
  </div>

  <!-- Confirm password -->
  <div>
    <label for="signup-confirm" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Confirm password</label>
    <input id="signup-confirm" type="password" bind:value={confirm} class={inputClass('confirm')} autocomplete="new-password" />
    {#if errors.confirm}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.confirm}</p>
    {/if}
  </div>

  <!-- Company -->
  <div>
    <label for="signup-company" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Company <span class="normal-case tracking-normal">(optional)</span></label>
    <input id="signup-company" type="text" bind:value={company} placeholder="Acme Inc." class={inputClass('company')} autocomplete="organization" />
  </div>

  <!-- Address -->
  <div>
    <label for="signup-address" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Address</label>
    <input id="signup-address" type="text" bind:value={address} placeholder="123 Main St" class={inputClass('address')} autocomplete="street-address" />
    {#if errors.address}
      <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.address}</p>
    {/if}
  </div>

  <!-- City & ZIP -->
  <div class="grid grid-cols-2 gap-6">
    <div>
      <label for="signup-city" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">City</label>
      <input id="signup-city" type="text" bind:value={city} placeholder="San Francisco" class={inputClass('city')} autocomplete="address-level2" />
      {#if errors.city}
        <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.city}</p>
      {/if}
    </div>
    <div>
      <label for="signup-zip" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">ZIP</label>
      <input id="signup-zip" type="text" bind:value={zip} placeholder="94102" class={inputClass('zip')} autocomplete="postal-code" />
      {#if errors.zip}
        <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.zip}</p>
      {/if}
    </div>
  </div>

  <!-- Country & State -->
  <div class="grid grid-cols-2 gap-6">
    <div>
      <label for="signup-country" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Country</label>
      <select id="signup-country" bind:value={country} class={selectClass('country')} autocomplete="country">
        <option value="">Select</option>
        <option>United States</option>
        <option>Canada</option>
        <option>United Kingdom</option>
      </select>
      {#if errors.country}
        <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.country}</p>
      {/if}
    </div>
    <div>
      <label for="signup-state" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">State</label>
      <select id="signup-state" bind:value={state} class={selectClass('state')} autocomplete="address-level1">
        <option value="">Select</option>
        <option>California</option>
        <option>New York</option>
        <option>Texas</option>
      </select>
      {#if errors.state}
        <p class="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.state}</p>
      {/if}
    </div>
  </div>

  <!-- Terms -->
  <label class="flex items-start gap-3 cursor-pointer min-h-11">
    <input type="checkbox" bind:checked={terms} class="mt-1 w-4 h-4 accent-blue-600" />
    <span class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
      I agree to the <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded">terms and conditions</a>
    </span>
  </label>
  {#if errors.terms}
    <p class="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>
  {/if}

  <!-- Submit -->
  <button type="submit" disabled={loading} class="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-4 min-h-11 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
    {#if loading}
      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
    {/if}
    {loading ? 'Creating account...' : 'Create Account'}
  </button>

  <!-- Helper links -->
  <p class="text-center text-sm text-slate-500 dark:text-slate-400">
    Already have an account? <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">Sign in</a>
  </p>
</form>
