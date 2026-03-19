<!-- snippet: form-signup
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->
<script setup>
import { ref, reactive, computed } from 'vue'

const emit = defineEmits(['submit'])

const form = reactive({
  firstName: '', lastName: '', email: '', phone: '',
  password: '', confirm: '', company: '', address: '',
  city: '', zip: '', country: '', state: '', terms: false
})
const errors = reactive({})
const loading = ref(false)

function passwordStrength(pw) {
  if (pw.length < 8) return { label: 'Too short', color: 'bg-red-500', width: 'w-1/4' }
  let score = 0
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  if (pw.length >= 12) score++
  if (score <= 1) return { label: 'Weak', color: 'bg-amber-500', width: 'w-1/2' }
  if (score <= 2) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' }
  return { label: 'Strong', color: 'bg-green-500', width: 'w-full' }
}

const strength = computed(() => form.password ? passwordStrength(form.password) : null)

function validate() {
  const errs = {}
  if (!form.firstName.trim()) errs.firstName = 'First name is required'
  if (!form.lastName.trim()) errs.lastName = 'Last name is required'
  if (!form.email) errs.email = 'Email is required'
  else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email'
  if (!form.password) errs.password = 'Password is required'
  else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
  if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
  if (!form.address.trim()) errs.address = 'Address is required'
  if (!form.city.trim()) errs.city = 'City is required'
  if (!form.zip.trim()) errs.zip = 'ZIP is required'
  if (!form.country) errs.country = 'Country is required'
  if (!form.state) errs.state = 'State is required'
  if (!form.terms) errs.terms = 'You must accept the terms'
  return errs
}

async function handleSubmit() {
  Object.keys(errors).forEach(k => delete errors[k])
  const errs = validate()
  Object.assign(errors, errs)
  if (Object.keys(errs).length > 0) return
  loading.value = true
  try {
    emit('submit', { ...form })
  } finally {
    loading.value = false
  }
}

function inputClass(field) {
  return [
    'w-full bg-transparent border-0 border-b outline-none pb-2 text-base text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 transition-colors min-h-11',
    errors[field]
      ? 'border-b-red-500 dark:border-b-red-400'
      : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-400'
  ].join(' ')
}

function selectClass(field) {
  return [
    'w-full bg-transparent border-0 border-b outline-none pb-2 text-base text-slate-900 dark:text-white transition-colors min-h-11',
    errors[field]
      ? 'border-b-red-500 dark:border-b-red-400'
      : 'border-slate-300 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-400'
  ].join(' ')
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="flex flex-col gap-8" novalidate>
    <!-- First name -->
    <div>
      <label for="signup-first-name" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">First name</label>
      <input id="signup-first-name" v-model="form.firstName" type="text" placeholder="Jane" :class="inputClass('firstName')" autocomplete="given-name">
      <p v-if="errors.firstName" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.firstName }}</p>
    </div>

    <!-- Last name -->
    <div>
      <label for="signup-last-name" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Last name</label>
      <input id="signup-last-name" v-model="form.lastName" type="text" placeholder="Smith" :class="inputClass('lastName')" autocomplete="family-name">
      <p v-if="errors.lastName" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.lastName }}</p>
    </div>

    <!-- Email -->
    <div>
      <label for="signup-email" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Email address</label>
      <input id="signup-email" v-model="form.email" type="email" placeholder="jane@example.com" :class="inputClass('email')" autocomplete="email">
      <p v-if="errors.email" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.email }}</p>
    </div>

    <!-- Phone -->
    <div>
      <label for="signup-phone" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Phone</label>
      <input id="signup-phone" v-model="form.phone" type="tel" placeholder="+1 (555) 000-0000" :class="inputClass('phone')" autocomplete="tel">
    </div>

    <!-- Password -->
    <div>
      <label for="signup-password" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Password</label>
      <input id="signup-password" v-model="form.password" type="password" :class="inputClass('password')" autocomplete="new-password">
      <div v-if="strength" class="mt-2">
        <div class="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
          <div :class="['h-full rounded-full transition-all duration-300', strength.color, strength.width]" />
        </div>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ strength.label }}</p>
      </div>
      <p v-if="errors.password" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.password }}</p>
    </div>

    <!-- Confirm password -->
    <div>
      <label for="signup-confirm" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Confirm password</label>
      <input id="signup-confirm" v-model="form.confirm" type="password" :class="inputClass('confirm')" autocomplete="new-password">
      <p v-if="errors.confirm" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.confirm }}</p>
    </div>

    <!-- Company -->
    <div>
      <label for="signup-company" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Company <span class="normal-case tracking-normal">(optional)</span></label>
      <input id="signup-company" v-model="form.company" type="text" placeholder="Acme Inc." :class="inputClass('company')" autocomplete="organization">
    </div>

    <!-- Address -->
    <div>
      <label for="signup-address" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Address</label>
      <input id="signup-address" v-model="form.address" type="text" placeholder="123 Main St" :class="inputClass('address')" autocomplete="street-address">
      <p v-if="errors.address" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.address }}</p>
    </div>

    <!-- City & ZIP -->
    <div class="grid grid-cols-2 gap-6">
      <div>
        <label for="signup-city" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">City</label>
        <input id="signup-city" v-model="form.city" type="text" placeholder="San Francisco" :class="inputClass('city')" autocomplete="address-level2">
        <p v-if="errors.city" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.city }}</p>
      </div>
      <div>
        <label for="signup-zip" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">ZIP</label>
        <input id="signup-zip" v-model="form.zip" type="text" placeholder="94102" :class="inputClass('zip')" autocomplete="postal-code">
        <p v-if="errors.zip" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.zip }}</p>
      </div>
    </div>

    <!-- Country & State -->
    <div class="grid grid-cols-2 gap-6">
      <div>
        <label for="signup-country" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">Country</label>
        <select id="signup-country" v-model="form.country" :class="selectClass('country')" autocomplete="country">
          <option value="">Select</option>
          <option>United States</option>
          <option>Canada</option>
          <option>United Kingdom</option>
        </select>
        <p v-if="errors.country" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.country }}</p>
      </div>
      <div>
        <label for="signup-state" class="block text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 mb-2">State</label>
        <select id="signup-state" v-model="form.state" :class="selectClass('state')" autocomplete="address-level1">
          <option value="">Select</option>
          <option>California</option>
          <option>New York</option>
          <option>Texas</option>
        </select>
        <p v-if="errors.state" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.state }}</p>
      </div>
    </div>

    <!-- Terms -->
    <label class="flex items-start gap-3 cursor-pointer min-h-11">
      <input v-model="form.terms" type="checkbox" class="mt-1 w-4 h-4 accent-blue-600">
      <span class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        I agree to the <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded">terms and conditions</a>
      </span>
    </label>
    <p v-if="errors.terms" class="text-sm text-red-600 dark:text-red-400">{{ errors.terms }}</p>

    <!-- Submit -->
    <button type="submit" :disabled="loading" class="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-4 min-h-11 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      {{ loading ? 'Creating account...' : 'Create Account' }}
    </button>

    <!-- Helper links -->
    <p class="text-center text-sm text-slate-500 dark:text-slate-400">
      Already have an account? <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">Sign in</a>
    </p>
  </form>
</template>
