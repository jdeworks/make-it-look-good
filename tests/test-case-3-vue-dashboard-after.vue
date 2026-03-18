<!--
  Test Case 3: Vue Dashboard Component (After)
  Improved version with proper spacing, accessibility, and visual hierarchy.
-->
<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#2563eb"/>
          <path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="sidebar-brand-text">Admin</span>
      </div>

      <nav>
        <ul>
          <li>
            <button
              :class="['nav-item', { active: tab === 'overview' }]"
              @click="tab = 'overview'"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              <span>Overview</span>
            </button>
          </li>
          <li>
            <button
              :class="['nav-item', { active: tab === 'users' }]"
              @click="tab = 'users'"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Users</span>
            </button>
          </li>
          <li>
            <button
              :class="['nav-item', { active: tab === 'orders' }]"
              @click="tab = 'orders'"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <span>Orders</span>
            </button>
          </li>
          <li>
            <button
              :class="['nav-item', { active: tab === 'settings' }]"
              @click="tab = 'settings'"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>Settings</span>
            </button>
          </li>
        </ul>
      </nav>
    </aside>

    <main class="main">
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">{{ pageTitle }}</h1>
          <p class="page-subtitle">{{ pageSubtitle }}</p>
        </div>
        <button v-if="tab === 'users'" class="btn btn-primary" @click="addUser">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add User
        </button>
      </div>

      <!-- Overview Tab -->
      <div v-if="tab === 'overview'" class="stats">
        <div class="stat-card">
          <span class="stat-label">Total Users</span>
          <span class="stat-value">{{ totalUsers.toLocaleString() }}</span>
          <span class="stat-trend trend-up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            +12% vs last month
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Revenue</span>
          <span class="stat-value">${{ revenue }}</span>
          <span class="stat-trend trend-up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            +8% vs last month
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Orders</span>
          <span class="stat-value">{{ orders }}</span>
          <span class="stat-trend trend-down">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
              <polyline points="17 18 23 18 23 12"/>
            </svg>
            -3% vs last month
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Conversion Rate</span>
          <span class="stat-value">{{ conversionRate }}%</span>
          <span class="stat-trend trend-up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            +0.4% vs last month
          </span>
        </div>
      </div>

      <!-- Users Tab -->
      <div v-if="tab === 'users'">
        <div class="search-wrapper">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="search"
            type="search"
            class="search-input"
            placeholder="Search users by name..."
          >
        </div>

        <!-- Table -->
        <div v-if="filteredUsers.length > 0" class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id">
                <td class="cell-name">{{ user.name }}</td>
                <td class="cell-email">{{ user.email }}</td>
                <td>
                  <span class="role-text">{{ user.role }}</span>
                </td>
                <td>
                  <span :class="['status-badge', user.active ? 'status-active' : 'status-inactive']">
                    <svg v-if="user.active" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    {{ user.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="cell-actions">
                  <button class="btn btn-ghost btn-sm" @click="editUser(user)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                  <button class="btn btn-danger-ghost btn-sm" @click="deleteUser(user)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <p class="empty-state-title">No users found</p>
          <p class="empty-state-text">No users match "{{ search }}". Try a different search term.</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const tab = ref('overview')
const search = ref('')
const totalUsers = ref(1247)
const revenue = ref('52,340')
const orders = ref(342)
const conversionRate = ref(3.2)

const users = ref([
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', active: true },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'User', active: true },
  { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'User', active: false },
  { id: 4, name: 'Dave Brown', email: 'dave@example.com', role: 'Editor', active: true },
  { id: 5, name: 'Eve Davis', email: 'eve@example.com', role: 'User', active: false },
])

const filteredUsers = computed(() =>
  users.value.filter(u => u.name.toLowerCase().includes(search.value.toLowerCase()))
)

const pageTitle = computed(() => tab.value.charAt(0).toUpperCase() + tab.value.slice(1))
const pageSubtitle = computed(() => {
  const subtitles = {
    overview: 'Key metrics and performance summary',
    users: `${users.value.length} total users`,
    orders: 'Manage customer orders',
    settings: 'Configure your workspace',
  }
  return subtitles[tab.value] || ''
})

const editUser = (user) => alert(`Edit ${user.name}`)
const deleteUser = (user) => { if (confirm(`Delete ${user.name}?`)) users.value = users.value.filter(u => u.id !== user.id) }
const addUser = () => alert('Add new user')
</script>

<style scoped>
/* ── Tokens ── */
:root {
  --sidebar-width: 240px;
  --sidebar-bg: #0f172a;
  --sidebar-active-bg: #2563eb;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-text: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;
  --color-border: #e2e8f0;
  --color-surface: #f8fafc;
  --color-success: #16a34a;
  --color-success-bg: #f0fdf4;
  --color-error: #dc2626;
  --color-error-bg: #fef2f2;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* ── Reset & Base ── */
.dashboard {
  display: flex;
  height: 100vh;
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
}

/* ── Focus Visible ── */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ── Sidebar ── */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--sidebar-bg);
  color: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0 24px;
}

.sidebar-brand-text {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  text-align: left;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-item.active {
  background: var(--sidebar-active-bg);
  color: #fff;
}

.nav-item:focus-visible {
  outline-color: #fff;
}

/* ── Main Content ── */
.main {
  flex: 1;
  padding: 24px;
  background: var(--color-surface);
  overflow-y: auto;
}

/* ── Page Header ── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
  color: var(--color-text);
}

.page-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 4px 0 0;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
}

.btn-primary {
  height: 40px;
  padding: 0 16px;
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-sm {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 13px;
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.btn-ghost:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.btn-danger-ghost {
  background: transparent;
  color: var(--color-error);
}

.btn-danger-ghost:hover {
  background: var(--color-error-bg);
  color: var(--color-error);
}

/* ── Stat Cards ── */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
}

.trend-up {
  color: var(--color-success);
}

.trend-down {
  color: var(--color-error);
}

/* ── Search ── */
.search-wrapper {
  position: relative;
  margin-bottom: 16px;
  width: 320px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 44px;
  padding: 0 12px 0 40px;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text);
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-input:hover {
  border-color: #cbd5e1;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

/* ── Table ── */
.table-container {
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  text-align: left;
  padding: 0 16px;
  height: 40px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

tbody td {
  padding: 0 16px;
  height: 44px;
  vertical-align: middle;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: var(--color-surface);
}

.cell-name {
  font-weight: 500;
  color: var(--color-text);
}

.cell-email {
  color: var(--color-text-secondary);
}

.role-text {
  color: var(--color-text-secondary);
}

.cell-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Status Badge ── */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.status-active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-inactive {
  background: var(--color-error-bg);
  color: var(--color-error);
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.empty-state-title {
  margin: 16px 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.empty-state-text {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}
</style>
