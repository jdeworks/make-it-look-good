<!-- snippet: form-login
     category: forms
     rationale: components/forms.md
     requires: tailwindcss
-->
<script setup>
import { ref, reactive } from 'vue'

const emit = defineEmits(['submit'])

const email = ref('')
const password = ref('')
const errors = reactive({})
const loading = ref(false)

function validate() {
  const errs = {}
  if (!email.value) errs.email = 'Email is required'
  else if (!/\S+@\S+\.\S+/.test(email.value)) errs.email = 'Enter a valid email'
  if (!password.value) errs.password = 'Password is required'
  else if (password.value.length < 8) errs.password = 'Password must be at least 8 characters'
  return errs
}

async function handleSubmit() {
  Object.keys(errors).forEach(k => delete errors[k])
  const errs = validate()
  Object.assign(errors, errs)
  if (Object.keys(errs).length > 0) return

  loading.value = true
  try {
    emit('submit', { email: email.value, password: password.value })
  } finally {
    loading.value = false
  }
}

function inputClass(field) {
  return [
    'w-full border rounded-lg px-3 py-2.5 text-base bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-600 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-11',
    errors[field] ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
  ].join(' ')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
    <!-- Minimal header -->
    <header class="py-6 px-4 sm:px-6">
      <div class="max-w-7xl mx-auto">
        <a href="#" class="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none text-lg font-bold text-slate-900 dark:text-white">BrandName</a>
      </div>
    </header>

    <!-- Centered content -->
    <main class="flex-1 flex items-center justify-center px-4 pb-12">
      <div class="w-full max-w-md">
        <!-- Card -->
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
          <!-- Form header -->
          <div class="text-center mb-8">
            <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Welcome back</h1>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Sign in to your account to continue</p>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4" novalidate>
            <div>
              <label for="login-email" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <input
                id="login-email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                :class="inputClass('email')"
                autocomplete="email"
              >
              <p v-if="errors.email" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.email }}</p>
            </div>

            <div>
              <label for="login-password" class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <input
                id="login-password"
                v-model="password"
                type="password"
                placeholder="Enter your password"
                :class="inputClass('password')"
                autocomplete="current-password"
              >
              <p v-if="errors.password" class="mt-1.5 text-sm text-red-600 dark:text-red-400">{{ errors.password }}</p>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-base transition-colors min-h-11 flex items-center justify-center gap-2"
            >
              <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </button>
          </form>

          <!-- Footer link -->
          <p class="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Don't have an account? <a href="#" class="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none text-blue-700 dark:text-blue-400 hover:underline font-semibold">Sign up</a>
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
