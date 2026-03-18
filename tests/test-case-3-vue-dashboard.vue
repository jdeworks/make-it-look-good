<!--
  Test Case 3: Vue Dashboard Component
  A developer's internal admin tool. Functional but ugly.
  They'd say: "Our team hates using this. Can you make it not suck?"
-->
<template>
  <div class="dashboard">
    <div class="sidebar">
      <h3>Admin</h3>
      <ul>
        <li :class="{ active: tab === 'overview' }" @click="tab = 'overview'">Overview</li>
        <li :class="{ active: tab === 'users' }" @click="tab = 'users'">Users</li>
        <li :class="{ active: tab === 'orders' }" @click="tab = 'orders'">Orders</li>
        <li :class="{ active: tab === 'settings' }" @click="tab = 'settings'">Settings</li>
      </ul>
    </div>
    <div class="main">
      <h2>{{ tab.charAt(0).toUpperCase() + tab.slice(1) }}</h2>

      <div v-if="tab === 'overview'" class="stats">
        <div class="stat"><b>{{ totalUsers }}</b><br><small>Users</small></div>
        <div class="stat"><b>${{ revenue }}</b><br><small>Revenue</small></div>
        <div class="stat"><b>{{ orders }}</b><br><small>Orders</small></div>
        <div class="stat"><b>{{ conversionRate }}%</b><br><small>Conv. Rate</small></div>
      </div>

      <div v-if="tab === 'users'">
        <input v-model="search" placeholder="Search users..." style="margin-bottom: 10px; padding: 3px; width: 200px;">
        <table>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role }}</td>
            <td :style="{ color: user.active ? 'green' : 'red' }">{{ user.active ? 'Active' : 'Inactive' }}</td>
            <td>
              <button @click="editUser(user)" style="font-size: 11px; padding: 2px 6px; margin-right: 3px;">Edit</button>
              <button @click="deleteUser(user)" style="font-size: 11px; padding: 2px 6px; color: red;">Delete</button>
            </td>
          </tr>
        </table>
      </div>
    </div>
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

const editUser = (user) => alert(`Edit ${user.name}`)
const deleteUser = (user) => { if(confirm(`Delete ${user.name}?`)) users.value = users.value.filter(u => u.id !== user.id) }
</script>

<style scoped>
.dashboard { display: flex; height: 100vh; font-family: Arial; font-size: 13px; }
.sidebar { width: 150px; background: #2c3e50; color: white; padding: 10px; }
.sidebar h3 { margin: 0 0 15px 0; font-size: 14px; }
.sidebar ul { list-style: none; padding: 0; margin: 0; }
.sidebar li { padding: 6px 8px; cursor: pointer; border-radius: 3px; margin-bottom: 2px; }
.sidebar li:hover { background: #34495e; }
.sidebar li.active { background: #3498db; }
.main { flex: 1; padding: 15px; background: #f5f5f5; }
.main h2 { margin: 0 0 10px 0; font-size: 16px; }
.stats { display: flex; gap: 10px; }
.stat { background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px; text-align: center; min-width: 100px; }
.stat b { font-size: 18px; }
.stat small { color: #999; font-size: 11px; }
table { width: 100%; border-collapse: collapse; background: white; }
th { text-align: left; padding: 6px 8px; background: #f0f0f0; font-size: 11px; border-bottom: 2px solid #ddd; }
td { padding: 6px 8px; border-bottom: 1px solid #eee; }
input { border: 1px solid #ccc; border-radius: 3px; }
</style>
