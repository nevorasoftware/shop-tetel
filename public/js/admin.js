import { adminAuth } from './auth.js';

class AdminManager {
  constructor() {
    this.activeTab = 'products';
    this.products = [];
    this.orders = [];
    this.categoriesTree = [];
    this.categoriesFlat = [];
    this.editingProductId = null;
    this.editingCategoryId = null;
    this.initListeners();
  }

  initListeners() {
    // Escuchar hash para abrir admin
    window.addEventListener('hashchange', () => {
      if (window.location.hash.startsWith('#admin')) {
        this.open();
      }
    });

    // Subida de imagen
    const fileInput = document.getElementById('admin-product-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.success) {
            document.getElementById('admin-product-image-url').value = data.url;
            this.updateImagePreview(data.url);
          } else {
            alert('Error al subir imagen: ' + data.error);
          }
        } catch (err) {
          alert('Error de conexión al subir la foto');
        }
      });
    }

    const urlInput = document.getElementById('admin-product-image-url');
    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        this.updateImagePreview(e.target.value);
      });
    }
  }

  updateImagePreview(url) {
    const previewEl = document.getElementById('admin-product-img-preview');
    if (previewEl) {
      if (url) {
        previewEl.src = url;
        previewEl.style.display = 'block';
      } else {
        previewEl.style.display = 'none';
      }
    }
  }

  async open() {
    if (!adminAuth.isAuthenticated()) {
      adminAuth.showLoginModal();
      return;
    }

    const storeView = document.getElementById('store-main-view');
    const checkoutView = document.getElementById('checkout-main-view');
    if (storeView) storeView.style.display = 'none';
    if (checkoutView) checkoutView.style.display = 'none';

    const adminView = document.getElementById('admin-main-view');
    if (adminView) {
      adminView.style.display = 'flex';

      const userDisplay = document.getElementById('admin-user-display');
      if (userDisplay) {
        const user = adminAuth.getUser();
        userDisplay.textContent = user.email || 'admin@tetel.com';
      }

      this.switchTab(this.activeTab);

      try { await this.loadMetrics(); } catch(e) { console.warn('Métricas:', e); }
      try { await this.loadCategories(); } catch(e) { console.warn('Categorías:', e); }
      try { await this.loadProducts(); } catch(e) { console.warn('Productos:', e); }
      try { await this.loadOrders(); } catch(e) { console.warn('Pedidos:', e); }
      try { await this.loadSettings(); } catch(e) { console.warn('Ajustes:', e); }
    }
  }

  close() {
    const adminView = document.getElementById('admin-main-view');
    if (adminView) adminView.style.display = 'none';
    const storeView = document.getElementById('store-main-view');
    if (storeView) storeView.style.display = 'block';
    window.location.hash = '';

    if (window.storeApp) {
      window.storeApp.loadProducts();
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.admin-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });

    const panels = ['products', 'categories', 'orders', 'delivery', 'settings'];
    panels.forEach(p => {
      const panelEl = document.getElementById(`admin-panel-${p}`);
      if (panelEl) {
        panelEl.style.display = p === tabName ? 'block' : 'none';
      }
    });

    if (tabName === 'products') this.renderProductsTable();
    if (tabName === 'categories') this.renderCategoriesTable();
    if (tabName === 'orders') this.renderOrdersTable();
    if (tabName === 'delivery') this.renderDeliveryTable();
  }

  async loadMetrics() {
    try {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      if (data.success) {
        const m = data.data;
        const totalSalesEl = document.getElementById('metric-total-sales');
        if (totalSalesEl) totalSalesEl.textContent = `$${m.totalSales.toFixed(2)}`;
        const totalOrdersEl = document.getElementById('metric-total-orders');
        if (totalOrdersEl) totalOrdersEl.textContent = m.totalOrders;
        const totalProductsEl = document.getElementById('metric-total-products');
        if (totalProductsEl) totalProductsEl.textContent = m.totalProducts;
        const lowStockEl = document.getElementById('metric-low-stock');
        if (lowStockEl) lowStockEl.textContent = m.lowStockProducts;
      }
    } catch (e) {
      console.error('Error cargando métricas:', e);
    }
  }

  // ==============================================================================
  // GESTIÓN DE CATEGORÍAS Y SUBCATEGORÍAS
  // ==============================================================================

  async loadCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        this.categoriesTree = data.data.tree || [];
        this.categoriesFlat = data.data.flat || [];
        this.populateProductCategoriesSelect();
        this.renderCategoriesTable();
      }
    } catch (e) {
      console.error('Error cargando categorías:', e);
    }
  }

  renderCategoriesTable() {
    const tbody = document.getElementById('admin-categories-table-body');
    if (!tbody) return;

    if (this.categoriesTree.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">No hay categorías registradas. Haz clic en "＋ Nueva Categoría".</td></tr>`;
      return;
    }

    const rows = [];
    this.categoriesTree.forEach(parent => {
      // Fila de categoría principal
      const subBadges = parent.subcategories && parent.subcategories.length > 0
        ? parent.subcategories.map(s => `<span class="badge" style="background: rgba(217, 119, 6, 0.15); color: #d97706; margin: 2px; font-size: 0.75rem;">${s.name}</span>`).join(' ')
        : '<span style="color: #64748b; font-size: 0.8rem;">Sin subcategorías</span>';

      rows.push(`
        <tr style="background: rgba(255,255,255,0.02); font-weight: 600;">
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.1rem;">📁</span>
              <strong style="font-size: 0.95rem;">${parent.name}</strong>
            </div>
          </td>
          <td><span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">Principal</span></td>
          <td><code style="font-size: 0.8rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${parent.slug}</code></td>
          <td><span style="color: #64748b;">—</span></td>
          <td>${subBadges}</td>
          <td style="font-size: 0.85rem; color: #94a3b8; max-width: 200px;">${parent.description || '—'}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-sm btn-outline" onclick="adminManager.openNewCategoryModal(${parent.id})" title="Agregar Subcategoría a ${parent.name}">
                ＋ Sub
              </button>
              <button class="btn btn-sm btn-secondary" onclick="adminManager.openEditCategoryModal(${parent.id})">
                Editar
              </button>
              <button class="btn btn-sm btn-outline" style="color: var(--color-sale); border-color: rgba(239, 68, 68, 0.3);" onclick="adminManager.deleteCategory(${parent.id}, '${parent.name}')">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `);

      // Filas anidadas de subcategorías
      if (parent.subcategories) {
        parent.subcategories.forEach(sub => {
          rows.push(`
            <tr style="font-size: 0.88rem;">
              <td style="padding-left: 2.25rem;">
                <div style="display: flex; align-items: center; gap: 0.4rem; color: #cbd5e1;">
                  <span style="color: var(--color-accent);">↳</span>
                  <span>${sub.name}</span>
                </div>
              </td>
              <td><span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">Subcategoría</span></td>
              <td><code style="font-size: 0.78rem; background: rgba(0,0,0,0.3); padding: 2px 5px; border-radius: 4px;">${sub.slug}</code></td>
              <td><strong style="color: #f1f5f9;">${parent.name}</strong></td>
              <td><span style="color: #64748b; font-size: 0.75rem;">—</span></td>
              <td style="font-size: 0.8rem; color: #94a3b8;">${sub.description || '—'}</td>
              <td>
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-sm btn-secondary" onclick="adminManager.openEditCategoryModal(${sub.id})">
                    Editar
                  </button>
                  <button class="btn btn-sm btn-outline" style="color: var(--color-sale); border-color: rgba(239, 68, 68, 0.3);" onclick="adminManager.deleteCategory(${sub.id}, '${sub.name}')">
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          `);
        });
      }
    });

    tbody.innerHTML = rows.join('');
  }

  openNewCategoryModal(parentId = null) {
    this.editingCategoryId = null;
    const form = document.getElementById('admin-category-form');
    if (form) form.reset();
    document.getElementById('form-category-id').value = '';
    document.getElementById('category-modal-title').textContent = parentId
      ? 'Crear Nueva Subcategoría'
      : 'Crear Nueva Categoría o Subcategoría';

    this.populateParentCategoryDropdown(parentId);

    if (parentId) {
      document.getElementById('cat-type-sub').checked = true;
      this.toggleCategoryParentSelect(true);
    } else {
      document.getElementById('cat-type-main').checked = true;
      this.toggleCategoryParentSelect(false);
    }

    const modal = document.getElementById('admin-category-modal-backdrop');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  }

  openEditCategoryModal(id) {
    const cat = this.categoriesFlat.find(c => Number(c.id) === Number(id));
    if (!cat) return;

    this.editingCategoryId = id;
    document.getElementById('category-modal-title').textContent = `Editar: ${cat.name}`;
    document.getElementById('form-category-id').value = cat.id;
    document.getElementById('form-category-name').value = cat.name;
    document.getElementById('form-category-slug').value = cat.slug;
    document.getElementById('form-category-description').value = cat.description || '';

    this.populateParentCategoryDropdown(cat.parentId || cat.parent_id);

    const isSub = Boolean(cat.parentId || cat.parent_id);
    if (isSub) {
      document.getElementById('cat-type-sub').checked = true;
      this.toggleCategoryParentSelect(true);
    } else {
      document.getElementById('cat-type-main').checked = true;
      this.toggleCategoryParentSelect(false);
    }

    const modal = document.getElementById('admin-category-modal-backdrop');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  }

  closeCategoryModal() {
    const modal = document.getElementById('admin-category-modal-backdrop');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  toggleCategoryParentSelect(isSub) {
    const group = document.getElementById('group-category-parent');
    if (group) group.style.display = isSub ? 'block' : 'none';
  }

  populateParentCategoryDropdown(selectedParentId = null) {
    const select = document.getElementById('form-category-parent');
    if (!select) return;

    const parents = this.categoriesTree;
    select.innerHTML = parents.map(p => `
      <option value="${p.id}" ${Number(selectedParentId) === Number(p.id) ? 'selected' : ''}>
        ${p.name} (${p.slug})
      </option>
    `).join('');
  }

  autoSlugCategory(name) {
    const slugInput = document.getElementById('form-category-slug');
    if (slugInput && !this.editingCategoryId) {
      slugInput.value = name.toLowerCase().trim()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  }

  async saveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('form-category-id').value;
    const name = document.getElementById('form-category-name').value.trim();
    const slug = document.getElementById('form-category-slug').value.trim();
    const description = document.getElementById('form-category-description').value.trim();
    const isSub = document.getElementById('cat-type-sub').checked;
    const parentId = isSub ? document.getElementById('form-category-parent').value : null;

    if (!name) {
      alert('El nombre es obligatorio');
      return;
    }

    const payload = {
      name,
      slug,
      parentId,
      description
    };

    try {
      const url = id ? `/api/categories/${id}` : '/api/categories';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        this.closeCategoryModal();
        await this.loadCategories();
        alert(id ? 'Categoría actualizada exitosamente.' : 'Categoría creada exitosamente.');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión al guardar la categoría');
    }
  }

  async deleteCategory(id, name) {
    if (!confirm(`¿Eliminar la categoría "${name}"? Si es una categoría principal, también se eliminarán sus subcategorías asociadas.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadCategories();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error al eliminar categoría');
    }
  }

  populateProductCategoriesSelect() {
    const catSelect = document.getElementById('form-product-category');
    if (!catSelect) return;

    const currentVal = catSelect.value;
    const categoriesList = this.categoriesTree.length > 0
      ? this.categoriesTree.map(c => c.name)
      : ['Chaquetas', 'Camisas', 'Pantalones', 'Calzado', 'Accesorios', 'Mujer', 'Hombre', 'Unisex'];

    catSelect.innerHTML = categoriesList.map(name => `
      <option value="${name}" ${name === currentVal ? 'selected' : ''}>${name}</option>
    `).join('');

    this.onProductCategoryChange(catSelect.value || categoriesList[0]);
  }

  onProductCategoryChange(categoryName) {
    const datalist = document.getElementById('product-subcategories-datalist');
    if (!datalist) return;

    // Buscar categoría en categoriesTree
    const foundParent = this.categoriesTree.find(
      c => c.name.toLowerCase() === (categoryName || '').toLowerCase()
    );

    if (foundParent && foundParent.subcategories && foundParent.subcategories.length > 0) {
      datalist.innerHTML = foundParent.subcategories.map(s => `
        <option value="${s.name}"></option>
      `).join('');
    } else {
      datalist.innerHTML = '';
    }
  }

  // ==============================================================================
  // GESTIÓN DE PRENDAS / PRODUCTOS
  // ==============================================================================

  async loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        this.products = data.data;
        this.renderProductsTable();
      }
    } catch (e) {
      console.error('Error cargando productos en admin:', e);
    }
  }

  renderProductsTable(filterTerm = '') {
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;

    const term = filterTerm.toLowerCase();
    const list = this.products.filter(p =>
      p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
    );

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #94a3b8;">No se encontraron prendas registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => `
      <tr>
        <td>
          <img src="${p.images?.[0] || '/assets/chaqueta-cuero-bandana.png'}" class="admin-table-img" alt="${p.name}">
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-weight: 700; color: #ffffff;">${p.sku}</span>
        </td>
        <td>
          <strong>${p.name}</strong>
          ${p.isFeatured ? '<span class="badge" style="background: rgba(217, 119, 6, 0.15); color: #d97706; margin-left: 0.35rem; font-size: 0.65rem;">★ Destacado</span>' : ''}
          ${p.isSale ? '<span class="badge" style="background: rgba(220, 38, 38, 0.15); color: var(--color-sale); margin-left: 0.35rem; font-size: 0.65rem;">Oferta</span>' : ''}
        </td>
        <td>
          <span class="badge">${p.category}</span>
          ${p.subcategory ? `<div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px;">${p.subcategory}</div>` : ''}
        </td>
        <td>
          ${p.discountPrice ? `
            <div>
              <strong style="color: var(--color-sale);">$${p.discountPrice.toFixed(2)}</strong>
              <span style="text-decoration: line-through; color: #64748b; font-size: 0.8rem; margin-left: 0.25rem;">$${p.price.toFixed(2)}</span>
            </div>
          ` : `
            <strong>$${p.price.toFixed(2)}</strong>
          `}
        </td>
        <td>
          <span class="stock-badge ${p.stock <= 5 ? 'stock-low' : 'stock-ok'}">
            ${p.stock} un.
          </span>
        </td>
        <td>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">Publicado</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-sm btn-secondary" onclick="adminManager.openEditProductModal('${p.id}')">
              Editar
            </button>
            <button class="btn btn-sm btn-outline" style="color: var(--color-sale); border-color: rgba(239, 68, 68, 0.3);" onclick="adminManager.deleteProduct('${p.id}')">
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openNewProductModal() {
    this.editingProductId = null;
    document.getElementById('product-modal-title').textContent = 'Subir Nueva Prenda al Catálogo';
    document.getElementById('admin-product-form').reset();
    document.getElementById('admin-product-id').value = '';
    this.updateImagePreview('');
    this.populateProductCategoriesSelect();

    const randomSku = 'TTL-' + Math.floor(100 + Math.random() * 900);
    document.getElementById('form-product-sku').value = randomSku;

    document.getElementById('admin-product-modal-backdrop').classList.add('active');
  }

  openEditProductModal(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;

    this.editingProductId = id;
    this.populateProductCategoriesSelect();

    document.getElementById('product-modal-title').textContent = `Editar Prenda: ${product.name}`;
    document.getElementById('admin-product-id').value = product.id;
    document.getElementById('form-product-name').value = product.name;
    document.getElementById('form-product-sku').value = product.sku;
    document.getElementById('form-product-category').value = product.category;
    this.onProductCategoryChange(product.category);
    document.getElementById('form-product-subcategory').value = product.subcategory || '';
    document.getElementById('form-product-price').value = product.price;
    document.getElementById('form-product-discount-price').value = product.discountPrice || '';
    document.getElementById('form-product-stock').value = product.stock;
    document.getElementById('admin-product-image-url').value = product.images?.[0] || '';
    document.getElementById('form-product-desc').value = product.description || '';
    document.getElementById('form-product-features').value = (product.features || []).join('\n');
    document.getElementById('form-product-is-sale').checked = Boolean(product.isSale);
    document.getElementById('form-product-is-featured').checked = Boolean(product.isFeatured);

    const availableSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    availableSizes.forEach(s => {
      const chk = document.getElementById(`size-check-${s}`);
      if (chk) chk.checked = (product.sizes || []).includes(s);
    });

    this.updateImagePreview(product.images?.[0] || '');
    document.getElementById('admin-product-modal-backdrop').classList.add('active');
  }

  closeProductModal() {
    document.getElementById('admin-product-modal-backdrop').classList.remove('active');
  }

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('admin-product-id').value;
    const name = document.getElementById('form-product-name').value.trim();
    const sku = document.getElementById('form-product-sku').value.trim().toUpperCase();
    const category = document.getElementById('form-product-category').value;
    const subcategory = document.getElementById('form-product-subcategory').value.trim();
    const price = parseFloat(document.getElementById('form-product-price').value);
    const discountVal = document.getElementById('form-product-discount-price').value;
    const discountPrice = discountVal ? parseFloat(discountVal) : null;
    const stock = parseInt(document.getElementById('form-product-stock').value, 10) || 0;
    const imageUrl = document.getElementById('admin-product-image-url').value.trim();
    const description = document.getElementById('form-product-desc').value.trim();
    const featuresRaw = document.getElementById('form-product-features').value.trim();
    const features = featuresRaw ? featuresRaw.split('\n').filter(Boolean) : [];
    const isSale = document.getElementById('form-product-is-sale').checked;
    const isFeatured = document.getElementById('form-product-is-featured').checked;

    const sizes = [];
    ['XS', 'S', 'M', 'L', 'XL', 'XXL'].forEach(s => {
      const chk = document.getElementById(`size-check-${s}`);
      if (chk && chk.checked) sizes.push(s);
    });

    const colors = [
      { name: 'Negro Clásico', hex: '#18181b' },
      { name: 'Champagne Satin', hex: '#dfd0b8' }
    ];

    const payload = {
      name,
      sku,
      category,
      subcategory,
      price,
      discountPrice,
      stock,
      sizes,
      colors,
      images: imageUrl ? [imageUrl] : ['/assets/the-new-era-full-rack.png'],
      description,
      features,
      isSale,
      isFeatured
    };

    try {
      const url = id ? `/api/products/${id}` : '/api/products';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert(id ? 'Prenda actualizada con éxito' : 'Prenda agregada al catálogo exitosamente');
        this.closeProductModal();
        await this.loadProducts();
        await this.loadMetrics();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión al guardar la prenda');
    }
  }

  async deleteProduct(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta prenda del catálogo?')) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadProducts();
        await this.loadMetrics();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error al eliminar');
    }
  }

  // ==============================================================================
  // GESTIÓN DE PEDIDOS
  // ==============================================================================

  async loadOrders() {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success) {
        this.orders = data.data;
        this.renderOrdersTable();
      }
    } catch (e) {
      console.error('Error cargando pedidos en admin:', e);
    }
  }

  renderOrdersTable() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: #94a3b8;">Aún no se han registrado compras.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.orders.map(o => `
      <tr>
        <td>
          <strong style="font-family: var(--font-mono); color: #ffffff;">${o.orderNumber}</strong>
          <div style="font-size: 0.75rem; color: #94a3b8;">${new Date(o.createdAt).toLocaleDateString()} ${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </td>
        <td>
          <strong>${o.customerName}</strong>
          <div style="font-size: 0.75rem; color: #94a3b8;">${o.customerPhone}</div>
        </td>
        <td>
          <div>${o.district || o.municipality}</div>
          <div style="font-size: 0.75rem; color: #94a3b8;">${o.department}</div>
        </td>
        <td>
          <strong style="color: var(--color-primary); font-size: 1.05rem;">$${o.total.toFixed(2)}</strong>
        </td>
        <td>
          <span class="badge ${o.paymentStatus === 'APROBADO' ? 'badge-sale' : ''}" style="${o.paymentStatus === 'APROBADO' ? 'background: rgba(16, 185, 129, 0.15); color: #34d399;' : ''}">
            ${o.paymentStatus}
          </span>
          ${o.wompiAuthCode ? `<div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-accent);">${o.wompiAuthCode}</div>` : ''}
        </td>
        <td>
          <select class="form-select" style="padding: 0.35rem 0.5rem; font-size: 0.8rem; width: auto;" onchange="adminManager.updateDeliveryStatus('${o.id}', this.value)">
            <option value="Procesando" ${o.deliveryStatus === 'Procesando' ? 'selected' : ''}>Procesando</option>
            <option value="En Preparación" ${o.deliveryStatus === 'En Preparación' ? 'selected' : ''}>En Preparación</option>
            <option value="Enviado" ${o.deliveryStatus === 'Enviado' ? 'selected' : ''}>Enviado</option>
            <option value="Entregado" ${o.deliveryStatus === 'Entregado' ? 'selected' : ''}>Entregado</option>
            <option value="Cancelado" ${o.deliveryStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="adminManager.viewOrderDetails('${o.id}')">
            Ver Ficha
          </button>
        </td>
      </tr>
    `).join('');
  }

  async renderDeliveryTable() {
    const grid = document.getElementById('admin-delivery-grid');
    if (!grid) return;

    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.success) {
        grid.innerHTML = data.data.map(d => `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; font-size: 1.05rem;">${d.name}</h4>
              <strong style="color: var(--color-primary); font-size: 1.1rem;">$${d.deliveryRate.toFixed(2)}</strong>
            </div>
            <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 0.75rem;">
              ⏱️ Tiempo de entrega: <strong>${d.deliveryTime}</strong>
            </div>
            <div style="font-size: 0.75rem; color: #64748b; line-height: 1.4;">
              ${d.municipalities.length} Municipios / ${d.municipalities.reduce((acc, m) => acc + m.districts.length, 0)} Distritos cubiertos.
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async updateDeliveryStatus(orderId, newStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}/delivery-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryStatus: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        const order = this.orders.find(o => o.id === orderId);
        if (order) order.deliveryStatus = newStatus;
      }
    } catch (err) {
      alert('Error al actualizar estado de entrega');
    }
  }

  async viewOrderDetails(orderId) {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success) {
        const o = data.data;
        alert(`
FICHA DE PEDIDO: ${o.orderNumber}
Fecha: ${new Date(o.createdAt).toLocaleString()}
Cliente: ${o.customerName} (${o.customerPhone})
Email: ${o.customerEmail}
Destino: ${o.district}, ${o.department}
Dirección: ${o.addressLine}
Total: $${o.total.toFixed(2)} USD
Pago: ${o.paymentStatus} (Código Auth 3DS: ${o.wompiAuthCode || 'N/A'})
Artículos:
${(o.items || []).map(i => ` - ${i.productName} (Talla: ${i.size}, Cant: ${i.quantity}) = $${i.subtotal.toFixed(2)}`).join('\n')}
        `);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async loadSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) {
        const s = data.data;
        const clientIdEl = document.getElementById('setting-wompi-client-id');
        const envEl = document.getElementById('setting-wompi-env');
        const simEl = document.getElementById('setting-wompi-sim');
        const freeShipEl = document.getElementById('setting-free-shipping');

        if (clientIdEl) clientIdEl.value = s.wompi_client_id || '';
        if (envEl) envEl.value = s.wompi_environment || 'desarrollo';
        if (simEl) simEl.checked = s.wompi_simulator_mode === 'true';
        if (freeShipEl) freeShipEl.value = s.free_shipping_threshold || '60.00';
      }
    } catch (e) {
      console.error('Error cargando configuración:', e);
    }
  }

  async saveWompiSettings(e) {
    e.preventDefault();
    const clientId = document.getElementById('setting-wompi-client-id').value.trim();
    const clientSecret = document.getElementById('setting-wompi-client-secret').value.trim();
    const env = document.getElementById('setting-wompi-env').value;
    const sim = document.getElementById('setting-wompi-sim').checked;
    const freeShip = document.getElementById('setting-free-shipping').value;

    const payload = {
      wompi_client_id: clientId,
      wompi_environment: env,
      wompi_simulator_mode: sim ? 'true' : 'false',
      free_shipping_threshold: freeShip
    };

    if (clientSecret) {
      payload.wompi_client_secret = clientSecret;
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Configuración de Pasarela 3DS y Tienda guardada exitosamente.');
      }
    } catch (err) {
      alert('Error guardando configuración');
    }
  }
}

export const adminManager = new AdminManager();
window.adminManager = adminManager;
