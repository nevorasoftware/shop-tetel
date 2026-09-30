import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new DatabaseSync(DB_PATH);

// Habilitar Foreign Keys y modo WAL para mejor concurrencia
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  // 1. Tabla de Productos
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      price REAL NOT NULL,
      discount_price REAL,
      stock INTEGER NOT NULL DEFAULT 0,
      sizes TEXT,
      colors TEXT,
      images TEXT,
      description TEXT,
      features TEXT,
      fabric_care TEXT,
      is_featured INTEGER DEFAULT 0,
      is_sale INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,
      rating REAL DEFAULT 5.0,
      reviews_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 2. Tabla de Pedidos / Órdenes
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      department TEXT NOT NULL,
      municipality TEXT NOT NULL,
      district TEXT NOT NULL,
      address_line TEXT NOT NULL,
      reference_point TEXT,
      postal_code TEXT,
      subtotal REAL NOT NULL,
      shipping_cost REAL NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'wompi_3ds',
      payment_status TEXT DEFAULT 'PENDIENTE',
      wompi_transaction_id TEXT,
      wompi_auth_code TEXT,
      wompi_hash TEXT,
      delivery_status TEXT DEFAULT 'Procesando',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 3. Tabla de Artículos por Pedido
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      product_image TEXT,
      size TEXT,
      color TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // 4. Tabla de Configuración de la Tienda
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Sembrar datos iniciales si no hay productos
  seedInitialData();
}

function seedInitialData() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (countRow.count === 0) {
    console.log('🌱 Inicializando catálogo de prendas en SQLite...');
    const seedPath = path.join(__dirname, 'data', 'seed_products.json');
    if (fs.existsSync(seedPath)) {
      const seedProducts = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      const insert = db.prepare(`
        INSERT INTO products (
          id, name, sku, category, subcategory, price, discount_price, stock,
          sizes, colors, images, description, features, fabric_care,
          is_featured, is_sale, is_new, rating, reviews_count
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `);

      for (const prod of seedProducts) {
        insert.run(
          prod.id,
          prod.name,
          prod.sku,
          prod.category,
          prod.subcategory || '',
          prod.price,
          prod.discountPrice ?? null,
          prod.stock,
          JSON.stringify(prod.sizes || []),
          JSON.stringify(prod.colors || []),
          JSON.stringify(prod.images || []),
          prod.description || '',
          JSON.stringify(prod.features || []),
          JSON.stringify(prod.fabricCare || {}),
          prod.isFeatured ? 1 : 0,
          prod.isSale ? 1 : 0,
          prod.isNew ? 1 : 0,
          prod.rating || 5.0,
          prod.reviewsCount || 0
        );
      }
      console.log(`✅ ${seedProducts.length} prendas registradas exitosamente.`);
    }
  }

  // Valores predeterminados de configuración
  const defaultSettings = [
    { key: 'store_name', value: 'TETEL | Atelier & Moda El Salvador' },
    { key: 'wompi_client_id', value: process.env.WOMPI_CLIENT_ID || 'demo_wompi_app_id' },
    { key: 'wompi_client_secret', value: process.env.WOMPI_CLIENT_SECRET || 'demo_wompi_secret' },
    { key: 'wompi_environment', value: process.env.WOMPI_ENVIRONMENT || 'desarrollo' },
    { key: 'wompi_simulator_mode', value: 'true' }, // Permite probar 3DS de inmediato sin credenciales reales
    { key: 'free_shipping_threshold', value: '60.00' },
    { key: 'currency', value: 'USD' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value);
  }
}

// Helpers para Productos
export function getAllProducts(filters = {}) {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (filters.category && filters.category !== 'Todos') {
    sql += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.isSale) {
    sql += ' AND is_sale = 1';
  }

  if (filters.isFeatured) {
    sql += ' AND is_featured = 1';
  }

  if (filters.search) {
    sql += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters.sort === 'price_asc') {
    sql += ' ORDER BY COALESCE(discount_price, price) ASC';
  } else if (filters.sort === 'price_desc') {
    sql += ' ORDER BY COALESCE(discount_price, price) DESC';
  } else {
    sql += ' ORDER BY created_at DESC';
  }

  const rows = db.prepare(sql).all(...params);
  return rows.map(formatProductFromRow);
}

export function getProductById(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return row ? formatProductFromRow(row) : null;
}

export function getProductBySku(sku) {
  const row = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku);
  return row ? formatProductFromRow(row) : null;
}

export function createProduct(prod) {
  const id = prod.id || `prod-${Date.now()}`;
  const insert = db.prepare(`
    INSERT INTO products (
      id, name, sku, category, subcategory, price, discount_price, stock,
      sizes, colors, images, description, features, fabric_care,
      is_featured, is_sale, is_new, rating, reviews_count
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  insert.run(
    id,
    prod.name,
    prod.sku.toUpperCase(),
    prod.category,
    prod.subcategory || '',
    parseFloat(prod.price) || 0,
    prod.discountPrice ? parseFloat(prod.discountPrice) : null,
    parseInt(prod.stock, 10) || 0,
    JSON.stringify(prod.sizes || []),
    JSON.stringify(prod.colors || []),
    JSON.stringify(prod.images || []),
    prod.description || '',
    JSON.stringify(prod.features || []),
    JSON.stringify(prod.fabricCare || {}),
    prod.isFeatured ? 1 : 0,
    prod.isSale ? 1 : 0,
    prod.isNew ? 1 : 0,
    prod.rating || 5.0,
    prod.reviewsCount || 0
  );

  return getProductById(id);
}

export function updateProduct(id, prod) {
  const current = getProductById(id);
  if (!current) return null;

  const update = db.prepare(`
    UPDATE products SET
      name = ?,
      sku = ?,
      category = ?,
      subcategory = ?,
      price = ?,
      discount_price = ?,
      stock = ?,
      sizes = ?,
      colors = ?,
      images = ?,
      description = ?,
      features = ?,
      fabric_care = ?,
      is_featured = ?,
      is_sale = ?,
      is_new = ?
    WHERE id = ?
  `);

  update.run(
    prod.name ?? current.name,
    (prod.sku ?? current.sku).toUpperCase(),
    prod.category ?? current.category,
    prod.subcategory ?? current.subcategory,
    prod.price !== undefined ? parseFloat(prod.price) : current.price,
    prod.discountPrice !== undefined && prod.discountPrice !== '' ? parseFloat(prod.discountPrice) : null,
    prod.stock !== undefined ? parseInt(prod.stock, 10) : current.stock,
    JSON.stringify(prod.sizes ?? current.sizes),
    JSON.stringify(prod.colors ?? current.colors),
    JSON.stringify(prod.images ?? current.images),
    prod.description ?? current.description,
    JSON.stringify(prod.features ?? current.features),
    JSON.stringify(prod.fabricCare ?? current.fabricCare),
    prod.isFeatured !== undefined ? (prod.isFeatured ? 1 : 0) : (current.isFeatured ? 1 : 0),
    prod.isSale !== undefined ? (prod.isSale ? 1 : 0) : (current.isSale ? 1 : 0),
    prod.isNew !== undefined ? (prod.isNew ? 1 : 0) : (current.isNew ? 1 : 0),
    id
  );

  return getProductById(id);
}

export function deleteProduct(id) {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  return result.changes > 0;
}

// Helpers para Pedidos
export function createOrder(orderData, items = []) {
  const id = orderData.id || `ord-${Date.now()}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = orderData.orderNumber || `TTL-SV-${Date.now().toString().slice(-4)}${randomSuffix}`;

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, order_number, customer_name, customer_email, customer_phone,
      department, municipality, district, address_line, reference_point, postal_code,
      subtotal, shipping_cost, total, payment_method, payment_status,
      wompi_transaction_id, wompi_auth_code, wompi_hash, delivery_status, notes
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  insertOrder.run(
    id,
    orderNumber,
    orderData.customerName,
    orderData.customerEmail,
    orderData.customerPhone,
    orderData.department,
    orderData.municipality,
    orderData.district,
    orderData.addressLine,
    orderData.referencePoint || '',
    orderData.postalCode || 'CP 1101',
    parseFloat(orderData.subtotal) || 0,
    parseFloat(orderData.shippingCost) || 0,
    parseFloat(orderData.total) || 0,
    orderData.paymentMethod || 'wompi_3ds',
    orderData.paymentStatus || 'PENDIENTE',
    orderData.wompiTransactionId || '',
    orderData.wompiAuthCode || '',
    orderData.wompiHash || '',
    orderData.deliveryStatus || 'Procesando',
    orderData.notes || ''
  );

  const insertItem = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, product_name, product_sku, product_image,
      size, color, price, quantity, subtotal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Descontar inventario y guardar items
  const updateStock = db.prepare(`
    UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?
  `);

  for (const item of items) {
    insertItem.run(
      id,
      item.productId || item.id,
      item.name,
      item.sku || '',
      item.image || '',
      item.size || '',
      item.color || '',
      parseFloat(item.price) || 0,
      parseInt(item.quantity, 10) || 1,
      parseFloat(item.subtotal || item.price * item.quantity) || 0
    );

    if (item.productId || item.id) {
      updateStock.run(parseInt(item.quantity, 10) || 1, item.productId || item.id);
    }
  }

  return getOrderById(id);
}

export function getAllOrders() {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  return rows.map(formatOrderFromRow);
}

export function getOrderById(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id);
  if (!row) return null;

  const order = formatOrderFromRow(row);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  order.items = items;
  return order;
}

export function updateOrderPayment(id, { paymentStatus, wompiTransactionId, wompiAuthCode, wompiHash }) {
  const update = db.prepare(`
    UPDATE orders SET
      payment_status = ?,
      wompi_transaction_id = COALESCE(?, wompi_transaction_id),
      wompi_auth_code = COALESCE(?, wompi_auth_code),
      wompi_hash = COALESCE(?, wompi_hash)
    WHERE id = ? OR order_number = ?
  `);
  update.run(
    paymentStatus ?? null,
    wompiTransactionId ?? null,
    wompiAuthCode ?? null,
    wompiHash ?? null,
    id,
    id
  );
  return getOrderById(id);
}

export function updateOrderDeliveryStatus(id, deliveryStatus) {
  db.prepare('UPDATE orders SET delivery_status = ? WHERE id = ? OR order_number = ?').run(deliveryStatus, id, id);
  return getOrderById(id);
}

// Métricas de ventas para el Administrador
export function getAdminMetrics() {
  const totalSales = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = 'APROBADO'").get().total;
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
  const paidOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'APROBADO'").get().count;
  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  const lowStockProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 5').get().count;
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all().map(formatOrderFromRow);

  return {
    totalSales,
    totalOrders,
    paidOrders,
    totalProducts,
    lowStockProducts,
    recentOrders
  };
}

// Configuración
export function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) {
    obj[r.key] = r.value;
  }
  return obj;
}

export function updateSettings(settingsObj) {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  for (const [key, value] of Object.entries(settingsObj)) {
    upsert.run(key, String(value));
  }
  return getAllSettings();
}

function formatProductFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    subcategory: row.subcategory,
    price: row.price,
    discountPrice: row.discount_price,
    stock: row.stock,
    sizes: row.sizes ? JSON.parse(row.sizes) : [],
    colors: row.colors ? JSON.parse(row.colors) : [],
    images: row.images ? JSON.parse(row.images) : [],
    description: row.description,
    features: row.features ? JSON.parse(row.features) : [],
    fabricCare: row.fabric_care ? JSON.parse(row.fabric_care) : {},
    isFeatured: Boolean(row.is_featured),
    isSale: Boolean(row.is_sale),
    isNew: Boolean(row.is_new),
    rating: row.rating,
    reviewsCount: row.reviews_count,
    createdAt: row.created_at
  };
}

function formatOrderFromRow(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    department: row.department,
    municipality: row.municipality,
    district: row.district,
    addressLine: row.address_line,
    referencePoint: row.reference_point,
    postalCode: row.postal_code,
    subtotal: row.subtotal,
    shippingCost: row.shipping_cost,
    total: row.total,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    wompiTransactionId: row.wompi_transaction_id,
    wompiAuthCode: row.wompi_auth_code,
    wompiHash: row.wompi_hash,
    deliveryStatus: row.delivery_status,
    notes: row.notes,
    createdAt: row.created_at
  };
}
