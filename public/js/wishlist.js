import { cartStore } from './cart.js';

class WishlistStore {
  constructor() {
    this.items = this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem('tetel_wishlist');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveToStorage() {
    localStorage.setItem('tetel_wishlist', JSON.stringify(this.items));
    this.updateBadges();
    window.dispatchEvent(new CustomEvent('wishlist-updated', { detail: { count: this.items.length } }));
  }

  hasItem(id) {
    return this.items.some(item => item.id === id);
  }

  toggle(product) {
    const idx = this.items.findIndex(item => item.id === product.id);
    let added = false;
    if (idx > -1) {
      this.items.splice(idx, 1);
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '',
        price: parseFloat(product.discountPrice ?? product.price),
        originalPrice: parseFloat(product.price),
        category: product.category,
        stock: product.stock
      });
      added = true;
    }
    this.saveToStorage();
    this.renderDrawer();
    return added;
  }

  moveToCart(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    cartStore.addItem({
      id: item.id,
      name: item.name,
      sku: item.sku,
      images: [item.image],
      price: item.price,
      discountPrice: item.price !== item.originalPrice ? item.price : null
    }, 'M', 'Estándar', 1);

    this.toggle(item); // remover de lista de deseos
  }

  openDrawer() {
    const backdrop = document.getElementById('wishlist-drawer-backdrop');
    if (backdrop) {
      backdrop.classList.add('active');
      this.renderDrawer();
    }
  }

  closeDrawer() {
    const backdrop = document.getElementById('wishlist-drawer-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
    }
  }

  updateBadges() {
    const badges = document.querySelectorAll('.wishlist-count-badge');
    badges.forEach(b => {
      b.textContent = this.items.length;
      b.style.display = this.items.length > 0 ? 'flex' : 'none';
    });
  }

  renderDrawer() {
    this.updateBadges();
    const container = document.getElementById('wishlist-items-container');
    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🤍</div>
          <h3>Tu lista de deseos está vacía</h3>
          <p>Guarda tus prendas favoritas tocando el corazón para comprarlas después.</p>
          <button class="btn btn-primary" onclick="wishlistStore.closeDrawer()">Explorar Colección</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-image">
          <img src="${item.image || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=200'}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <h4 class="cart-item-title">${item.name}</h4>
          <span class="product-sku-tag">SKU: ${item.sku}</span>
          <span class="cart-item-price">$${item.price.toFixed(2)}</span>
          <button class="btn btn-sm btn-outline" style="margin-top: 0.5rem; width: fit-content;" onclick="wishlistStore.moveToCart('${item.id}')">
            🛒 Mover al Carrito
          </button>
        </div>
        <button class="cart-item-remove-btn" onclick="wishlistStore.toggle({ id: '${item.id}' })" title="Quitar de deseos">
          ✕
        </button>
      </div>
    `).join('');
  }
}

export const wishlistStore = new WishlistStore();
window.wishlistStore = wishlistStore;
