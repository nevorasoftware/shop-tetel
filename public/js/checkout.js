import { cartStore } from './cart.js';
import { deliveryService } from './delivery.js';

class CheckoutManager {
  constructor() {
    this.currentStep = 1;
    this.orderData = null;
    this.createdOrder = null;
    this.initListeners();
  }

  initListeners() {
    // Escuchar cambios de Departamento en el Checkout para actualizar Distritos y tarifas
    const deptSelect = document.getElementById('checkout-department');
    const districtSelect = document.getElementById('checkout-district');

    if (deptSelect) {
      deptSelect.addEventListener('change', (e) => {
        const deptName = e.target.value;
        deliveryService.populateDistrictSelect(districtSelect, deptName);
        this.updateCheckoutTotals();
      });
    }

    // Input de Tarjeta - Formateo y detección de marca
    const cardInput = document.getElementById('card-number-input');
    const cardHolderInput = document.getElementById('card-holder-input');
    const cardExpInput = document.getElementById('card-exp-input');
    const cardCvvInput = document.getElementById('card-cvv-input');

    if (cardInput) {
      cardInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 16);
        val = val.replace(/(.{4})/g, '$1 ').trim();
        e.target.value = val;

        const displayEl = document.getElementById('mockup-card-number');
        if (displayEl) {
          displayEl.textContent = val || '•••• •••• •••• ••••';
        }

        // Detectar marca
        const brandBadge = document.getElementById('mockup-card-brand');
        const cleanVal = val.replace(/\s+/g, '');
        if (cleanVal.startsWith('4')) {
          if (brandBadge) brandBadge.textContent = 'VISA';
        } else if (/^5[1-5]/.test(cleanVal) || /^2[2-7]/.test(cleanVal)) {
          if (brandBadge) brandBadge.textContent = 'MASTERCARD';
        } else if (/^3[47]/.test(cleanVal)) {
          if (brandBadge) brandBadge.textContent = 'AMEX';
        } else {
          if (brandBadge) brandBadge.textContent = 'CARD';
        }
      });
    }

    if (cardHolderInput) {
      cardHolderInput.addEventListener('input', (e) => {
        const displayEl = document.getElementById('mockup-card-holder');
        if (displayEl) {
          displayEl.textContent = e.target.value.toUpperCase() || 'NOMBRE TITULAR';
        }
      });
    }

    if (cardExpInput) {
      cardExpInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 2) {
          val = val.substring(0, 2) + '/' + val.substring(2);
        }
        e.target.value = val;
        const displayEl = document.getElementById('mockup-card-expiry');
        if (displayEl) {
          displayEl.textContent = val || 'MM/AA';
        }
      });
    }
  }

  openCheckout() {
    if (cartStore.items.length === 0) {
      alert('Tu carrito está vacío. Agrega prendas para continuar al pago.');
      return;
    }

    cartStore.closeDrawer();
    window.location.hash = '#checkout';
    this.goToStep(1);
    this.renderOrderSummary();

    const deptSelect = document.getElementById('checkout-department');
    const districtSelect = document.getElementById('checkout-district');
    if (deptSelect && deptSelect.children.length <= 1) {
      deliveryService.populateDepartmentSelect(deptSelect, cartStore.selectedDepartment);
      deliveryService.populateDistrictSelect(districtSelect, cartStore.selectedDepartment);
    }
    this.updateCheckoutTotals();
  }

  goToStep(step) {
    this.currentStep = step;
    const step1El = document.getElementById('checkout-step-1-content');
    const step2El = document.getElementById('checkout-step-2-content');
    const step3El = document.getElementById('checkout-step-3-content');

    const badge1 = document.getElementById('step-indicator-1');
    const badge2 = document.getElementById('step-indicator-2');
    const badge3 = document.getElementById('step-indicator-3');

    if (step1El) step1El.style.display = step === 1 ? 'block' : 'none';
    if (step2El) step2El.style.display = step === 2 ? 'block' : 'none';
    if (step3El) step3El.style.display = step === 3 ? 'block' : 'none';

    if (badge1) {
      badge1.className = step === 1 ? 'checkout-step-item active' : (step > 1 ? 'checkout-step-item completed' : 'checkout-step-item');
    }
    if (badge2) {
      badge2.className = step === 2 ? 'checkout-step-item active' : (step > 2 ? 'checkout-step-item completed' : 'checkout-step-item');
    }
    if (badge3) {
      badge3.className = step === 3 ? 'checkout-step-item active' : 'checkout-step-item';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  validateStep1() {
    const name = document.getElementById('checkout-name')?.value.trim();
    const email = document.getElementById('checkout-email')?.value.trim();
    const phone = document.getElementById('checkout-phone')?.value.trim();
    const dept = document.getElementById('checkout-department')?.value;
    const districtSelect = document.getElementById('checkout-district');
    const district = districtSelect?.value;
    const municipality = districtSelect?.options[districtSelect.selectedIndex]?.dataset.municipality || '';
    const address = document.getElementById('checkout-address')?.value.trim();
    const reference = document.getElementById('checkout-reference')?.value.trim();
    const postal = document.getElementById('checkout-postal')?.value.trim() || 'CP 1101';

    if (!name || !email || !phone || !dept || !district || !address) {
      alert('Por favor completa todos los campos requeridos de dirección de entrega en El Salvador.');
      return false;
    }

    if (!email.includes('@') || !email.includes('.')) {
      alert('Ingresa un correo electrónico válido para recibir la confirmación de Wompi.');
      return false;
    }

    this.orderData = {
      customer: { name, email, phone },
      delivery: {
        department: dept,
        municipality,
        district,
        addressLine: address,
        referencePoint: reference,
        postalCode: postal
      },
      notes: document.getElementById('checkout-notes')?.value || ''
    };

    // Renderizar resumen de entrega en Paso 2
    const shippingInfo = deliveryService.calculateShipping(dept, cartStore.getSubtotal());
    const deliveryMethodEl = document.getElementById('step-2-delivery-summary');
    if (deliveryMethodEl) {
      deliveryMethodEl.innerHTML = `
        <div style="background: white; border: 1.5px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>Entrega Standard El Salvador (${dept})</strong>
            <span style="font-weight: 800; color: ${shippingInfo.isFree ? 'var(--color-success)' : 'var(--color-primary)'};">
              ${shippingInfo.isFree ? 'ENVÍO GRATIS' : `$${shippingInfo.cost.toFixed(2)}`}
            </span>
          </div>
          <p style="font-size: 0.85rem; margin: 0; color: var(--color-text-muted);">
            📍 Destino: ${district}, ${dept}. Tiempo estimado: <strong>${shippingInfo.time}</strong>.
          </p>
        </div>
      `;
    }

    this.goToStep(2);
    return true;
  }

  updateCheckoutTotals() {
    const dept = document.getElementById('checkout-department')?.value || cartStore.selectedDepartment;
    const subtotal = cartStore.getSubtotal();
    const shipping = deliveryService.calculateShipping(dept, subtotal);
    const total = subtotal + shipping.cost;

    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const totalEl = document.getElementById('checkout-total');
    const wompiPayBtnText = document.getElementById('wompi-pay-btn-text');

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (shippingEl) {
      shippingEl.textContent = shipping.isFree ? 'GRATIS' : `$${shipping.cost.toFixed(2)}`;
      shippingEl.className = shipping.isFree ? 'text-gold' : '';
    }
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    if (wompiPayBtnText) wompiPayBtnText.textContent = `Pagar $${total.toFixed(2)} con Wompi 3DS`;
  }

  renderOrderSummary() {
    const container = document.getElementById('checkout-items-summary-list');
    if (!container) return;

    container.innerHTML = cartStore.items.map(item => `
      <div style="display: flex; gap: 0.85rem; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--color-border-subtle);">
        <img src="${item.image || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=100'}" alt="${item.name}" style="width: 48px; height: 60px; object-fit: cover; border-radius: 4px;">
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 0.875rem;">${item.name}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">Talla: ${item.size || 'Única'} | Cant: ${item.quantity}</div>
        </div>
        <div style="font-weight: 700; font-size: 0.9rem;">$${(item.price * item.quantity).toFixed(2)}</div>
      </div>
    `).join('');
  }

  async processWompiPayment() {
    const cardNum = document.getElementById('card-number-input')?.value.replace(/\s+/g, '');
    const cardHolder = document.getElementById('card-holder-input')?.value.trim();
    const cardExp = document.getElementById('card-exp-input')?.value.trim();
    const cardCvv = document.getElementById('card-cvv-input')?.value.trim();

    if (!cardNum || cardNum.length < 15) {
      alert('Ingresa un número de tarjeta válido (15 o 16 dígitos).');
      return;
    }
    if (!cardHolder) {
      alert('Ingresa el nombre del titular como aparece en la tarjeta.');
      return;
    }
    if (!cardExp || !cardExp.includes('/') || cardExp.length < 5) {
      alert('Ingresa fecha de vencimiento válida en formato MM/AA.');
      return;
    }
    if (!cardCvv || cardCvv.length < 3) {
      alert('Ingresa el código de seguridad CVV (3 o 4 dígitos).');
      return;
    }

    const [expMonth, expYear] = cardExp.split('/');

    const payBtn = document.getElementById('btn-wompi-pay-action');
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = `
        <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid white; border-top-color:transparent; border-radius:50%; animation: spin 0.8s linear infinite;"></span>
        Conectando con Wompi El Salvador 3DS...
      `;
    }

    try {
      const subtotal = cartStore.getSubtotal();
      const shipping = deliveryService.calculateShipping(this.orderData.delivery.department, subtotal);
      const total = subtotal + shipping.cost;

      // 1. Crear Orden en Base de Datos SQLite
      const orderPayload = {
        ...this.orderData,
        items: cartStore.items,
        subtotal,
        shippingCost: shipping.cost,
        total
      };

      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const orderResult = await orderRes.json();

      if (!orderResult.success) {
        throw new Error(orderResult.error || 'No se pudo registrar la orden en la base de datos');
      }

      this.createdOrder = orderResult.data;

      // 2. Iniciar Transacción 3DS con Wompi
      const wompiRes = await fetch('/api/wompi/initiate-3ds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: this.createdOrder.orderNumber,
          cardData: {
            cardNumber: cardNum,
            cardHolder,
            expMonth,
            expYear,
            cvv: cardCvv
          }
        })
      });

      const wompiData = await wompiRes.json();
      if (!wompiData.success) {
        throw new Error(wompiData.error || 'Error al comunicarse con la pasarela Wompi');
      }

      // 3. Abrir Reto de Autenticación 3D Secure
      this.launch3DSChallenge(wompiData);
    } catch (error) {
      alert(`Error en el proceso de pago: ${error.message}`);
      if (payBtn) {
        payBtn.disabled = false;
        this.updateCheckoutTotals();
      }
    }
  }

  launch3DSChallenge(wompiData) {
    const modalBackdrop = document.getElementById('threed-modal-backdrop');
    if (!modalBackdrop) {
      // Si no hay modal integrado, redirigir a la URL proporcionada por Wompi
      window.location.href = wompiData.urlCompletarPago3Ds;
      return;
    }

    const amountEl = document.getElementById('3ds-amount-val');
    const cardEl = document.getElementById('3ds-card-val');
    const orderEl = document.getElementById('3ds-order-val');

    if (amountEl) amountEl.textContent = `$${wompiData.monto.toFixed(2)}`;
    if (cardEl) {
      const cardNum = document.getElementById('card-number-input')?.value.replace(/\s+/g, '');
      cardEl.textContent = `•••• •••• •••• ${cardNum.slice(-4)}`;
    }
    if (orderEl) orderEl.textContent = this.createdOrder.orderNumber;

    modalBackdrop.classList.add('active');
  }

  async complete3DSVerification(success = true) {
    const modalBackdrop = document.getElementById('threed-modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('active');

    try {
      const authRes = await fetch('/api/wompi/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: this.createdOrder.orderNumber,
          esAprobada: success ? 'true' : 'false',
          codigoAutorizacion: 'AUTH' + Math.floor(100000 + Math.random() * 900000),
          mensaje: success ? 'APROBADO_3DS' : 'TRANSACCION_DENEGADA'
        })
      });

      const result = await authRes.json();
      if (result.success && result.isAprobado) {
        cartStore.clear(); // Vaciar carrito
        this.renderOrderSuccess(result.data);
      } else {
        alert('La transacción fue rechazada por el banco emisor (3D Secure). Por favor intenta con otra tarjeta.');
        this.goToStep(3);
      }
    } catch (err) {
      console.error('Error al confirmar con Wompi:', err);
      alert('Hubo un inconveniente al validar la transacción.');
    }
  }

  renderOrderSuccess(order) {
    window.location.hash = '#order-success';
    const container = document.getElementById('order-success-view');
    if (!container) return;

    container.innerHTML = `
      <div class="order-success-card">
        <div class="success-icon-wrapper">✓</div>
        <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">¡Gracias por tu compra!</h2>
        <p style="font-size: 1.05rem; color: var(--color-text-muted);">
          Tu pago ha sido procesado de forma segura mediante <strong>Wompi El Salvador 3D Secure</strong>.
        </p>

        <div class="receipt-box">
          <div class="receipt-row">
            <span>Número de Pedido:</span>
            <strong>${order.orderNumber}</strong>
          </div>
          <div class="receipt-row">
            <span>Código de Autorización Wompi:</span>
            <span style="font-family: var(--font-mono); color: var(--color-wompi);">${order.wompiAuthCode || 'AUTH883921'}</span>
          </div>
          <div class="receipt-row">
            <span>ID de Transacción Wompi:</span>
            <span style="font-family: var(--font-mono); font-size: 0.75rem;">${order.wompiTransactionId || 'wompi-3ds-simulated'}</span>
          </div>
          <div class="receipt-row">
            <span>Cliente:</span>
            <span>${order.customerName} (${order.customerEmail})</span>
          </div>
          <div class="receipt-row">
            <span>Destino en El Salvador:</span>
            <span>${order.district}, ${order.department}</span>
          </div>
          <div class="receipt-row">
            <span>Dirección:</span>
            <span>${order.addressLine}</span>
          </div>
          <div class="receipt-row">
            <span>Estado de Entrega:</span>
            <span class="badge badge-sale" style="background:#2563eb; color:white;">${order.deliveryStatus || 'Procesando'}</span>
          </div>
          <div class="receipt-row bold">
            <span>Total Pagado:</span>
            <span style="font-size: 1.25rem; color: var(--color-success);">$${order.total.toFixed(2)} USD</span>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="window.location.hash = ''">Seguir Comprando</button>
          <button class="btn btn-outline" onclick="window.print()">🖨️ Imprimir Comprobante</button>
        </div>
      </div>
    `;
  }
}

export const checkoutManager = new CheckoutManager();
window.checkoutManager = checkoutManager;
