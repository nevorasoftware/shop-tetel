import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  getAllProducts,
  getProductById,
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderPayment,
  updateOrderDeliveryStatus,
  getAdminMetrics,
  getAllSettings,
  updateSettings
} from '../db.js';

import {
  createWompiTransaction3DS,
  getWompiTransaction
} from '../wompi.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de multer para carga de imágenes de productos
const uploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `prenda_${Date.now()}_${Math.round(Math.random() * 1e4)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Cache / Lectura de datos geográficos de El Salvador
let departmentsData = null;
function getDepartmentsSV() {
  if (!departmentsData) {
    const filePath = path.join(__dirname, '..', 'data', 'departments_sv.json');
    departmentsData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return departmentsData;
}

// -------------------------------------------------------------
// PRODUCTOS
// -------------------------------------------------------------

// Listado de productos con filtros
router.get('/products', (req, res) => {
  try {
    const { category, isSale, isFeatured, search, sort } = req.query;
    const products = getAllProducts({
      category,
      isSale: isSale === 'true',
      isFeatured: isFeatured === 'true',
      search,
      sort
    });
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Detalle de un producto
router.get('/products/:id', (req, res) => {
  try {
    const product = getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Crear nuevo producto (Admin)
router.post('/products', (req, res) => {
  try {
    const { name, sku, price } = req.body;
    if (!name || !sku || price === undefined) {
      return res.status(400).json({ success: false, error: 'Nombre, SKU y Precio son campos obligatorios.' });
    }

    const existing = getProductBySku(sku);
    if (existing) {
      return res.status(400).json({ success: false, error: `Ya existe una prenda con el código SKU ${sku}.` });
    }

    const newProduct = createProduct(req.body);
    res.status(201).json({ success: true, message: 'Prenda creada con éxito', data: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar producto (Admin)
router.put('/products/:id', (req, res) => {
  try {
    const updated = updateProduct(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado para actualizar' });
    }
    res.json({ success: true, message: 'Prenda actualizada con éxito', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Eliminar producto (Admin)
router.delete('/products/:id', (req, res) => {
  try {
    const ok = deleteProduct(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.json({ success: true, message: 'Prenda eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Subida de imágenes para prendas
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se subió ninguna imagen' });
    }
    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: publicUrl, filename: req.file.filename });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// GEOGRAFÍA DE EL SALVADOR Y ENVÍOS
// -------------------------------------------------------------

router.get('/departments', (req, res) => {
  try {
    const departments = getDepartmentsSV();
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Consultar tarifa y tiempo estimado para un departamento específico
router.get('/delivery-rates/:departmentId', (req, res) => {
  try {
    const departments = getDepartmentsSV();
    const dept = departments.find(d => d.id === req.params.departmentId || d.name.toLowerCase() === req.params.departmentId.toLowerCase());
    if (!dept) {
      return res.status(404).json({ success: false, error: 'Departamento no encontrado' });
    }
    res.json({ success: true, data: dept });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// PEDIDOS / CHECKOUT
// -------------------------------------------------------------

// Crear pedido inicial
router.post('/orders', (req, res) => {
  try {
    const { customer, delivery, items, subtotal, shippingCost, total, notes } = req.body;
    if (!customer || !delivery || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Faltan datos requeridos del pedido o el carrito está vacío.' });
    }

    const orderData = {
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      department: delivery.department,
      municipality: delivery.municipality || '',
      district: delivery.district || '',
      addressLine: delivery.addressLine,
      referencePoint: delivery.referencePoint || '',
      postalCode: delivery.postalCode || 'CP 1101',
      subtotal,
      shippingCost,
      total,
      paymentMethod: 'wompi_3ds',
      paymentStatus: 'PENDIENTE',
      notes: notes || ''
    };

    const newOrder = createOrder(orderData, items);
    res.status(201).json({ success: true, data: newOrder });
  } catch (error) {
    console.error('Error al registrar orden:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar todos los pedidos (Admin)
router.get('/orders', (req, res) => {
  try {
    const orders = getAllOrders();
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener un pedido específico
router.get('/orders/:id', (req, res) => {
  try {
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar estado de entrega (Admin)
router.patch('/orders/:id/delivery-status', (req, res) => {
  try {
    const { deliveryStatus } = req.body;
    if (!deliveryStatus) {
      return res.status(400).json({ success: false, error: 'Se requiere deliveryStatus' });
    }
    const updated = updateOrderDeliveryStatus(req.params.id, deliveryStatus);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// INTEGRACIÓN DE PAGOS CON WOMPI EL SALVADOR 3DS
// -------------------------------------------------------------

/**
 * Iniciar Transacción de Compra con 3DS
 * Según documentación oficial https://docs.wompi.sv/metodos-api/crear-transaccion-compra-3ds
 */
router.post('/wompi/initiate-3ds', async (req, res) => {
  try {
    const { orderNumber, cardData } = req.body;

    if (!orderNumber || !cardData) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros obligatorios de compra' });
    }

    const order = getOrderById(orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, error: `Pedido ${orderNumber} no encontrado` });
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const redirectUrlBase = `${protocol}://${host}`;

    const wompiResult = await createWompiTransaction3DS({
      cardData,
      amount: order.total,
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone
      },
      delivery: {
        department: order.department,
        municipality: order.municipality,
        district: order.district,
        addressLine: order.addressLine,
        postalCode: order.postalCode
      },
      orderNumber: order.orderNumber,
      redirectUrlBase
    });

    if (!wompiResult.success) {
      return res.status(400).json({ success: false, error: wompiResult.error || 'Error al iniciar 3DS en Wompi' });
    }

    // Actualizar pedido con el idTransaccion retornado por Wompi
    updateOrderPayment(order.id, {
      paymentStatus: 'EN_PROCESO_3DS',
      wompiTransactionId: wompiResult.idTransaccion
    });

    res.json({
      success: true,
      idTransaccion: wompiResult.idTransaccion,
      esReal: wompiResult.esReal,
      urlCompletarPago3Ds: wompiResult.urlCompletarPago3Ds,
      monto: wompiResult.monto,
      isSimulated: wompiResult.isSimulated || false
    });
  } catch (error) {
    console.error('Error en /wompi/initiate-3ds:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Confirmación de pago luego de completar el flujo 3DS (Redirect URL o retorno)
 */
router.post('/wompi/confirm-payment', (req, res) => {
  try {
    const { orderNumber, idTransaccion, esAprobada, codigoAutorizacion, mensaje, hash } = req.body;

    const order = getOrderById(orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
    }

    const isSuccess = String(esAprobada).toLowerCase() === 'true';
    const newStatus = isSuccess ? 'APROBADO' : 'FALLIDO';

    const updated = updateOrderPayment(order.id, {
      paymentStatus: newStatus,
      wompiTransactionId: idTransaccion || order.wompiTransactionId,
      wompiAuthCode: codigoAutorizacion || (isSuccess ? 'AUTH' + Date.now().toString().slice(-6) : null),
      wompiHash: hash || null
    });

    res.json({
      success: true,
      isAprobado: isSuccess,
      message: isSuccess ? 'Pago aprobado exitosamente mediante Wompi 3D Secure' : (mensaje || 'Pago denegado'),
      data: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Endpoint de Webhook de Wompi El Salvador
 * Recibe eventos de servidor a servidor cuando una transacción concluye
 */
router.post('/wompi/webhook', (req, res) => {
  try {
    console.log('🔔 Webhook recibido de Wompi:', req.body);
    const { idTransaccion, esProductiva, resultadoTransaccion, datosAdicionales } = req.body;

    if (datosAdicionales && datosAdicionales.orderNumber) {
      const isApproved = resultadoTransaccion === 'TransaccionExitosa' || resultadoTransaccion === 'Aprobada';
      updateOrderPayment(datosAdicionales.orderNumber, {
        paymentStatus: isApproved ? 'APROBADO' : 'FALLIDO',
        wompiTransactionId: idTransaccion
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando Webhook Wompi:', error);
    res.status(500).send('ERROR');
  }
});

// -------------------------------------------------------------
// PANEL DE ADMINISTRACIÓN (MÉTRICAS Y CONFIGURACIÓN)
// -------------------------------------------------------------

router.get('/admin/metrics', (req, res) => {
  try {
    const metrics = getAdminMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/settings', (req, res) => {
  try {
    const settings = getAllSettings();
    // Enmascarar la llave secreta para seguridad en la respuesta
    const safeSettings = { ...settings };
    if (safeSettings.wompi_client_secret && safeSettings.wompi_client_secret.length > 8) {
      safeSettings.wompi_client_secret_masked = '••••••••' + safeSettings.wompi_client_secret.slice(-4);
    }
    res.json({ success: true, data: safeSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body);
    res.json({ success: true, message: 'Configuración guardada exitosamente', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
