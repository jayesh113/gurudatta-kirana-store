// ==========================================================
// GURUDATTA KIRANA AND GENERAL STORES - APPLICATION LOGIC
// ==========================================================

let allProducts = [];
let allCustomers = [];
let cart = [];
let serverInfo = { local_ip: '127.0.0.1', mobile_url: 'http://127.0.0.1:5000' };

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Start live clock
  startLiveClock();

  // Load initial data
  fetchServerInfo();
  loadProducts();
  loadCustomerDropdown();
  updateLowStockBadge();

  // Setup Event Listeners
  setupEventListeners();
});

async function fetchServerInfo() {
  try {
    const res = await fetch('/api/server-info');
    const data = await res.json();
    if (data.status === 'success') {
      serverInfo = data;
    }
  } catch (err) {
    console.log('Server info fetch fallback:', err);
  }
}

function openMobileConnectModal() {
  const url = serverInfo.mobile_url || window.location.href;
  const qrImg = document.getElementById('mobile-qr-code');
  const urlDisplay = document.getElementById('mobile-url-display');

  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  }
  if (urlDisplay) {
    urlDisplay.innerText = url;
  }
  openModal('mobile-connect-modal');
  if (window.lucide) lucide.createIcons();
}

function copyMobileUrl() {
  const url = serverInfo.mobile_url || window.location.href;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Address copied! Paste in your phone browser.');
    });
  } else {
    showToast(`Address: ${url}`);
  }
}

// ----------------------------------------------------------
// CLOCK & UTILITIES
// ----------------------------------------------------------
function startLiveClock() {
  const clockEl = document.getElementById('live-clock');
  function update() {
    const now = new Date();
    clockEl.innerText = now.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) + ' | ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  update();
  setInterval(update, 1000);
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  msg.innerText = message;
  
  if (isError) {
    toast.classList.remove('bg-slate-900', 'bg-emerald-600');
    toast.classList.add('bg-red-600');
  } else {
    toast.classList.remove('bg-red-600', 'bg-slate-900');
    toast.classList.add('bg-emerald-600');
  }

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3000);
}

function formatCurrency(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ----------------------------------------------------------
// TAB NAVIGATION
// ----------------------------------------------------------
function switchTab(tabId) {
  const tabs = ['billing', 'inventory', 'stock', 'customers', 'reports'];
  
  tabs.forEach(t => {
    const content = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    const mNavBtn = document.getElementById(`m-nav-${t}`);
    
    if (t === tabId) {
      if (content) content.classList.remove('hidden');
      if (navBtn) {
        navBtn.classList.add('active-tab');
        navBtn.classList.remove('text-slate-400');
      }
      if (mNavBtn) {
        mNavBtn.classList.remove('text-slate-400', 'font-medium');
        mNavBtn.classList.add('text-amber-500', 'font-bold');
      }
    } else {
      if (content) content.classList.add('hidden');
      if (navBtn) {
        navBtn.classList.remove('active-tab');
        navBtn.classList.add('text-slate-400');
      }
      if (mNavBtn) {
        mNavBtn.classList.remove('text-amber-500', 'font-bold');
        mNavBtn.classList.add('text-slate-400', 'font-medium');
      }
    }
  });

  // Re-render icons on tab switch
  if (window.lucide) lucide.createIcons();

  // Tab-specific fetch triggers
  if (tabId === 'inventory') loadInventoryTable();
  if (tabId === 'stock') loadLowStockItems();
  if (tabId === 'customers') loadCustomers();
  if (tabId === 'reports') loadReports();
}

// ----------------------------------------------------------
// KEYBOARD SHORTCUTS
// ----------------------------------------------------------
function setupEventListeners() {
  document.addEventListener('keydown', (e) => {
    // F2: Focus Search
    if (e.key === 'F2') {
      e.preventDefault();
      switchTab('billing');
      const searchInput = document.getElementById('billing-search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
    // F8: Clear Cart
    if (e.key === 'F8') {
      e.preventDefault();
      clearCart();
    }
    // F9: Print & Checkout
    if (e.key === 'F9') {
      e.preventDefault();
      processCheckout(true);
    }
  });

  // Billing search listener
  const billingSearch = document.getElementById('billing-search');
  if (billingSearch) {
    billingSearch.addEventListener('input', renderBillingProducts);
  }

  // Billing category filter
  const catFilter = document.getElementById('billing-category-filter');
  if (catFilter) {
    catFilter.addEventListener('change', renderBillingProducts);
  }
}

// ==========================================================
// 1. BILLING & CART FUNCTIONS
// ==========================================================

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.status === 'success') {
      allProducts = data.products;
      populateCategoryFilters();
      renderBillingProducts();
      updateLowStockBadge();
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

function populateCategoryFilters() {
  const categories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
  
  const bSelect = document.getElementById('billing-category-filter');
  const iSelect = document.getElementById('inventory-category-filter');

  const optionsHtml = '<option value="All">All Categories</option>' + 
    categories.map(c => `<option value="${c}">${c}</option>`).join('');

  if (bSelect) bSelect.innerHTML = optionsHtml;
  if (iSelect) iSelect.innerHTML = optionsHtml;
}

function renderBillingProducts() {
  const grid = document.getElementById('billing-products-grid');
  const countBadge = document.getElementById('product-count-badge');
  const search = (document.getElementById('billing-search').value || '').toLowerCase().trim();
  const cat = document.getElementById('billing-category-filter').value;

  const filtered = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search);
    const matchesCat = (cat === 'All' || p.category === cat);
    return matchesSearch && matchesCat;
  });

  if (allProducts.length === 0) {
    if (countBadge) countBadge.innerText = '0 products';
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500">
        <div class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
          <i data-lucide="package-plus" class="w-7 h-7"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">Your Store is Fresh & Empty</h3>
        <p class="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto">Click below to add your real Kirana items with cost and selling prices.</p>
        <button onclick="openAddProductModal()" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition inline-flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-4 h-4"></i>
          <span>+ Add Your First Product</span>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <i data-lucide="package-search" class="w-10 h-10 mx-auto mb-2 text-slate-300"></i>
        <p class="text-sm font-medium">No items found matching "${search}"</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isLow = p.stock_quantity <= p.min_stock_alert;
    const isOut = p.stock_quantity <= 0;
    
    return `
      <div 
        onclick="addToCart(${p.id})" 
        class="pos-product-card bg-white border ${isOut ? 'border-red-200 bg-red-50/20' : isLow ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'} rounded-xl p-3 flex flex-col justify-between shadow-xs select-none"
      >
        <div>
          <div class="flex justify-between items-start mb-1">
            <span class="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}">
              ${p.category}
            </span>
            <span class="text-[11px] font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-500'}">
              Stock: ${p.stock_quantity} ${p.unit}
            </span>
          </div>
          <h4 class="font-bold text-slate-800 text-xs sm:text-sm line-clamp-2 leading-snug">${p.name}</h4>
        </div>

        <div class="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2">
          <div>
            <span class="text-xs text-slate-400">Rate:</span>
            <span class="text-sm sm:text-base font-extrabold text-amber-700">${formatCurrency(p.selling_price)}</span>
          </div>
          <button class="w-7 h-7 rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shadow-xs transition">
            <i data-lucide="plus" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function addToCart(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  const existing = cart.find(item => item.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id: prod.id,
      name: prod.name,
      unit: prod.unit,
      selling_price: prod.selling_price,
      quantity: 1
    });
  }

  renderCart();
  showToast(`Added: ${prod.name}`);
}

function updateCartQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;

  item.quantity = Math.max(0.1, Number((item.quantity + delta).toFixed(2)));
  renderCart();
}

function setCartQtyDirect(productId, val) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;

  const parsed = parseFloat(val);
  if (!isNaN(parsed) && parsed > 0) {
    item.quantity = parsed;
  }
  recalculateCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.product_id !== productId);
  renderCart();
}

function clearCart() {
  cart = [];
  document.getElementById('cart-discount').value = 0;
  renderCart();
}

function renderCart() {
  const emptyState = document.getElementById('cart-empty-state');
  const container = document.getElementById('cart-table-container');

  if (cart.length === 0) {
    emptyState.classList.remove('hidden');
    container.classList.add('hidden');
    recalculateCart();
    return;
  }

  emptyState.classList.add('hidden');
  container.classList.remove('hidden');

  container.innerHTML = cart.map(item => {
    const itemSubtotal = item.selling_price * item.quantity;
    return `
      <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
        <div class="flex-1 pr-2">
          <p class="font-semibold text-slate-800 text-xs sm:text-sm leading-tight">${item.name}</p>
          <span class="text-xs text-slate-500">${formatCurrency(item.selling_price)} / ${item.unit}</span>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Quantity Controls -->
          <div class="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden">
            <button onclick="updateCartQty(${item.product_id}, -1)" class="px-2 py-1 hover:bg-slate-100 text-slate-600 font-bold text-xs">-</button>
            <input 
              type="number" 
              step="any"
              value="${item.quantity}" 
              class="w-14 text-center text-xs font-semibold focus:outline-none py-1"
              onchange="setCartQtyDirect(${item.product_id}, this.value)"
            >
            <button onclick="updateCartQty(${item.product_id}, 1)" class="px-2 py-1 hover:bg-slate-100 text-slate-600 font-bold text-xs">+</button>
          </div>

          <!-- Total for line item -->
          <div class="w-18 text-right font-bold text-slate-800 text-xs sm:text-sm">
            ${formatCurrency(itemSubtotal)}
          </div>

          <!-- Remove Item Button -->
          <button onclick="removeFromCart(${item.product_id})" class="text-slate-400 hover:text-red-600 p-1 transition">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  recalculateCart();
  if (window.lucide) lucide.createIcons();
}

function recalculateCart() {
  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const discountInput = parseFloat(document.getElementById('cart-discount').value) || 0;
  const grandTotal = Math.max(0, subtotal - discountInput);

  document.getElementById('cart-total-items').innerText = cart.length;
  document.getElementById('cart-subtotal').innerText = formatCurrency(subtotal);
  document.getElementById('cart-grand-total').innerText = formatCurrency(grandTotal);

  // Sync Mobile Floating Cart Bar
  const mBar = document.getElementById('mobile-cart-bar');
  const mCount = document.getElementById('mobile-cart-count');
  const mTotal = document.getElementById('mobile-cart-total');
  if (mBar) {
    if (cart.length > 0) {
      mBar.classList.remove('hidden');
      if (mCount) mCount.innerText = cart.length;
      if (mTotal) mTotal.innerText = formatCurrency(grandTotal);
    } else {
      mBar.classList.add('hidden');
    }
  }
}

function scrollToBillSection() {
  switchTab('billing');
  const billCustomer = document.getElementById('bill-customer-select');
  if (billCustomer) {
    billCustomer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    billCustomer.focus();
  }
}

// ----------------------------------------------------------
// CHECKOUT & PRINT RECEIPT
// ----------------------------------------------------------
async function processCheckout(shouldPrint = true) {
  if (cart.length === 0) {
    showToast("Please add items to cart before checkout", true);
    return;
  }

  const custSelect = document.getElementById('bill-customer-select');
  const customerId = custSelect.value ? parseInt(custSelect.value) : null;
  const paymentMode = document.querySelector('input[name="payment_mode"]:checked').value;
  const discount = parseFloat(document.getElementById('cart-discount').value) || 0;

  if (paymentMode === 'credit' && !customerId) {
    showToast("Udhaar/Credit requires selecting a registered customer!", true);
    custSelect.focus();
    return;
  }

  const payload = {
    customer_id: customerId,
    items: cart,
    payment_mode: paymentMode,
    discount: discount
  };

  try {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);

      if (shouldPrint && data.invoice) {
        prepareAndPrintReceipt(data.invoice);
      }

      // Reset cart and reload product counts
      clearCart();
      loadProducts();
      loadReports();
    } else {
      showToast(data.message || 'Checkout failed', true);
    }
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('Failed to complete sale', true);
  }
}

async function processCheckoutAndWhatsApp() {
  if (cart.length === 0) {
    showToast("Please add items to cart before checkout", true);
    return;
  }

  const custSelect = document.getElementById('bill-customer-select');
  const customerId = custSelect.value ? parseInt(custSelect.value) : null;
  const paymentMode = document.querySelector('input[name="payment_mode"]:checked').value;
  const discount = parseFloat(document.getElementById('cart-discount').value) || 0;

  if (paymentMode === 'credit' && !customerId) {
    showToast("Udhaar/Credit requires selecting a registered customer!", true);
    custSelect.focus();
    return;
  }

  let custPhone = "";
  let custName = "Walk-in Customer";
  if (customerId) {
    const foundCust = allCustomers.find(c => c.id === customerId);
    if (foundCust) {
      custPhone = foundCust.phone || "";
      custName = foundCust.name;
    }
  }

  // Prompt phone number if walk-in
  if (!custPhone) {
    const inputPhone = prompt("Enter customer 10-digit mobile number for WhatsApp bill:", "");
    if (inputPhone) {
      custPhone = inputPhone.trim();
    }
  }

  const payload = {
    customer_id: customerId,
    items: cart,
    payment_mode: paymentMode,
    discount: discount
  };

  try {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'success') {
      showToast("Bill generated successfully!");

      const inv = data.invoice;
      let itemsList = inv.items.map(it => `• ${it.product_name} (${it.quantity} ${it.unit}) = ₹${it.item_total.toFixed(2)}`).join('\n');
      
      let waMessage = `*श्री गुरुदत्त प्रसन्न*\n*GURUDATTA KIRANA & GENERAL STORES*\nWholesale & Retail Kirana Merchant\nMain Road, Near Bus Stand\nPh: 9876543210\n--------------------------------\n*Bill No:* ${inv.invoice_no}\n*Date:* ${inv.date}\n*Customer:* ${custName}\n--------------------------------\n*ITEMS PURCHASED:*\n${itemsList}\n--------------------------------\n*Subtotal:* ₹${inv.subtotal.toFixed(2)}\n*Discount:* ₹${inv.discount.toFixed(2)}\n*GRAND TOTAL: ₹${inv.total_amount.toFixed(2)}*\n*Payment:* ${inv.payment_mode}\n--------------------------------\nधन्यवाद! पुन्हा भेट द्या!\nThank you! Visit again!`;

      let cleanNumber = (custPhone || '').replace(/\D/g, '');
      if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;

      const waUrl = cleanNumber 
        ? `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(waMessage)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;

      window.open(waUrl, '_blank');

      clearCart();
      loadProducts();
      loadReports();
    } else {
      showToast(data.message || 'Checkout failed', true);
    }
  } catch (err) {
    showToast('Failed to checkout and send WhatsApp bill', true);
  }
}

function prepareAndPrintReceipt(invoice) {
  document.getElementById('rec-inv-no').innerText = invoice.invoice_no;
  document.getElementById('rec-date').innerText = invoice.date;
  document.getElementById('rec-customer').innerText = invoice.customer_name + (invoice.customer_phone ? ` (${invoice.customer_phone})` : '');
  document.getElementById('rec-payment-mode').innerText = invoice.payment_mode;

  const itemsBody = document.getElementById('rec-items-body');
  itemsBody.innerHTML = invoice.items.map(item => `
    <tr>
      <td style="text-align: left;">${item.product_name}</td>
      <td style="text-align: center;">${item.quantity} ${item.unit}</td>
      <td style="text-align: right;">${item.selling_price.toFixed(2)}</td>
      <td style="text-align: right;">${item.item_total.toFixed(2)}</td>
    </tr>
  `).join('');

  document.getElementById('rec-subtotal').innerText = formatCurrency(invoice.subtotal);
  document.getElementById('rec-discount').innerText = formatCurrency(invoice.discount);
  document.getElementById('rec-total').innerText = formatCurrency(invoice.total_amount);

  // Trigger browser print
  setTimeout(() => {
    window.print();
  }, 200);
}

// ==========================================================
// 2. PRODUCT INVENTORY MANAGEMENT
// ==========================================================

function loadInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  const search = (document.getElementById('inventory-search').value || '').toLowerCase().trim();
  const category = document.getElementById('inventory-category-filter').value;

  const filtered = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search);
    const matchesCat = (category === 'All' || p.category === category);
    return matchesSearch && matchesCat;
  });

  if (allProducts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-16 text-slate-500">
          <div class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <i data-lucide="package-plus" class="w-7 h-7"></i>
          </div>
          <p class="text-base font-bold text-slate-800">No products added yet</p>
          <p class="text-xs text-slate-500 mt-1 mb-4">Add your Kirana items (Atta, Rice, Oil, Spices, Biscuits, Soaps, etc.)</p>
          <button onclick="openAddProductModal()" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition inline-flex items-center gap-2">
            <i data-lucide="plus-circle" class="w-4 h-4"></i>
            <span>+ Add New Product</span>
          </button>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-400">No products matching "${search}".</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const profit = p.selling_price - p.purchase_price;
    const marginPercent = p.selling_price > 0 ? ((profit / p.selling_price) * 100).toFixed(1) : 0;
    const isLow = p.stock_quantity <= p.min_stock_alert;

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="px-4 py-3 font-semibold text-slate-800">${p.name}</td>
        <td class="px-4 py-3 text-slate-600"><span class="bg-slate-100 px-2 py-0.5 rounded text-xs">${p.category}</span></td>
        <td class="px-4 py-3 text-center text-slate-600 font-mono text-xs">${p.unit}</td>
        <td class="px-4 py-3 text-right text-slate-600">${formatCurrency(p.purchase_price)}</td>
        <td class="px-4 py-3 text-right font-bold text-slate-800">${formatCurrency(p.selling_price)}</td>
        <td class="px-4 py-3 text-right text-emerald-700 font-medium text-xs">
          +${formatCurrency(profit)} (${marginPercent}%)
        </td>
        <td class="px-4 py-3 text-center">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isLow ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">
            ${p.stock_quantity} ${p.unit}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center space-x-2">
            <button onclick="editProduct(${p.id})" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')" class="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterInventory() {
  loadInventoryTable();
}

function openAddProductModal() {
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('product-modal-title').innerHTML = `
    <i data-lucide="package-plus" class="w-5 h-5 text-amber-400"></i> Add New Product
  `;
  openModal('product-modal');
  if (window.lucide) lucide.createIcons();
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

  document.getElementById('product-modal-title').innerHTML = `
    <i data-lucide="edit-3" class="w-5 h-5 text-amber-400"></i> Edit Product
  `;
  openModal('product-modal');
  if (window.lucide) lucide.createIcons();
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
      loadInventoryTable();
    } else {
      showToast(data.message || 'Error saving product', true);
    }
  } catch (err) {
    showToast('Failed to connect to server', true);
  }
}

async function deleteProduct(productId, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);
      await loadProducts();
      loadInventoryTable();
    }
  } catch (err) {
    showToast('Failed to delete product', true);
  }
}

// ==========================================================
// 3. LOW STOCK & RESTOCK MANAGEMENT
// ==========================================================

async function loadLowStockItems() {
  try {
    const res = await fetch('/api/products?low_stock=true');
    const data = await res.json();
    const tbody = document.getElementById('low-stock-table-body');
    
    if (data.products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-10 text-emerald-600 font-medium">
            <i data-lucide="check-circle" class="w-8 h-8 mx-auto mb-1 text-emerald-500"></i>
            All products have sufficient stock! No low stock alerts.
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = data.products.map(p => `
      <tr class="hover:bg-amber-50/30 transition border-b border-slate-100">
        <td class="px-4 py-3 font-semibold text-slate-800">${p.name}</td>
        <td class="px-4 py-3 text-slate-600 text-xs">${p.category}</td>
        <td class="px-4 py-3 text-center text-xs font-mono">${p.unit}</td>
        <td class="px-4 py-3 text-right font-bold text-red-600">${p.stock_quantity}</td>
        <td class="px-4 py-3 text-right text-slate-500">${p.min_stock_alert}</td>
        <td class="px-4 py-3 text-center">
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${p.stock_quantity <= 0 ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-900'}">
            ${p.stock_quantity <= 0 ? 'Out of Stock' : 'Low Stock'}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <input 
              type="number" 
              id="restock-qty-${p.id}" 
              placeholder="Qty" 
              class="w-20 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
              value="10"
              min="1"
            >
            <button 
              onclick="submitQuickRestock(${p.id})" 
              class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded shadow-xs"
            >
              + Add
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading low stock:', err);
  }
}

async function submitQuickRestock(productId) {
  const input = document.getElementById(`restock-qty-${productId}`);
  const qty = parseFloat(input.value);
  if (isNaN(qty) || qty <= 0) {
    showToast('Enter a valid restock quantity', true);
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}/quick-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ add_quantity: qty })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);
      await loadProducts();
      loadLowStockItems();
    }
  } catch (err) {
    showToast('Restock failed', true);
  }
}

function updateLowStockBadge() {
  const lowCount = allProducts.filter(p => p.stock_quantity <= p.min_stock_alert).length;
  const badge = document.getElementById('low-stock-badge');
  const mBadge = document.getElementById('m-low-stock-badge');
  if (badge) {
    if (lowCount > 0) {
      badge.innerText = lowCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (mBadge) {
    if (lowCount > 0) {
      mBadge.innerText = lowCount;
      mBadge.classList.remove('hidden');
    } else {
      mBadge.classList.add('hidden');
    }
  }
}

// ==========================================================
// 4. CUSTOMERS & UDHAAR LEDGER
// ==========================================================

async function loadCustomerDropdown() {
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    if (data.status === 'success') {
      allCustomers = data.customers;
      const select = document.getElementById('bill-customer-select');
      if (select) {
        select.innerHTML = '<option value="">👤 Walk-in Customer (Cash / UPI)</option>' +
          allCustomers.map(c => `
            <option value="${c.id}">
              ${c.name} ${c.phone ? '(' + c.phone + ')' : ''} ${c.udhaar_balance > 0 ? ' - [Udhaar: ' + formatCurrency(c.udhaar_balance) + ']' : ''}
            </option>
          `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading customer dropdown:', err);
  }
}

async function loadCustomers() {
  const search = (document.getElementById('customer-search').value || '').trim();
  const tbody = document.getElementById('customers-table-body');

  try {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(search)}`);
    const data = await res.json();
    
    if (data.customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-16 text-slate-500">
            <div class="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <i data-lucide="user-plus" class="w-7 h-7"></i>
            </div>
            <p class="text-base font-bold text-slate-800">No customers registered yet</p>
            <p class="text-xs text-slate-500 mt-1 mb-4">Add your regular customers to keep track of Udhaar and credit bills.</p>
            <button onclick="openModal('add-customer-modal')" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition inline-flex items-center gap-2">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>+ Add Customer</span>
            </button>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = data.customers.map(c => {
      const hasBalance = c.udhaar_balance > 0;
      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="px-4 py-3 font-semibold text-slate-800">${c.name}</td>
          <td class="px-4 py-3 text-slate-600">${c.phone || '-'}</td>
          <td class="px-4 py-3 text-slate-500 text-xs">${c.address || '-'}</td>
          <td class="px-4 py-3 text-right font-extrabold ${hasBalance ? 'text-red-600' : 'text-emerald-700'}">
            ${formatCurrency(c.udhaar_balance)}
          </td>
          <td class="px-4 py-3 text-center">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${hasBalance ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}">
              ${hasBalance ? 'Payment Due' : 'All Clear'}
            </span>
          </td>
          <td class="px-4 py-3 text-center">
            <div class="flex items-center justify-center space-x-2">
              <button 
                onclick="viewLedger(${c.id})" 
                class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold flex items-center gap-1 transition"
              >
                <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Ledger
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

async function saveCustomer(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cust-name').value.trim(),
    phone: document.getElementById('cust-phone').value.trim(),
    address: document.getElementById('cust-address').value.trim()
  };

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);
      closeModal('add-customer-modal');
      document.getElementById('customer-form').reset();
      await loadCustomerDropdown();
      loadCustomers();
    }
  } catch (err) {
    showToast('Failed to add customer', true);
  }
}

async function viewLedger(customerId) {
  try {
    const res = await fetch(`/api/customers/${customerId}/ledger`);
    const data = await res.json();
    if (data.status === 'success') {
      const c = data.customer;
      document.getElementById('ledger-cust-name').innerText = c.name;
      document.getElementById('ledger-cust-phone').innerText = `Phone: ${c.phone || 'N/A'} | Address: ${c.address || 'N/A'}`;
      document.getElementById('ledger-total-credit').innerText = formatCurrency(c.total_credit);
      document.getElementById('ledger-total-paid').innerText = formatCurrency(c.total_paid);
      document.getElementById('ledger-balance-due').innerText = formatCurrency(c.balance);

      document.getElementById('repay-cust-id').value = c.id;

      const entriesList = document.getElementById('ledger-entries-list');
      if (data.entries.length === 0) {
        entriesList.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No ledger transactions found.</p>';
      } else {
        entriesList.innerHTML = data.entries.map(e => `
          <div class="flex justify-between items-center p-2.5 rounded-lg border ${e.entry_type === 'credit' ? 'border-red-100 bg-red-50/40' : 'border-emerald-100 bg-emerald-50/40'} text-xs">
            <div>
              <span class="font-bold ${e.entry_type === 'credit' ? 'text-red-700' : 'text-emerald-700'} uppercase">
                ${e.entry_type === 'credit' ? '🛒 Credit Purchase' : '💵 Payment Received'}
              </span>
              <p class="text-slate-500 text-[11px]">${e.notes || ''} ${e.invoice_no ? `(Inv: ${e.invoice_no})` : ''}</p>
              <span class="text-[10px] text-slate-400">${e.created_at}</span>
            </div>
            <div class="font-extrabold text-sm ${e.entry_type === 'credit' ? 'text-red-600' : 'text-emerald-700'}">
              ${e.entry_type === 'credit' ? '+' : '-'}${formatCurrency(e.amount)}
            </div>
          </div>
        `).join('');
      }

      openModal('customer-ledger-modal');
    }
  } catch (err) {
    showToast('Failed to load ledger', true);
  }
}

async function submitRepayment(e) {
  e.preventDefault();
  const customerId = document.getElementById('repay-cust-id').value;
  const amount = parseFloat(document.getElementById('repay-amount').value);
  const notes = document.getElementById('repay-notes').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showToast('Enter a valid payment amount', true);
    return;
  }

  try {
    const res = await fetch(`/api/customers/${customerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, notes })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(data.message);
      document.getElementById('repay-form').reset();
      viewLedger(customerId); // Refresh ledger modal
      loadCustomers();
      loadCustomerDropdown();
      loadReports();
    }
  } catch (err) {
    showToast('Error recording repayment', true);
  }
}

// ==========================================================
// 5. SALES REPORTS & ANALYTICS
// ==========================================================

async function loadReports() {
  try {
    const res = await fetch('/api/reports');
    const data = await res.json();
    if (data.status === 'success') {
      document.getElementById('rep-today-sales').innerText = formatCurrency(data.today_sales);
      document.getElementById('rep-today-bills').innerText = `${data.today_bills} Bills generated`;

      document.getElementById('rep-weekly-sales').innerText = formatCurrency(data.weekly_sales);
      document.getElementById('rep-weekly-bills').innerText = `${data.weekly_bills} Bills`;

      document.getElementById('rep-monthly-sales').innerText = formatCurrency(data.monthly_sales);
      document.getElementById('rep-monthly-bills').innerText = `${data.monthly_bills} Bills`;

      document.getElementById('rep-total-profit').innerText = formatCurrency(data.total_profit);

      document.getElementById('summary-total-products').innerText = data.total_products;
      document.getElementById('summary-total-udhaar').innerText = formatCurrency(data.total_outstanding_udhaar);
      document.getElementById('summary-low-stock').innerText = data.low_stock_count;

      // Top Products Table
      const topTable = document.getElementById('top-products-table');
      if (data.top_products.length === 0) {
        topTable.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">No sales recorded yet.</td></tr>';
      } else {
        topTable.innerHTML = data.top_products.map((p, idx) => `
          <tr class="hover:bg-slate-50">
            <td class="py-2.5 px-3 font-bold text-slate-400">#${idx + 1}</td>
            <td class="py-2.5 px-3 font-semibold text-slate-800">${p.product_name}</td>
            <td class="py-2.5 px-3 text-right font-medium text-slate-700">${p.total_quantity_sold} ${p.unit}</td>
            <td class="py-2.5 px-3 text-right font-bold text-slate-900">${formatCurrency(p.total_revenue)}</td>
            <td class="py-2.5 px-3 text-right font-bold text-emerald-600">+${formatCurrency(p.item_profit)}</td>
          </tr>
        `).join('');
      }

      loadRecentSales();
    }
  } catch (err) {
    console.error('Error loading reports:', err);
  }
}

async function loadRecentSales() {
  try {
    const res = await fetch('/api/billing/recent');
    const data = await res.json();
    const tbody = document.getElementById('recent-sales-table');
    
    if (data.sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-slate-400">No invoices yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.sales.map(s => `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="px-4 py-2.5 font-mono font-bold text-amber-700 text-xs">${s.invoice_no}</td>
        <td class="px-4 py-2.5 text-slate-500 text-xs">${s.created_at}</td>
        <td class="px-4 py-2.5 font-medium text-slate-800">${s.customer_name}</td>
        <td class="px-4 py-2.5">
          <span class="uppercase text-[10px] font-bold px-2 py-0.5 rounded ${s.payment_mode === 'cash' ? 'bg-emerald-100 text-emerald-800' : s.payment_mode === 'upi' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}">
            ${s.payment_mode}
          </span>
        </td>
        <td class="px-4 py-2.5 text-right font-extrabold text-slate-900">${formatCurrency(s.total_amount)}</td>
        <td class="px-4 py-2.5 text-center">
          <button onclick="reprintInvoice('${s.invoice_no}')" class="p-1 text-slate-500 hover:text-amber-600 rounded" title="Print Invoice">
            <i data-lucide="printer" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading recent sales:', err);
  }
}

async function reprintInvoice(invoiceNo) {
  try {
    const res = await fetch(`/api/billing/invoices/${invoiceNo}`);
    const data = await res.json();
    if (data.status === 'success') {
      const inv = data.invoice;
      const formatted = {
        invoice_no: inv.invoice_no,
        date: inv.created_at,
        customer_name: inv.customer_name || 'Walk-in Customer',
        customer_phone: inv.customer_phone || '',
        payment_mode: (inv.payment_mode || '').toUpperCase(),
        items: inv.items,
        subtotal: inv.subtotal,
        discount: inv.discount,
        total_amount: inv.total_amount
      };
      prepareAndPrintReceipt(formatted);
    }
  } catch (err) {
    showToast('Failed to load invoice for printing', true);
  }
}

// ----------------------------------------------------------
// MODAL CONTROLS
// ----------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}
