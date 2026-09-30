import { deliveryService } from './delivery.js';

class CartStore {
  constructor() {
    this.items = this.loadFromStorage();
    this.selectedDepartment = localStorage.getItem('tetel_user_department') || 'San Salvador';
    this.freeShippingGoal = 60.00;
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem('tetel_cart');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveToStorage() {
    localStorage.setItem('tetel_cart', JSON.stringify(this.items));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: this.getItemCount() } }));
  }

  addItem(product, size = '', color = '', quantity = 1) {
    const existingIndex = this.items.findIndex(
      item => item.id === product.id && item.size === size && item.color === color
    );

    const price = product.discountPrice ?? product.price;

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '',
        price: parseFloat(price),
        originalPrice: parseFloat(product.price),
        size,
        color,
        quantity: parseInt(quantity, 10) || 1
      });
    }

    this.saveToStorage();
    this.renderDrawer();
    this.openDrawer();
  }

  removeItem(index) {
    this.items.splice(index, 1);
    this.saveToStorage();
    this.renderDrawer();
  }

  updateQuantity(index, quantity) {
    if (quantity <= 0) {
      this.removeItem(index);
    } else {
      this.items[index].quantity = quantity;
      this.saveToStorage();
      this.renderDrawer();
    }
  }

  clear() {
    this.items = [];
    this.saveToStorage();
    this.renderDrawer();
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getShippingInfo() {
    const subtotal = this.getSubtotal();
    return deliveryService.calculateShipping(this.selectedDepartment, subtotal);
  }

  getTotal() {
    const subtotal = this.getSubtotal();
    const shipping = this.getShippingInfo().cost;
    return subtotal + shipping;
  }

  setDepartment(deptName) {
    this.selectedDepartment = deptName;
    localStorage.setItem('tetel_user_department', deptName);
    this.renderDrawer();
  }

  openDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    if (backdrop) {
      backdrop.classList.add('active');
      this.renderDrawer();
    }
  }

  closeDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
    }
  }

  renderDrawer() {
    const container = document.getElementById('cart-items-container');
    const badgeElements = document.querySelectorAll('.cart-count-badge');
    const subtotalEl = document.getElementById('cart-subtotal-val');
    const shippingEl = document.getElementById('cart-shipping-val');
    const totalEl = document.getElementById('cart-total-val');
    const meterBar = document.getElementById('free-shipping-progress');
    const meterText = document.getElementById('free-shipping-msg');
    const deptSelect = document.getElementById('cart-dept-select');
    const checkoutBtn = document.getElementById('cart-checkout-btn');

    // Actualizar contadores
    const count = this.getItemCount();
    badgeElements.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });

    if (deptSelect && deptSelect.children.length <= 1) {
      deliveryService.populateDepartmentSelect(deptSelect, this.selectedDepartment);
      deptSelect.addEventListener('change', (e) => {
        this.setDepartment(e.target.value);
      });
    }

    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛍️</div>
          <h3>Tu carrito está vacío</h3>
          <p>Descubre prendas exclusivas y añade estilo a tu guardarropa.</p>
          <button class="btn btn-primary" onclick="cartStore.closeDrawer()">Ver Catálogo</button>
        </div>
      `;
      if (checkoutBtn) checkoutBtn.disabled = true;
      if (subtotalEl) subtotalEl.textContent = '$0.00';
      if (shippingEl) shippingEl.textContent = '$0.00';
      if (totalEl) totalEl.textContent = '$0.00';
      if (meterBar) meterBar.style.width = '0%';
      if (meterText) meterText.innerHTML = `Agrega <strong>$${this.freeShippingGoal.toFixed(2)}</strong> para <strong>ENVÍO GRATIS</strong> en El Salvador`;
      return;
    }

    if (checkoutBtn) checkoutBtn.disabled = false;

    // Medidor de Envío Gratis
    const subtotal = this.getSubtotal();
    const shippingInfo = this.getShippingInfo();
    const remaining = Math.max(0, this.freeShippingGoal - subtotal);
    const progressPercent = Math.min(100, (subtotal / this.freeShippingGoal) * 100);

    if (meterBar) meterBar.style.width = `${progressPercent}%`;
    if (meterText) {
      if (remaining === 0) {
        meterText.innerHTML = `🎉 <strong>¡Felicidades!</strong> Tienes <strong>ENVÍO GRATIS</strong> a todo El Salvador`;
      } else {
        meterText.innerHTML = `Agrega <strong>$${remaining.toFixed(2)}</strong> más para <strong>ENVÍO GRATIS</strong>`;
      }
    }

    // Renderizar Artículos
    container.innerHTML = this.items.map((item, idx) => `
      <div class="cart-item">
        <div class="cart-item-image">
          <img src="${item.image || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=200'}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.name}</h4>
          <div class="cart-item-meta">
            ${item.size ? `<span class="cart-item-meta-badge">Talla: ${item.size}</span>` : ''}
            ${item.color ? `<span class="cart-item-meta-badge">${item.color}</span>` : ''}
          </div>
          <div class="cart-item-stepper">
            <button class="stepper-btn" onclick="cartStore.updateQuantity(${idx}, ${item.quantity - 1})" aria-label="Disminuir">-</button>
            <span class="stepper-value">${item.quantity}</span>
            <button class="stepper-btn" onclick="cartStore.updateQuantity(${idx}, ${item.quantity + 1})" aria-label="Aumentar">+</button>
          </div>
        </div>
        <div class="cart-item-price-col">
          <span class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
          <button class="cart-item-remove-btn" onclick="cartStore.removeItem(${idx})" title="Eliminar Prenda">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Actualizar Totales
    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (shippingEl) {
      shippingEl.textContent = shippingInfo.isFree ? 'GRATIS' : `$${shippingInfo.cost.toFixed(2)}`;
      shippingEl.className = shippingInfo.isFree ? 'text-gold' : '';
    }
    if (totalEl) totalEl.textContent = `$${this.getTotal().toFixed(2)}`;
  }
}

export const cartStore = new CartStore();
window.cartStore = cartStore;
