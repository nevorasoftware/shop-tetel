import { cartStore } from './cart.js';
import { wishlistStore } from './wishlist.js';
import { deliveryService } from './delivery.js';
import { checkoutManager } from './checkout.js';
import { adminManager } from './admin.js';

class StoreApp {
  constructor() {
    this.products = [];
    this.activeCategory = 'Todos';
    this.activeSort = 'newest';
    this.searchQuery = '';
    this.selectedModalProduct = null;
    this.selectedModalSize = '';
    this.selectedModalColor = '';

    this.init();
  }

  async init() {
    await deliveryService.loadDepartments();
    await this.loadProducts();
    this.initHomeDeliveryWidget();
    this.initEventListeners();
    this.handleRouting();

    window.addEventListener('hashchange', () => this.handleRouting());
  }

  handleRouting() {
    const hash = window.location.hash;
    const storeView = document.getElementById('store-main-view');
    const checkoutView = document.getElementById('checkout-main-view');
    const adminView = document.getElementById('admin-main-view');

    if (hash.startsWith('#admin')) {
      adminManager.open();
    } else if (hash.startsWith('#checkout')) {
      if (storeView) storeView.style.display = 'none';
      if (adminView) adminView.style.display = 'none';
      if (checkoutView) checkoutView.style.display = 'block';
    } else {
      if (checkoutView) checkoutView.style.display = 'none';
      if (adminView) adminView.style.display = 'none';
      if (storeView) storeView.style.display = 'block';
    }
  }

  async loadProducts() {
    const grid = document.getElementById('products-grid');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
          <div style="display:inline-block; width:36px; height:36px; border:3px solid var(--color-accent); border-top-color:transparent; border-radius:50%; animation: spin 0.8s linear infinite;"></div>
          <p style="margin-top: 1rem; color: var(--color-text-muted);">Cargando colección exclusiva...</p>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams();
      if (this.activeCategory !== 'Todos') {
        if (this.activeCategory === 'Ofertas') {
          params.append('isSale', 'true');
        } else {
          params.append('category', this.activeCategory);
        }
      }
      if (this.activeSort) params.append('sort', this.activeSort);
      if (this.searchQuery) params.append('search', this.searchQuery);

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        this.products = data.data;
        this.renderProductsGrid();
      }
    } catch (e) {
      console.error('Error cargando catálogo:', e);
      if (grid) {
        grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--color-sale);">Error al cargar las prendas. Intenta recargar la página.</p>`;
      }
    }
  }

  renderProductsGrid() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (this.products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
          <h3>No se encontraron prendas</h3>
          <p>Prueba buscando con otros términos o seleccionando otra categoría.</p>
          <button class="btn btn-primary" onclick="storeApp.setCategory('Todos')" style="margin-top: 1rem;">Ver Todo</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.products.map(p => {
      const isWish = wishlistStore.hasItem(p.id);
      const mainImg = p.images && p.images.length > 0 ? p.images[0] : 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600';
      const hasDiscount = Boolean(p.discountPrice && p.discountPrice < p.price);
      const discountPercent = hasDiscount ? Math.round(((p.price - p.discountPrice) / p.price) * 100) : 0;

      return `
        <article class="product-card" id="card-${p.id}">
          <div class="product-media-container">
            <img src="${mainImg}" alt="${p.name}" class="product-image" loading="lazy">
            <div class="product-badges">
              ${hasDiscount ? `<span class="badge badge-sale">-${discountPercent}% OFF</span>` : ''}
              ${p.isNew ? `<span class="badge badge-new">NUEVO</span>` : ''}
              ${p.isFeatured ? `<span class="badge bg-gold">EXCLUSIVO</span>` : ''}
            </div>

            <button class="wishlist-toggle-btn ${isWish ? 'active' : ''}" onclick="storeApp.toggleWishlist('${p.id}')" title="Guardar en lista de deseos">
              ${isWish ? '❤️' : '🤍'}
            </button>

            <div class="product-quick-view-overlay">
              <button class="btn btn-sm btn-primary" onclick="storeApp.openQuickView('${p.id}')">
                👁️ Vista Rápida
              </button>
            </div>
          </div>

          <div class="product-info">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="product-sku-tag">SKU: ${p.sku}</span>
              <span class="badge ${p.stock <= 5 ? 'badge-low-stock' : 'badge-stock'}">
                ${p.stock > 0 ? `${p.stock} disponibles` : 'Agotado'}
              </span>
            </div>

            <h3 class="product-title" title="${p.name}">${p.name}</h3>

            <!-- Muestra de Colores -->
            <div class="product-colors-preview">
              ${(p.colors || []).slice(0, 4).map(c => `
                <span class="product-color-dot-mini" style="background-color: ${c.hex};" title="${c.name}"></span>
              `).join('')}
              ${(p.colors || []).length > 4 ? `<span style="font-size: 0.7rem; color: var(--color-text-subtle);">+${p.colors.length - 4}</span>` : ''}
            </div>

            <div class="product-pricing">
              <span class="price-current ${hasDiscount ? 'has-discount' : ''}">
                $${(hasDiscount ? p.discountPrice : p.price).toFixed(2)}
              </span>
              ${hasDiscount ? `<span class="price-original">$${p.price.toFixed(2)}</span>` : ''}
            </div>

            <div class="product-footer-actions">
              <button class="btn btn-sm btn-outline btn-full" onclick="storeApp.quickAddToCart('${p.id}')" ${p.stock <= 0 ? 'disabled' : ''}>
                ${p.stock > 0 ? '🛒 Agregar al Carrito' : 'Agotado'}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  setCategory(category) {
    this.activeCategory = category;
    document.querySelectorAll('.pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
    this.loadProducts();
  }

  setSort(sortValue) {
    this.activeSort = sortValue;
    this.loadProducts();
  }

  toggleWishlist(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const added = wishlistStore.toggle(product);
    this.renderProductsGrid();
    this.showToast(
      added ? `❤️ "${product.name}" agregada a tu lista de deseos` : `Prenda removida de tu lista`,
      added ? 'success' : 'info'
    );
  }

  quickAddToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const defaultSize = (product.sizes && product.sizes.length > 0) ? product.sizes[0] : 'Única';
    const defaultColor = (product.colors && product.colors.length > 0) ? product.colors[0].name : 'Estándar';

    cartStore.addItem(product, defaultSize, defaultColor, 1);
    this.showToast(`🛍️ Agregaste "${product.name}" al carrito`, 'success');
  }

  openQuickView(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.selectedModalProduct = product;
    this.selectedModalSize = product.sizes?.[0] || 'M';
    this.selectedModalColor = product.colors?.[0]?.name || 'Estándar';

    const modal = document.getElementById('product-quickview-modal');
    if (!modal) return;

    const hasDiscount = Boolean(product.discountPrice && product.discountPrice < product.price);
    const mainImg = product.images?.[0] || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600';

    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close-btn" onclick="storeApp.closeQuickView()">✕</button>
        <div class="product-modal-grid">
          <!-- Galería -->
          <div>
            <div class="modal-gallery-main">
              <img id="qv-main-image" src="${mainImg}" alt="${product.name}">
            </div>
            <div class="modal-thumbs">
              ${(product.images || []).map((img, i) => `
                <div class="modal-thumb ${i === 0 ? 'active' : ''}" onclick="storeApp.switchModalImage('${img}', this)">
                  <img src="${img}" alt="Miniatura ${i}">
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Información -->
          <div>
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
              <span class="badge" style="background:#f1f5f9; color: var(--color-primary); font-family: var(--font-mono);">SKU: ${product.sku}</span>
              <span class="badge" style="background:#f1f5f9; color: var(--color-text-main);">${product.category}</span>
              ${hasDiscount ? '<span class="badge badge-sale">OFERTA ESPECIAL</span>' : ''}
            </div>

            <h2 style="font-size: 1.85rem; line-height: 1.2; margin-bottom: 0.75rem;">${product.name}</h2>

            <div style="display: flex; align-items: baseline; gap: 1rem; margin-bottom: 1rem;">
              <span style="font-size: 1.85rem; font-weight: 800; color: ${hasDiscount ? 'var(--color-sale)' : 'var(--color-primary)'};">
                $${(hasDiscount ? product.discountPrice : product.price).toFixed(2)}
              </span>
              ${hasDiscount ? `<span style="font-size: 1.15rem; color: var(--color-text-subtle); text-decoration: line-through;">$${product.price.toFixed(2)}</span>` : ''}
              ${hasDiscount ? `<span style="font-size: 0.85rem; color: var(--color-success); font-weight: 700;">Ahorras $${(product.price - product.discountPrice).toFixed(2)}</span>` : ''}
            </div>

            <p style="font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.25rem;">
              ${product.description}
            </p>

            <!-- Selector de Colores -->
            <div style="margin-bottom: 1.25rem;">
              <label class="form-label">Color: <strong id="qv-selected-color-label">${this.selectedModalColor}</strong></label>
              <div style="display: flex; gap: 0.65rem; margin-top: 0.35rem;">
                ${(product.colors || []).map((c, i) => `
                  <span class="color-dot ${i === 0 ? 'active' : ''}" style="background-color: ${c.hex};" onclick="storeApp.setModalColor('${c.name}', this)" title="${c.name}"></span>
                `).join('')}
              </div>
            </div>

            <!-- Selector de Tallas -->
            <div style="margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label class="form-label" style="margin: 0;">Selecciona tu Talla</label>
                <button style="font-size: 0.75rem; color: var(--color-accent); font-weight: 700;" onclick="storeApp.openSizeGuide()">📏 Guía de Tallas El Salvador</button>
              </div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${(product.sizes || []).map((s, i) => `
                  <button class="size-pill ${i === 0 ? 'active' : ''}" onclick="storeApp.setModalSize('${s}', this)">${s}</button>
                `).join('')}
              </div>
            </div>

            <!-- Botón Agregar -->
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem;">
              <button class="btn btn-gold btn-lg btn-full" onclick="storeApp.addModalProductToCart()">
                🛍️ Agregar al Carrito • $${(hasDiscount ? product.discountPrice : product.price).toFixed(2)}
              </button>
              <button class="btn-icon" style="width: 52px; height: 52px;" onclick="storeApp.toggleWishlist('${product.id}')" title="Guardar en deseos">
                ${wishlistStore.hasItem(product.id) ? '❤️' : '🤍'}
              </button>
            </div>

            <!-- Características -->
            ${product.features && product.features.length > 0 ? `
              <div style="border-top: 1px solid var(--color-border); padding-top: 1rem;">
                <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Detalles y Especificaciones:</h4>
                <ul class="product-specs-list">
                  ${product.features.map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <!-- Envíos SV -->
            <div style="background: #f8fafc; border-radius: var(--radius-md); padding: 0.85rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.75rem;">
              <span>🇸🇻</span>
              <div>
                <strong>Envíos garantizados a todo El Salvador</strong>
                <p style="margin: 0; font-size: 0.75rem;">Entrega en 24h a San Salvador y 48h al interior. Pagos con Wompi 3DS.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('product-quickview-backdrop').classList.add('active');
  }

  closeQuickView() {
    document.getElementById('product-quickview-backdrop').classList.remove('active');
  }

  switchModalImage(src, thumbEl) {
    document.getElementById('qv-main-image').src = src;
    document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
    thumbEl.classList.add('active');
  }

  setModalColor(colorName, dotEl) {
    this.selectedModalColor = colorName;
    document.getElementById('qv-selected-color-label').textContent = colorName;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dotEl.classList.add('active');
  }

  setModalSize(size, pillEl) {
    this.selectedModalSize = size;
    document.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
    pillEl.classList.add('active');
  }

  addModalProductToCart() {
    if (!this.selectedModalProduct) return;
    cartStore.addItem(this.selectedModalProduct, this.selectedModalSize, this.selectedModalColor, 1);
    this.closeQuickView();
    this.showToast(`🛍️ Agregaste "${this.selectedModalProduct.name}" al carrito`, 'success');
  }

  openSizeGuide() {
    alert(`
📏 GUÍA DE TALLAS TETEL EL SALVADOR:
- XS (Pecho 82-86 cm, Cintura 62-66 cm)
- S  (Pecho 86-90 cm, Cintura 66-70 cm)
- M  (Pecho 90-96 cm, Cintura 70-76 cm)
- L  (Pecho 96-102 cm, Cintura 76-82 cm)
- XL (Pecho 102-108 cm, Cintura 82-88 cm)
- XXL (Pecho 108-114 cm, Cintura 88-96 cm)
    `);
  }

  initHomeDeliveryWidget() {
    const deptSelect = document.getElementById('home-calc-dept');
    const districtSelect = document.getElementById('home-calc-dist');
    const resultCost = document.getElementById('home-calc-cost');
    const resultTime = document.getElementById('home-calc-time');

    if (!deptSelect) return;

    deliveryService.populateDepartmentSelect(deptSelect, 'San Salvador');
    deliveryService.populateDistrictSelect(districtSelect, 'San Salvador');

    const updateCalc = () => {
      const deptName = deptSelect.value;
      const info = deliveryService.calculateShipping(deptName, 0);
      if (resultCost) resultCost.textContent = `$${info.cost.toFixed(2)}`;
      if (resultTime) resultTime.textContent = `⏱️ ${info.time}`;
    };

    deptSelect.addEventListener('change', (e) => {
      deliveryService.populateDistrictSelect(districtSelect, e.target.value);
      updateCalc();
    });

    updateCalc();
  }

  initEventListeners() {
    // Input de búsqueda
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.loadProducts();
        }, 300);
      });
    }

    // Ordenamiento
    const sortSelect = document.getElementById('catalog-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.setSort(e.target.value);
      });
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Inicialización global
document.addEventListener('DOMContentLoaded', () => {
  window.storeApp = new StoreApp();
});
