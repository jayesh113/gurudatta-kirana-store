// ==========================================================
// GURUDATTA KIRANA AND GENERAL STORES
// Dual View: Amazon-Style Customer Storefront + Owner Admin Panel
// ==========================================================

let allProducts = [];
let allCustomers = [];
let customerCart = [];
let posCart = [];
let isAdmin = false;
let selectedCustomerCategory = 'All';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  // Check saved admin state
  if (sessionStorage.getItem('gk_is_admin') === 'true') {
    isAdmin = true;
    updateAdminUI();
  }

  loadProducts();
  loadCustomerDropdown();
  loadCustomerCartFromStorage();
});

// ----------------------------------------------------------
// NOTIFICATIONS & FORMATTING
// ----------------------------------------------------------
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  msg.innerText = message;
  
  if (isError) {
    toast.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-2xl transition-all transform z-50 text-xs font-bold flex items-center gap-2';
  } else {
    toast.className = 'fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl transition-all transform z-50 text-xs font-bold flex items-center gap-2';
  }

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2500);
}

function formatCurrency(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ----------------------------------------------------------
// DATA LOADING
// ----------------------------------------------------------
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.status === 'success') {
      allProducts = data.products;
      renderCustomerCategoryPills();
      renderCustomerStore();
      renderAdminInventory();
      renderPosProducts();
      updateAdminLowBadge();
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

// ==========================================================
// 1. AMAZON-STYLE CUSTOMER STOREFRONT
// ==========================================================

function renderCustomerCategoryPills() {
  const pillsContainer = document.getElementById('customer-category-pills');
  if (!pillsContainer) return;

  const categories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
  
  let html = `
    <button onclick="setCustomerCategory('All')" class="cat-pill ${selectedCustomerCategory === 'All' ? 'bg-amber-600 text-white font-bold' : 'bg-white text-slate-700 font-semibold'} border border-slate-200 px-4 py-2 rounded-full text-xs whitespace-nowrap shadow-xs transition">
      🛒 All Items
    </button>
  `;

  categories.forEach(cat => {
    const active = selectedCustomerCategory === cat;
    html += `
      <button onclick="setCustomerCategory('${cat}')" class="cat-pill ${active ? 'bg-amber-600 text-white font-bold' : 'bg-white text-slate-700 font-semibold'} border border-slate-200 px-4 py-2 rounded-full text-xs whitespace-nowrap shadow-xs transition">
        ${cat}
      </button>
    `;
  });

  pillsContainer.innerHTML = html;
}

function setCustomerCategory(category) {
  selectedCustomerCategory = category;
  renderCustomerCategoryPills();
  renderCustomerStore();
}

function filterCustomerProducts() {
  const searchInput = document.getElementById('customer-search-input');
  const clearBtn = document.getElementById('customer-search-clear');
  if (clearBtn) {
    if (searchInput.value.trim().length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }
  renderCustomerStore();
}

function clearCustomerSearch() {
  const searchInput = document.getElementById('customer-search-input');
  if (searchInput) searchInput.value = '';
  filterCustomerProducts();
}

function renderCustomerStore() {
  const grid = document.getElementById('customer-products-grid');
  const countLabel = document.getElementById('customer-product-count');
  const search = (document.getElementById('customer-search-input')?.value || '').toLowerCase().trim();

  if (!grid) return;

  const filtered = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search);
    const matchesCat = (selectedCustomerCategory === 'All' || p.category === selectedCustomerCategory);
    return matchesSearch && matchesCat;
  });

  if (countLabel) {
    countLabel.innerText = `${filtered.length} products in store`;
  }

  // Empty state: No products
  if (allProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 p-6">
        <div class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <i data-lucide="store" class="w-7 h-7"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">Store Catalog is Being Prepared</h3>
        <p class="text-xs text-slate-500 mt-1 mb-4">No items added yet. If you are the owner, please log in to add products.</p>
        <button onclick="openOwnerLoginModal()" class="px-4 py-2 bg-slate-900 hover:bg-black text-amber-400 text-xs font-bold rounded-xl shadow transition inline-flex items-center gap-1.5">
          <i data-lucide="lock" class="w-4 h-4"></i>
          <span>Shop Owner Login</span>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 text-slate-300"></i>
        <p class="text-sm font-semibold text-slate-600">No products found matching "${search}"</p>
        <button onclick="clearCustomerSearch()" class="mt-3 text-xs text-amber-700 font-bold hover:underline">Show All Products</button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Render Amazon / Blinkit style Product Cards
  grid.innerHTML = filtered.map(p => {
    const inCartItem = customerCart.find(i => i.product_id === p.id);
    const inCartQty = inCartItem ? inCartItem.quantity : 0;
    const isOutOfStock = p.stock_quantity <= 0;

    return `
      <div class="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition group">
        <div>
          <!-- Category & Unit Pill -->
          <div class="flex justify-between items-center mb-1.5">
            <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[90px]">
              ${p.category}
            </span>
            <span class="text-[10px] font-semibold text-slate-500 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded text-amber-900">
              1 ${p.unit}
            </span>
          </div>

          <!-- Product Name -->
          <h4 class="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 min-h-[36px] group-hover:text-amber-700 transition">
            ${p.name}
          </h4>
        </div>

        <!-- Price & Add Button Row -->
        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-slate-400 block leading-none">Price:</span>
            <span class="text-sm sm:text-base font-black text-slate-900">${formatCurrency(p.selling_price)}</span>
          </div>

          <!-- Add / Quantity Controls -->
          <div>
            ${isOutOfStock ? `
              <span class="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-200">
                Out of Stock
              </span>
            ` : inCartQty > 0 ? `
              <div class="flex items-center bg-amber-500 text-slate-950 rounded-xl overflow-hidden font-black text-xs shadow-xs">
                <button onclick="updateCustomerCartQty(${p.id}, -1)" class="px-2.5 py-1.5 hover:bg-amber-600 transition">-</button>
                <span class="px-2 py-1 font-bold text-xs">${inCartQty}</span>
                <button onclick="updateCustomerCartQty(${p.id}, 1)" class="px-2.5 py-1.5 hover:bg-amber-600 transition">+</button>
              </div>
            ` : `
              <button 
                onclick="addToCustomerCart(${p.id})" 
                class="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1"
              >
                <span>+ ADD</span>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------------
// CUSTOMER CART & WHATSAPP ORDER
// ----------------------------------------------------------

function addToCustomerCart(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  const existing = customerCart.find(i => i.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    customerCart.push({
      product_id: prod.id,
      name: prod.name,
      unit: prod.unit,
      selling_price: prod.selling_price,
      quantity: 1
    });
  }

  saveCustomerCart();
  syncCustomerCartUI();
  showToast(`Added ${prod.name} to cart`);
}

function updateCustomerCartQty(productId, delta) {
  const item = customerCart.find(i => i.product_id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeCustomerCartItem(productId);
  } else {
    saveCustomerCart();
    syncCustomerCartUI();
  }
}

function removeCustomerCartItem(productId) {
  customerCart = customerCart.filter(i => i.product_id !== productId);
  saveCustomerCart();
  syncCustomerCartUI();
  showToast('Item removed from cart');
}

function saveCustomerCart() {
  localStorage.setItem('gk_customer_cart', JSON.stringify(customerCart));
}

function loadCustomerCartFromStorage() {
  try {
    const saved = localStorage.getItem('gk_customer_cart');
    if (saved) customerCart = JSON.parse(saved);
  } catch (e) {
    customerCart = [];
  }
  syncCustomerCartUI();
}

function syncCustomerCartUI() {
  const cartBar = document.getElementById('customer-cart-bar');
  const countSpan = document.getElementById('c-cart-count');
  const totalSpan = document.getElementById('c-cart-total');
  const navBadge = document.getElementById('nav-cart-badge');

  const totalQty = customerCart.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = customerCart.reduce((sum, i) => sum + (i.selling_price * i.quantity), 0);

  if (navBadge) navBadge.innerText = totalQty;

  if (cartBar) {
    if (totalQty > 0) {
      cartBar.classList.remove('hidden');
      if (countSpan) countSpan.innerText = totalQty;
      if (totalSpan) totalSpan.innerText = formatCurrency(totalAmount);
    } else {
      cartBar.classList.add('hidden');
    }
  }

  renderCustomerStore();
  renderCustomerCartModalItems();
}

function openCustomerCartModal() {
  renderCustomerCartModalItems();
  openModal('customer-cart-modal');
}

function renderCustomerCartModalItems() {
  const container = document.getElementById('customer-cart-items-list');
  const totalDisplay = document.getElementById('customer-modal-total');
  if (!container) return;

  const totalAmount = customerCart.reduce((sum, i) => sum + (i.selling_price * i.quantity), 0);
  if (totalDisplay) totalDisplay.innerText = formatCurrency(totalAmount);

  if (customerCart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <i data-lucide="shopping-bag" class="w-10 h-10 mx-auto mb-2 text-slate-300"></i>
        <p class="text-xs font-semibold text-slate-600">Your basket is empty</p>
        <p class="text-[11px] text-slate-400">Add some items from the store to place an order</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = customerCart.map(item => {
    const itemTotal = item.selling_price * item.quantity;
    return `
      <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <div class="flex-1 pr-2">
          <p class="font-bold text-slate-900">${item.name}</p>
          <span class="text-[11px] text-slate-500">${formatCurrency(item.selling_price)} / ${item.unit}</span>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Stepper -->
          <div class="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
            <button onclick="updateCustomerCartQty(${item.product_id}, -1)" class="px-2 py-1 font-bold text-slate-700 hover:bg-slate-100">-</button>
            <span class="px-2 font-bold">${item.quantity}</span>
            <button onclick="updateCustomerCartQty(${item.product_id}, 1)" class="px-2 py-1 font-bold text-slate-700 hover:bg-slate-100">+</button>
          </div>

          <span class="w-14 text-right font-black text-slate-900">${formatCurrency(itemTotal)}</span>

          <!-- Delete / Remove Button -->
          <button onclick="removeCustomerCartItem(${item.product_id})" class="p-1 text-slate-400 hover:text-red-600 transition" title="Delete from cart">
            <i data-lucide="trash-2" class="w-4 h-4 text-red-500"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function sendCustomerWhatsAppOrder() {
  if (customerCart.length === 0) {
    showToast('Your cart is empty! Add items first.', true);
    return;
  }

  const name = document.getElementById('order-cust-name').value.trim();
  const phone = document.getElementById('order-cust-phone').value.trim();
  const address = document.getElementById('order-cust-address').value.trim();

  if (!name || !phone || !address) {
    showToast('Please enter your Name, Phone, and Delivery Address', true);
    return;
  }

  const totalAmount = customerCart.reduce((sum, i) => sum + (i.selling_price * i.quantity), 0);
  const itemsText = customerCart.map((i, idx) => `${idx + 1}. ${i.name} - ${i.quantity} ${i.unit} (₹${(i.selling_price * i.quantity).toFixed(2)})`).join('\n');

  const waMessage = `*श्री गुरुदत्त प्रसन्न*\n*GURUDATTA KIRANA & GENERAL STORES*\n*New Customer Grocery Order*\n--------------------------------\n👤 *Customer:* ${name}\n📞 *Phone:* ${phone}\n📍 *Delivery Address:* ${address}\n--------------------------------\n🛒 *ORDER ITEMS:*\n${itemsText}\n--------------------------------\n💰 *TOTAL BILL: ₹${totalAmount.toFixed(2)}*\n--------------------------------\nPlease confirm order acceptance and estimated delivery time!`;

  // Store WhatsApp phone (replace with owner number or open WhatsApp)
  const shopWhatsAppNumber = "919876543210";
  const waUrl = `https://api.whatsapp.com/send?phone=${shopWhatsAppNumber}&text=${encodeURIComponent(waMessage)}`;

  window.open(waUrl, '_blank');

  // Clear customer cart
  customerCart = [];
  saveCustomerCart();
  syncCustomerCartUI();
  closeModal('customer-cart-modal');
  showToast('Order generated! WhatsApp opened.');
}

// ==========================================================
// 2. OWNER / ADMIN AUTHENTICATION & SWITCHING
// ==========================================================

function openOwnerLoginModal() {
  document.getElementById('owner-pin-input').value = '';
  openModal('owner-login-modal');
  setTimeout(() => document.getElementById('owner-pin-input')?.focus(), 200);
}

async function submitOwnerLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('owner-pin-input').value.trim();

  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin })
    });
    const data = await res.json();
    if (data.status === 'success') {
      isAdmin = true;
      sessionStorage.setItem('gk_is_admin', 'true');
      closeModal('owner-login-modal');
      updateAdminUI();
      switchAdminTab('inventory');
      showToast('Welcome, Shop Owner! Admin Mode Unlocked.');
    } else {
      showToast(data.message || 'Incorrect PIN', true);
    }
  } catch (err) {
    showToast('Failed to verify PIN', true);
  }
}

function logoutAdmin() {
  isAdmin = false;
  sessionStorage.removeItem('gk_is_admin');
  updateAdminUI();
  showCustomerStore();
  showToast('Logged out to Customer Storefront.');
}

function updateAdminUI() {
  const adminPill = document.getElementById('admin-active-pill');
  const loginBtn = document.getElementById('btn-owner-login');
  const adminNav = document.getElementById('admin-navbar-strip');

  if (isAdmin) {
    adminPill?.classList.remove('hidden');
    adminPill?.classList.add('flex');
    loginBtn?.classList.add('hidden');
    adminNav?.classList.remove('hidden');
  } else {
    adminPill?.classList.add('hidden');
    adminPill?.classList.remove('flex');
    loginBtn?.classList.remove('hidden');
    adminNav?.classList.add('hidden');
  }
}

function showCustomerStore() {
  document.getElementById('view-customer-store')?.classList.remove('hidden');
  document.getElementById('view-admin-panel')?.classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function switchAdminTab(tabName) {
  if (!isAdmin) {
    openOwnerLoginModal();
    return;
  }

  if (tabName === 'storefront') {
    showCustomerStore();
    return;
  }

  document.getElementById('view-customer-store')?.classList.add('hidden');
  document.getElementById('view-admin-panel')?.classList.remove('hidden');

  const tabs = ['inventory', 'billing', 'stock', 'customers', 'reports'];
  tabs.forEach(t => {
    const sec = document.getElementById(`admin-sec-${t}`);
    const btn = document.getElementById(`admin-nav-${t}`);
    if (t === tabName) {
      sec?.classList.remove('hidden');
      btn?.classList.add('active-admin-tab', 'bg-amber-600', 'text-white');
      btn?.classList.remove('text-slate-300');
    } else {
      sec?.classList.add('hidden');
      btn?.classList.remove('active-admin-tab', 'bg-amber-600', 'text-white');
      btn?.classList.add('text-slate-300');
    }
  });

  if (window.lucide) lucide.createIcons();

  if (tabName === 'inventory') renderAdminInventory();
  if (tabName === 'billing') renderPosProducts();
  if (tabName === 'stock') loadAdminStockAlerts();
  if (tabName === 'customers') loadAdminCustomers();
  if (tabName === 'reports') loadAdminReports();
}

// ==========================================================
// 3. ADMIN INVENTORY MANAGEMENT (WITH PROMINENT DELETE)
// ==========================================================

function renderAdminInventory() {
  const tbody = document.getElementById('admin-inventory-tbody');
  const search = (document.getElementById('admin-inv-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('admin-inv-cat-filter')?.value || 'All';

  if (!tbody) return;

  const filtered = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search);
    const matchesCat = (cat === 'All' || p.category === cat);
    return matchesSearch && matchesCat;
  });

  if (allProducts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-12 text-slate-500">
          <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
            <i data-lucide="package-plus" class="w-6 h-6"></i>
          </div>
          <p class="font-bold text-slate-800 text-sm">No products in your store yet</p>
          <p class="text-xs text-slate-400 mt-0.5 mb-3">Click below to add your real Kirana store products.</p>
          <button onclick="openAddProductModal()" class="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-xs shadow">
            + Add New Product
          </button>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No products matching search.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const profit = p.selling_price - p.purchase_price;
    const margin = p.selling_price > 0 ? ((profit / p.selling_price) * 100).toFixed(1) : 0;
    const isLow = p.stock_quantity <= p.min_stock_alert;

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="px-4 py-3 font-bold text-slate-900">${p.name}</td>
        <td class="px-3 py-3 text-slate-600"><span class="bg-slate-100 px-2 py-0.5 rounded text-[11px]">${p.category}</span></td>
        <td class="px-3 py-3 text-center text-slate-600 font-mono text-xs">${p.unit}</td>
        <td class="px-3 py-3 text-right text-slate-600">${formatCurrency(p.purchase_price)}</td>
        <td class="px-3 py-3 text-right font-black text-slate-900">${formatCurrency(p.selling_price)}</td>
        <td class="px-3 py-3 text-right font-bold text-emerald-700 text-xs">
          +${formatCurrency(profit)} (${margin}%)
        </td>
        <td class="px-3 py-3 text-center">
          <span class="px-2 py-0.5 rounded-full text-xs font-black ${isLow ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">
            ${p.stock_quantity}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center space-x-1.5">
            <!-- Edit Button -->
            <button onclick="editProduct(${p.id})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit Product">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            
            <!-- PROMINENT DELETE BUTTON -->
            <button 
              onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" 
              class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition flex items-center gap-1 font-bold text-xs" 
              title="Delete Product Permanently"
            >
              <i data-lucide="trash-2" class="w-4 h-4 text-red-600"></i>
              <span class="hidden sm:inline">Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function deleteProduct(productId, name) {
  if (!confirm(`⚠️ DELETE CONFIRMATION:\n\nAre you sure you want to permanently delete "${name}" from your store?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`Deleted: "${name}"`);
      await loadProducts();
    } else {
      showToast(data.message || 'Delete failed', true);
    }
  } catch (err) {
    showToast('Failed to delete product', true);
  }
}

function openAddProductModal() {
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('product-modal-title').innerText = 'Add New Store Product';
  openModal('product-modal');
}

function editProduct(productId) {
  const p = allProducts.find(item => item.id === productId);
  if (!p) return;

  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-unit').value = p.unit;
  document.getElementById('prod-purchase').value = p.purchase_price;
  document.getElementById('prod-selling').value = p.selling_price;
  document.getElementById('prod-stock').value = p.stock_quantity;
  document.getElementById('prod-alert').value = p.min_stock_alert;

  document.getElementById('product-modal-title').innerText = `Edit: ${p.name}`;
  openModal('product-modal');
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const payload = {
    name: document.getElementById('prod-name').value.trim(),
    category: document.getElementById('prod-category').value.trim() || 'General',
    unit: document.getElementById('prod-unit').value,
    purchase_price: parseFloat(document.getElementById('prod-purchase').value) || 0,
    selling_price: parseFloat(document.getElementById('prod-selling').value) || 0,
    stock_quantity: parseFloat(document.getElementById('prod-stock').value) || 0,
    min_stock_alert: parseFloat(document.getElementById('prod-alert').value) || 5
  };

  const url = id ? `/api/products/${id}` : '/api/products';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);
      closeModal('product-modal');
      await loadProducts();
    } else {
      showToast(data.message || 'Error saving product', true);
    }
  } catch (err) {
    showToast('Failed to save product', true);
  }
}

// ==========================================================
// 4. ADMIN POS COUNTER BILLING
// ==========================================================

function renderPosProducts() {
  const grid = document.getElementById('pos-products-grid');
  const search = (document.getElementById('pos-search-input')?.value || '').toLowerCase().trim();
  if (!grid) return;

  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));

  grid.innerHTML = filtered.map(p => `
    <div onclick="addToPosCart(${p.id})" class="p-2.5 bg-white border border-slate-200 hover:border-amber-500 rounded-xl cursor-pointer shadow-xs flex flex-col justify-between">
      <div>
        <span class="text-[10px] text-slate-400 font-bold">${p.category}</span>
        <h5 class="font-bold text-xs text-slate-800 line-clamp-1">${p.name}</h5>
      </div>
      <div class="mt-2 flex justify-between items-baseline pt-1 border-t border-slate-100">
        <span class="text-xs font-black text-amber-700">${formatCurrency(p.selling_price)}</span>
        <span class="text-[10px] text-slate-500">${p.stock_quantity} ${p.unit}</span>
      </div>
    </div>
  `).join('');
}

function addToPosCart(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  const existing = posCart.find(i => i.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    posCart.push({
      product_id: prod.id,
      name: prod.name,
      unit: prod.unit,
      selling_price: prod.selling_price,
      quantity: 1
    });
  }

  renderPosCart();
}

function updatePosCartQty(productId, delta) {
  const item = posCart.find(i => i.product_id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromPosCart(productId);
  } else {
    renderPosCart();
  }
}

function removeFromPosCart(productId) {
  posCart = posCart.filter(i => i.product_id !== productId);
  renderPosCart();
}

function clearPosCart() {
  posCart = [];
  renderPosCart();
}

function renderPosCart() {
  const container = document.getElementById('pos-cart-container');
  if (!container) return;

  if (posCart.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Click items on the left to add to bill</p>`;
    recalcPosCart();
    return;
  }

  container.innerHTML = posCart.map(i => `
    <div class="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
      <div class="flex-1 pr-1 truncate">
        <p class="font-bold text-slate-800 truncate">${i.name}</p>
        <span class="text-[10px] text-slate-500">${formatCurrency(i.selling_price)} / ${i.unit}</span>
      </div>
      <div class="flex items-center space-x-1.5">
        <button onclick="updatePosCartQty(${i.product_id}, -1)" class="w-5 h-5 bg-white border rounded font-bold">-</button>
        <span class="font-bold text-xs">${i.quantity}</span>
        <button onclick="updatePosCartQty(${i.product_id}, 1)" class="w-5 h-5 bg-white border rounded font-bold">+</button>
        <span class="w-12 text-right font-bold text-slate-900">${formatCurrency(i.selling_price * i.quantity)}</span>
        
        <!-- Delete line item button -->
        <button onclick="removeFromPosCart(${i.product_id})" class="p-1 text-red-500 hover:text-red-700" title="Remove line item">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `).join('');

  recalcPosCart();
  if (window.lucide) lucide.createIcons();
}

function recalcPosCart() {
  const subtotal = posCart.reduce((sum, i) => sum + (i.selling_price * i.quantity), 0);
  const discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
  const grandTotal = Math.max(0, subtotal - discount);

  document.getElementById('pos-subtotal').innerText = formatCurrency(subtotal);
  document.getElementById('pos-grand-total').innerText = formatCurrency(grandTotal);
}

async function submitPosSale(shouldPrint) {
  if (posCart.length === 0) {
    showToast('Add items to POS bill first', true);
    return;
  }

  const custSelect = document.getElementById('pos-customer-select');
  const customerId = custSelect.value ? parseInt(custSelect.value) : null;
  const payMode = document.querySelector('input[name="pos_pay_mode"]:checked')?.value || 'cash';
  const discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;

  if (payMode === 'credit' && !customerId) {
    showToast('Udhaar bill requires selecting a registered customer', true);
    return;
  }

  try {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        items: posCart,
        payment_mode: payMode,
        discount: discount
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Sale completed successfully');
      if (shouldPrint && data.invoice) {
        prepareAndPrintReceipt(data.invoice);
      }
      clearPosCart();
      await loadProducts();
      loadAdminReports();
    } else {
      showToast(data.message || 'Sale failed', true);
    }
  } catch (err) {
    showToast('Sale failed', true);
  }
}

function prepareAndPrintReceipt(inv) {
  document.getElementById('rec-inv-no').innerText = inv.invoice_no;
  document.getElementById('rec-date').innerText = inv.date;
  document.getElementById('rec-customer').innerText = inv.customer_name;
  document.getElementById('rec-payment-mode').innerText = inv.payment_mode;
  document.getElementById('rec-total').innerText = formatCurrency(inv.total_amount);

  document.getElementById('rec-items-body').innerHTML = inv.items.map(it => `
    <tr>
      <td>${it.product_name}</td>
      <td style="text-align:center">${it.quantity} ${it.unit}</td>
      <td style="text-align:right">${it.selling_price.toFixed(2)}</td>
      <td style="text-align:right">${it.item_total.toFixed(2)}</td>
    </tr>
  `).join('');

  setTimeout(() => window.print(), 200);
}

// ==========================================================
// 5. LOW STOCK, CUSTOMERS & REPORTS
// ==========================================================

async function loadAdminStockAlerts() {
  const tbody = document.getElementById('admin-stock-tbody');
  const lowItems = allProducts.filter(p => p.stock_quantity <= p.min_stock_alert);

  if (lowItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-emerald-600 font-bold">All items have sufficient stock!</td></tr>`;
    return;
  }

  tbody.innerHTML = lowItems.map(p => `
    <tr class="border-b">
      <td class="p-2 font-bold">${p.name}</td>
      <td class="p-2 text-right font-black text-red-600">${p.stock_quantity} ${p.unit}</td>
      <td class="p-2 text-right text-slate-500">${p.min_stock_alert} ${p.unit}</td>
      <td class="p-2 text-center">
        <button onclick="quickRestock(${p.id})" class="px-2 py-1 bg-amber-600 text-white rounded text-xs font-bold">+10 Stock</button>
      </td>
    </tr>
  `).join('');
}

async function quickRestock(productId) {
  try {
    const res = await fetch(`/api/products/${productId}/quick-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add_quantity: 10 })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);
      await loadProducts();
      loadAdminStockAlerts();
    }
  } catch (err) {
    showToast('Restock failed', true);
  }
}

function updateAdminLowBadge() {
  const lowCount = allProducts.filter(p => p.stock_quantity <= p.min_stock_alert).length;
  const badge = document.getElementById('admin-low-badge');
  if (badge) {
    if (lowCount > 0) {
      badge.innerText = lowCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

async function loadCustomerDropdown() {
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    if (data.status === 'success') {
      allCustomers = data.customers;
      const posSelect = document.getElementById('pos-customer-select');
      if (posSelect) {
        posSelect.innerHTML = '<option value="">👤 Walk-in Customer (Cash / UPI)</option>' +
          allCustomers.map(c => `<option value="${c.id}">${c.name} ${c.phone ? '(' + c.phone + ')' : ''}</option>`).join('');
      }
    }
  } catch (e) {}
}

async function loadAdminCustomers() {
  const tbody = document.getElementById('admin-customers-tbody');
  const search = (document.getElementById('admin-cust-search')?.value || '').trim();

  try {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(search)}`);
    const data = await res.json();
    if (data.customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-400">No customers registered yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.customers.map(c => `
      <tr class="border-b">
        <td class="p-3 font-bold">${c.name}</td>
        <td class="p-3 text-slate-500">${c.phone || '-'}</td>
        <td class="p-3 text-right font-black ${c.udhaar_balance > 0 ? 'text-red-600' : 'text-emerald-700'}">${formatCurrency(c.udhaar_balance)}</td>
        <td class="p-3 text-center">
          <button onclick="viewCustomerLedger(${c.id})" class="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded text-xs">View Ledger</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {}
}

async function viewCustomerLedger(customerId) {
  try {
    const res = await fetch(`/api/customers/${customerId}/ledger`);
    const data = await res.json();
    if (data.status === 'success') {
      const c = data.customer;
      document.getElementById('ledger-name').innerText = c.name;
      document.getElementById('ledger-phone').innerText = c.phone ? `Phone: ${c.phone}` : '';
      document.getElementById('ledger-balance').innerText = formatCurrency(c.balance);
      document.getElementById('repay-cust-id').value = c.id;

      const hist = document.getElementById('ledger-history-list');
      if (data.entries.length === 0) {
        hist.innerHTML = '<p class="text-center text-slate-400 py-4">No transactions found</p>';
      } else {
        hist.innerHTML = data.entries.map(e => `
          <div class="flex justify-between p-2 rounded border ${e.entry_type === 'credit' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}">
            <div>
              <span class="font-bold">${e.entry_type === 'credit' ? '🛒 Purchase' : '💵 Payment Received'}</span>
              <p class="text-[10px] text-slate-500">${e.created_at}</p>
            </div>
            <span class="font-black">${e.entry_type === 'credit' ? '+' : '-'}${formatCurrency(e.amount)}</span>
          </div>
        `).join('');
      }
      openModal('customer-ledger-modal');
    }
  } catch (e) {}
}

async function submitRepayment(e) {
  e.preventDefault();
  const custId = document.getElementById('repay-cust-id').value;
  const amount = parseFloat(document.getElementById('repay-amount').value);
  if (isNaN(amount) || amount <= 0) return;

  try {
    const res = await fetch(`/api/customers/${custId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount, notes: 'Repayment' })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);
      viewCustomerLedger(custId);
      loadAdminCustomers();
    }
  } catch (e) {}
}

async function loadAdminReports() {
  try {
    const res = await fetch('/api/reports');
    const data = await res.json();
    if (data.status === 'success') {
      document.getElementById('rep-today').innerText = formatCurrency(data.today_sales);
      document.getElementById('rep-week').innerText = formatCurrency(data.weekly_sales);
      document.getElementById('rep-month').innerText = formatCurrency(data.monthly_sales);
      document.getElementById('rep-profit').innerText = formatCurrency(data.total_profit);
    }
  } catch (e) {}
}

// ----------------------------------------------------------
// MODAL CONTROLS
// ----------------------------------------------------------
function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
