class AdminManager {
  constructor() {
    this.activeTab = 'products';
    this.products = [];
    this.orders = [];
    this.editingProductId = null;
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
    document.getElementById('store-main-view').style.display = 'none';
    document.getElementById('checkout-main-view').style.display = 'none';
    const adminView = document.getElementById('admin-main-view');
    if (adminView) {
      adminView.style.display = 'flex';
      await this.loadMetrics();
      await this.loadProducts();
      await this.loadOrders();
      await this.loadSettings();
      this.switchTab(this.activeTab);
    }
  }

  close() {
    const adminView = document.getElementById('admin-main-view');
    if (adminView) adminView.style.display = 'none';
    document.getElementById('store-main-view').style.display = 'block';
    window.location.hash = '';
    // Refrescar catálogo de la tienda
    if (window.storeApp) {
      window.storeApp.loadProducts();
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.admin-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });

    const panels = ['products', 'orders', 'delivery', 'settings'];
    panels.forEach(p => {
      const panelEl = document.getElementById(`admin-panel-${p}`);
      if (panelEl) {
        panelEl.style.display = p === tabName ? 'block' : 'none';
      }
    });

    if (tabName === 'products') this.renderProductsTable();
    if (tabName === 'orders') this.renderOrdersTable();
    if (tabName === 'delivery') this.renderDeliveryTable();
  }

  async loadMetrics() {
    try {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      if (data.success) {
        const m = data.data;
        document.getElementById('metric-total-sales').textContent = `$${m.totalSales.toFixed(2)}`;
        document.getElementById('metric-total-orders').textContent = m.totalOrders;
        document.getElementById('metric-total-products').textContent = m.totalProducts;
        document.getElementById('metric-low-stock').textContent = m.lowStockProducts;
      }
    } catch (e) {
      console.error('Error cargando métricas:', e);
    }
  }

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

  renderProductsTable(filterTerm = '') {
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;

    const term = filterTerm.toLowerCase();
    const list = this.products.filter(p =>
      p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
    );

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;">No se encontraron prendas con ese filtro.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => `
      <tr>
        <td>
          <img src="${p.images && p.images[0] ? p.images[0] : 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=100'}" class="table-product-thumb" alt="${p.name}">
        </td>
        <td>
          <strong style="color: var(--color-primary); font-family: var(--font-mono);">${p.sku}</strong>
        </td>
        <td>
          <div style="font-weight: 700;">${p.name}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${p.subcategory || p.category}</div>
        </td>
        <td>
          <span class="badge" style="background:#f1f5f9; color: var(--color-text-main);">${p.category}</span>
        </td>
        <td>
          $${p.price.toFixed(2)}
          ${p.discountPrice ? `<br><strong style="color: var(--color-sale); font-size: 0.85rem;">Oferta: $${p.discountPrice.toFixed(2)}</strong>` : ''}
        </td>
        <td>
          <span class="badge ${p.stock <= 5 ? 'badge-low-stock' : 'badge-stock'}">
            ${p.stock} un.
          </span>
        </td>
        <td>
          ${p.isSale ? '<span class="badge badge-sale">Oferta</span> ' : ''}
          ${p.isFeatured ? '<span class="badge" style="background: var(--color-accent); color: white;">Destacado</span>' : ''}
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-secondary" onclick="adminManager.openEditProductModal('${p.id}')" title="Editar Prenda">✏️</button>
            <button class="btn btn-sm btn-outline" style="color: var(--color-sale); border-color: var(--color-sale);" onclick="adminManager.deleteProduct('${p.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderOrdersTable() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">No hay pedidos registrados en la tienda aún.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.orders.map(o => `
      <tr>
        <td>
          <strong style="font-family: var(--font-mono);">${o.orderNumber}</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${new Date(o.createdAt).toLocaleDateString()}</div>
        </td>
        <td>
          <strong>${o.customerName}</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${o.customerPhone} | ${o.customerEmail}</div>
        </td>
        <td>
          <strong>${o.district}, ${o.department}</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${o.addressLine}</div>
        </td>
        <td>
          <strong style="font-size: 1rem; color: var(--color-primary);">$${o.total.toFixed(2)}</strong>
          <div style="font-size: 0.7rem; color: var(--color-text-muted);">Envío: $${o.shippingCost.toFixed(2)}</div>
        </td>
        <td>
          <span class="status-pill status-${o.paymentStatus.toLowerCase()}">
            ${o.paymentStatus === 'APROBADO' ? '✓ Aprobado (3DS)' : o.paymentStatus}
          </span>
          ${o.wompiAuthCode ? `<div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-wompi);">${o.wompiAuthCode}</div>` : ''}
        </td>
        <td>
          <select class="form-select" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: auto;" onchange="adminManager.updateDeliveryStatus('${o.id}', this.value)">
            <option value="Procesando" ${o.deliveryStatus === 'Procesando' ? 'selected' : ''}>Procesando</option>
            <option value="En Preparación" ${o.deliveryStatus === 'En Preparación' ? 'selected' : ''}>En Preparación</option>
            <option value="Enviado" ${o.deliveryStatus === 'En Enviado' ? 'selected' : ''}>Enviado</option>
            <option value="Entregado" ${o.deliveryStatus === 'Entregado' ? 'selected' : ''}>Entregado</option>
            <option value="Cancelado" ${o.deliveryStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="adminManager.viewOrderDetails('${o.id}')">Ver Detalle</button>
        </td>
      </tr>
    `).join('');
  }

  async renderDeliveryTable() {
    const container = document.getElementById('admin-delivery-grid');
    if (!container) return;

    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.success) {
        container.innerHTML = data.data.map(d => `
          <div style="background: white; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; font-size: 1.1rem;">${d.name}</h4>
              <span class="badge" style="background:#f1f5f9; color: var(--color-text-main);">${d.zone}</span>
            </div>
            <div style="font-size: 0.9rem; margin-bottom: 0.35rem;">
              Costo de Envío: <strong style="color: var(--color-primary);">$${d.shippingCost.toFixed(2)}</strong>
            </div>
            <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 0.75rem;">
              ⏱️ Tiempo de entrega: <strong>${d.deliveryTime}</strong>
            </div>
            <div style="font-size: 0.75rem; color: var(--color-text-subtle); line-height: 1.4;">
              ${d.municipalities.length} Municipios / ${d.municipalities.reduce((acc, m) => acc + m.districts.length, 0)} Distritos cubiertos.
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error(e);
    }
  }

  openNewProductModal() {
    this.editingProductId = null;
    document.getElementById('product-modal-title').textContent = 'Subir Nueva Prenda al Catálogo';
    document.getElementById('admin-product-form').reset();
    document.getElementById('admin-product-id').value = '';
    this.updateImagePreview('');

    // Sugerir SKU automático
    const randomSku = 'TTL-' + Math.floor(100 + Math.random() * 900);
    document.getElementById('form-product-sku').value = randomSku;

    // Abrir modal
    document.getElementById('admin-product-modal-backdrop').classList.add('active');
  }

  openEditProductModal(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;

    this.editingProductId = id;
    document.getElementById('product-modal-title').textContent = `Editar Prenda: ${product.name}`;

    document.getElementById('admin-product-id').value = product.id;
    document.getElementById('form-product-name').value = product.name;
    document.getElementById('form-product-sku').value = product.sku;
    document.getElementById('form-product-category').value = product.category;
    document.getElementById('form-product-subcategory').value = product.subcategory || '';
    document.getElementById('form-product-price').value = product.price;
    document.getElementById('form-product-discount-price').value = product.discountPrice || '';
    document.getElementById('form-product-stock').value = product.stock;
    document.getElementById('admin-product-image-url').value = product.images?.[0] || '';
    document.getElementById('form-product-desc').value = product.description || '';
    document.getElementById('form-product-features').value = (product.features || []).join('\n');
    document.getElementById('form-product-is-sale').checked = Boolean(product.isSale);
    document.getElementById('form-product-is-featured').checked = Boolean(product.isFeatured);

    // Tallas
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

    // Tallas seleccionadas
    const sizes = [];
    ['XS', 'S', 'M', 'L', 'XL', 'XXL'].forEach(s => {
      const chk = document.getElementById(`size-check-${s}`);
      if (chk && chk.checked) sizes.push(s);
    });

    // Colores predeterminados elegantes
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
      images: imageUrl ? [imageUrl] : ['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600'],
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
PEDIDO: ${o.orderNumber}
Fecha: ${new Date(o.createdAt).toLocaleString()}
Cliente: ${o.customerName} (${o.customerPhone})
Email: ${o.customerEmail}
Destino: ${o.district}, ${o.department}
Dirección: ${o.addressLine}
Total: $${o.total.toFixed(2)} USD
Pago: ${o.paymentStatus} (Wompi Auth: ${o.wompiAuthCode || 'N/A'})
Artículos:
${(o.items || []).map(i => ` - ${i.productName} (Talla: ${i.size}, Cant: ${i.quantity}) = $${i.subtotal.toFixed(2)}`).join('\n')}
        `);
      }
    } catch (err) {
      console.error(err);
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
        alert('Configuración de Wompi y Tienda guardada exitosamente.');
      }
    } catch (err) {
      alert('Error guardando configuración');
    }
  }
}

export const adminManager = new AdminManager();
window.adminManager = adminManager;
