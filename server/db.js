import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detectar si estamos conectados a PostgreSQL (ej. Railway) o SQLite local
const isPostgres = Boolean(process.env.DATABASE_URL);

let pool = null;
let sqliteDb = null;

if (isPostgres) {
  const connectionString = process.env.DATABASE_URL;
  const isInternal = connectionString.includes('.railway.internal');

  console.log(`🐘 Conectando a Base de Datos PostgreSQL en Railway (${isInternal ? 'Red Privada' : 'Proxy'})...`);
  pool = new Pool({
    connectionString,
    ssl: isInternal ? false : { rejectUnauthorized: false }
  });
} else {
  const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  sqliteDb = new DatabaseSync(DB_PATH);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  console.log(`📁 Usando motor de base de datos SQLite local: ${DB_PATH}`);
}

/**
 * Convierte consultas SQL universales con '?' a formato PostgreSQL ($1, $2, ...)
 */
function toPgQuery(sql, params = []) {
  let index = 1;
  const text = sql.replace(/\?/g, () => `$${index++}`);
  return { text, values: params };
}

// ==============================================================================
// INICIALIZACIÓN DE TABLAS Y DATOS SEMILLA
// ==============================================================================
export async function initDatabase() {
  if (isPostgres) {
    try {
      // 1. Tabla de Productos
      await pool.query(`
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Tabla de Pedidos / Órdenes
      await pool.query(`
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Tabla de Artículos por Pedido
      await pool.query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          product_sku TEXT NOT NULL,
          product_image TEXT,
          size TEXT,
          color TEXT,
          price REAL NOT NULL,
          quantity INTEGER NOT NULL,
          subtotal REAL NOT NULL
        );
      `);

      // 4. Tabla de Configuración de la Tienda
      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      // 5. Tabla de Categorías y Subcategorías
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('✅ Esquema PostgreSQL inicializado con éxito.');
      await seedPostgresData();
    } catch (err) {
      console.error('❌ Error al inicializar PostgreSQL:', err);
      throw err;
    }
  } else {
    // Inicialización SQLite
    sqliteDb.exec(`
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

    sqliteDb.exec(`
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

    sqliteDb.exec(`
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

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    seedSqliteData();
  }
}

async function seedPostgresData() {
  const res = await pool.query('SELECT COUNT(*) as count FROM products');
  if (parseInt(res.rows[0].count, 10) === 0) {
    console.log('🌱 Sembrando catálogo inicial en PostgreSQL...');
    const seedPath = path.join(__dirname, 'data', 'seed_products.json');
    if (fs.existsSync(seedPath)) {
      const seedProducts = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      for (const prod of seedProducts) {
        await pool.query(
          `INSERT INTO products (
            id, name, sku, category, subcategory, price, discount_price, stock,
            sizes, colors, images, description, features, fabric_care,
            is_featured, is_sale, is_new, rating, reviews_count
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19
          )`,
          [
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
          ]
        );
      }
      console.log(`✅ ${seedProducts.length} prendas registradas en PostgreSQL.`);
    }
  }

  const defaultSettings = [
    { key: 'store_name', value: 'TETEL | Hecho con Cultura El Salvador' },
    { key: 'admin_email', value: 'admin@tetel.com' },
    { key: 'admin_password', value: 'tetel@$2026' },
    { key: 'wompi_client_id', value: process.env.WOMPI_CLIENT_ID || 'demo_wompi_app_id' },
    { key: 'wompi_client_secret', value: process.env.WOMPI_CLIENT_SECRET || 'demo_wompi_secret' },
    { key: 'wompi_environment', value: process.env.WOMPI_ENVIRONMENT || 'desarrollo' },
    { key: 'wompi_simulator_mode', value: 'true' },
    { key: 'free_shipping_threshold', value: '60.00' },
    { key: 'currency', value: 'USD' }
  ];

  for (const s of defaultSettings) {
    if (s.key === 'admin_email' || s.key === 'admin_password') {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [s.key, s.value]
      );
    } else {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [s.key, s.value]
      );
    }
  }

  // Sembrar categorías iniciales en PostgreSQL si está vacío
  const catCountRes = await pool.query('SELECT COUNT(*) as count FROM categories');
  if (parseInt(catCountRes.rows[0].count, 10) === 0) {
    console.log('🌱 Sembrando categorías iniciales en PostgreSQL...');
    const parentMap = {};
    for (const c of INITIAL_CATEGORIES) {
      const res = await pool.query(
        `INSERT INTO categories (name, slug, parent_id, description) VALUES ($1, $2, NULL, $3) RETURNING id`,
        [c.name, c.slug, c.desc || '']
      );
      parentMap[c.slug] = res.rows[0].id;
    }

    for (const sub of INITIAL_SUBCATEGORIES) {
      const parentId = parentMap[sub.parentSlug];
      if (parentId) {
        await pool.query(
          `INSERT INTO categories (name, slug, parent_id, description) VALUES ($1, $2, $3, $4)`,
          [sub.name, sub.slug, parentId, '']
        );
      }
    }
  }

  // Sincronizar secuencia de IDs de categorías para PostgreSQL
  try {
    await pool.query("SELECT setval('categories_id_seq', COALESCE((SELECT MAX(id) FROM categories), 1))");
  } catch (seqErr) {
    // Si la secuencia no existe o ya está al día, ignorar
  }
}

const INITIAL_CATEGORIES = [
  { name: 'Chaquetas & Outerwear', slug: 'chaquetas-outerwear', desc: 'Prendas de abrigo urbano, eco-cuero y estampados paisley' },
  { name: 'Camisas & Tops', slug: 'camisas-tops', desc: 'Camisas resort de autor, playeras oversize y tops de corte moderno' },
  { name: 'Pantalones & Bottoms', slug: 'pantalones-bottoms', desc: 'Joggers paisley de corte relajado, cargo pants y denim de autor' },
  { name: 'Calzado', slug: 'calzado', desc: 'Sneakers urbanos y calzado streetwear' },
  { name: 'Accesorios', slug: 'accesorios', desc: 'Bandanas de seda salvadoreñas, tote bags y accesorios' }
];

const INITIAL_SUBCATEGORIES = [
  { name: 'Eco-cuero & Bandana', slug: 'eco-cuero-bandana', parentSlug: 'chaquetas-outerwear' },
  { name: 'Bomber Jackets', slug: 'bomber-jackets', parentSlug: 'chaquetas-outerwear' },
  { name: 'Chalecos Streetwear', slug: 'chalecos-streetwear', parentSlug: 'chaquetas-outerwear' },
  { name: 'Camisas Resort', slug: 'camisas-resort', parentSlug: 'camisas-tops' },
  { name: 'Boxy Tees Oversize', slug: 'boxy-tees-oversize', parentSlug: 'camisas-tops' },
  { name: 'Hoodies Gráficos', slug: 'hoodies-graficos', parentSlug: 'camisas-tops' },
  { name: 'Joggers Paisley', slug: 'joggers-paisley', parentSlug: 'pantalones-bottoms' },
  { name: 'Cargo Pants Urbanos', slug: 'cargo-pants-urbanos', parentSlug: 'pantalones-bottoms' },
  { name: 'Denim Streetwear', slug: 'denim-streetwear', parentSlug: 'pantalones-bottoms' },
  { name: 'Sneakers Urbanos', slug: 'sneakers-urbanos', parentSlug: 'calzado' },
  { name: 'Bandanas de Seda', slug: 'bandanas-seda', parentSlug: 'accesorios' },
  { name: 'Tote Bags', slug: 'tote-bags', parentSlug: 'accesorios' }
];

function seedSqliteData() {
  const countRow = sqliteDb.prepare('SELECT COUNT(*) as count FROM products').get();
  if (countRow.count === 0) {
    console.log('🌱 Sembrando catálogo inicial en SQLite...');
    const seedPath = path.join(__dirname, 'data', 'seed_products.json');
    if (fs.existsSync(seedPath)) {
      const seedProducts = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      const insert = sqliteDb.prepare(`
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
      console.log(`✅ ${seedProducts.length} prendas registradas en SQLite.`);
    }
  }

  const defaultSettings = [
    { key: 'store_name', value: 'TETEL | Hecho con Cultura El Salvador' },
    { key: 'admin_email', value: 'admin@tetel.com' },
    { key: 'admin_password', value: 'tetel@$2026' },
    { key: 'wompi_client_id', value: process.env.WOMPI_CLIENT_ID || 'demo_wompi_app_id' },
    { key: 'wompi_client_secret', value: process.env.WOMPI_CLIENT_SECRET || 'demo_wompi_secret' },
    { key: 'wompi_environment', value: process.env.WOMPI_ENVIRONMENT || 'desarrollo' },
    { key: 'wompi_simulator_mode', value: 'true' },
    { key: 'free_shipping_threshold', value: '60.00' },
    { key: 'currency', value: 'USD' }
  ];

  const insertSetting = sqliteDb.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value);
  }

  // Sembrar categorías iniciales en SQLite si está vacío
  const catCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (catCount.count === 0) {
    console.log('🌱 Sembrando categorías iniciales en SQLite...');
    const insertCat = sqliteDb.prepare('INSERT INTO categories (name, slug, parent_id, description) VALUES (?, ?, ?, ?)');
    const parentMap = {};
    for (const c of INITIAL_CATEGORIES) {
      const info = insertCat.run(c.name, c.slug, null, c.desc || '');
      parentMap[c.slug] = Number(info.lastInsertRowid);
    }
    for (const sub of INITIAL_SUBCATEGORIES) {
      const parentId = parentMap[sub.parentSlug];
      if (parentId) {
        insertCat.run(sub.name, sub.slug, parentId, '');
      }
    }
  }
}

// ==============================================================================
// PRODUCTOS
// ==============================================================================
export async function getAllProducts(filters = {}) {
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
    sql += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(sku) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))';
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

  if (isPostgres) {
    const q = toPgQuery(sql, params);
    const res = await pool.query(q.text, q.values);
    return res.rows.map(formatProductFromRow);
  } else {
    const rows = sqliteDb.prepare(sql).all(...params);
    return rows.map(formatProductFromRow);
  }
}

export async function getProductById(id) {
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return res.rows[0] ? formatProductFromRow(res.rows[0]) : null;
  } else {
    const row = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return row ? formatProductFromRow(row) : null;
  }
}

export async function getProductBySku(sku) {
  const cleanSku = (sku || '').trim().toUpperCase();
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM products WHERE UPPER(sku) = $1', [cleanSku]);
    return res.rows[0] ? formatProductFromRow(res.rows[0]) : null;
  } else {
    const row = sqliteDb.prepare('SELECT * FROM products WHERE UPPER(sku) = ?').get(cleanSku);
    return row ? formatProductFromRow(row) : null;
  }
}

export async function createProduct(prod) {
  const id = prod.id || `prod-${Date.now()}`;
  const sku = prod.sku.toUpperCase();

  const values = [
    id,
    prod.name,
    sku,
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
  ];

  if (isPostgres) {
    await pool.query(
      `INSERT INTO products (
        id, name, sku, category, subcategory, price, discount_price, stock,
        sizes, colors, images, description, features, fabric_care,
        is_featured, is_sale, is_new, rating, reviews_count
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19
      )`,
      values
    );
  } else {
    sqliteDb.prepare(`
      INSERT INTO products (
        id, name, sku, category, subcategory, price, discount_price, stock,
        sizes, colors, images, description, features, fabric_care,
        is_featured, is_sale, is_new, rating, reviews_count
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(...values);
  }

  return getProductById(id);
}

export async function updateProduct(id, prod) {
  const current = await getProductById(id);
  if (!current) return null;

  const values = [
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
  ];

  if (isPostgres) {
    await pool.query(
      `UPDATE products SET
        name = $1, sku = $2, category = $3, subcategory = $4,
        price = $5, discount_price = $6, stock = $7,
        sizes = $8, colors = $9, images = $10,
        description = $11, features = $12, fabric_care = $13,
        is_featured = $14, is_sale = $15, is_new = $16
      WHERE id = $17`,
      values
    );
  } else {
    sqliteDb.prepare(`
      UPDATE products SET
        name = ?, sku = ?, category = ?, subcategory = ?,
        price = ?, discount_price = ?, stock = ?,
        sizes = ?, colors = ?, images = ?,
        description = ?, features = ?, fabric_care = ?,
        is_featured = ?, is_sale = ?, is_new = ?
      WHERE id = ?
    `).run(...values);
  }

  return getProductById(id);
}

export async function deleteProduct(id) {
  if (isPostgres) {
    const res = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return res.rowCount > 0;
  } else {
    const result = sqliteDb.prepare('DELETE FROM products WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

// ==============================================================================
// PEDIDOS
// ==============================================================================
export async function createOrder(orderData, items = []) {
  const id = orderData.id || `ord-${Date.now()}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = orderData.orderNumber || `TTL-SV-${Date.now().toString().slice(-4)}${randomSuffix}`;

  const orderValues = [
    id,
    orderNumber,
    orderData.customerName,
    orderData.customerEmail,
    orderData.customerPhone,
    orderData.department,
    orderData.municipality || '',
    orderData.district || '',
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
  ];

  if (isPostgres) {
    await pool.query(
      `INSERT INTO orders (
        id, order_number, customer_name, customer_email, customer_phone,
        department, municipality, district, address_line, reference_point, postal_code,
        subtotal, shipping_cost, total, payment_method, payment_status,
        wompi_transaction_id, wompi_auth_code, wompi_hash, delivery_status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )`,
      orderValues
    );

    for (const item of items) {
      const qty = parseInt(item.quantity, 10) || 1;
      const pid = item.productId || item.id;

      await pool.query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_sku, product_image,
          size, color, price, quantity, subtotal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          pid,
          item.name,
          item.sku || '',
          item.image || '',
          item.size || '',
          item.color || '',
          parseFloat(item.price) || 0,
          qty,
          parseFloat(item.subtotal || item.price * qty) || 0
        ]
      );

      if (pid) {
        await pool.query(
          `UPDATE products SET stock = CASE WHEN stock >= $1 THEN stock - $1 ELSE 0 END WHERE id = $2`,
          [qty, pid]
        );
      }
    }
  } else {
    sqliteDb.prepare(`
      INSERT INTO orders (
        id, order_number, customer_name, customer_email, customer_phone,
        department, municipality, district, address_line, reference_point, postal_code,
        subtotal, shipping_cost, total, payment_method, payment_status,
        wompi_transaction_id, wompi_auth_code, wompi_hash, delivery_status, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(...orderValues);

    const insertItem = sqliteDb.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, product_sku, product_image,
        size, color, price, quantity, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = sqliteDb.prepare(`
      UPDATE products SET stock = CASE WHEN stock >= ? THEN stock - ? ELSE 0 END WHERE id = ?
    `);

    for (const item of items) {
      const qty = parseInt(item.quantity, 10) || 1;
      const pid = item.productId || item.id;

      insertItem.run(
        id,
        pid,
        item.name,
        item.sku || '',
        item.image || '',
        item.size || '',
        item.color || '',
        parseFloat(item.price) || 0,
        qty,
        parseFloat(item.subtotal || item.price * qty) || 0
      );

      if (pid) {
        updateStock.run(qty, qty, pid);
      }
    }
  }

  return getOrderById(id);
}

export async function getAllOrders() {
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    return res.rows.map(formatOrderFromRow);
  } else {
    const rows = sqliteDb.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    return rows.map(formatOrderFromRow);
  }
}

export async function getOrderById(id) {
  if (isPostgres) {
    const res = await pool.query('SELECT * FROM orders WHERE id = $1 OR order_number = $1', [id]);
    if (!res.rows[0]) return null;
    const order = formatOrderFromRow(res.rows[0]);
    const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    order.items = itemsRes.rows;
    return order;
  } else {
    const row = sqliteDb.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(id, id);
    if (!row) return null;
    const order = formatOrderFromRow(row);
    const items = sqliteDb.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    order.items = items;
    return order;
  }
}

export async function updateOrderPayment(id, { paymentStatus, wompiTransactionId, wompiAuthCode, wompiHash }) {
  if (isPostgres) {
    await pool.query(
      `UPDATE orders SET
        payment_status = COALESCE($1, payment_status),
        wompi_transaction_id = COALESCE($2, wompi_transaction_id),
        wompi_auth_code = COALESCE($3, wompi_auth_code),
        wompi_hash = COALESCE($4, wompi_hash)
      WHERE id = $5 OR order_number = $5`,
      [paymentStatus ?? null, wompiTransactionId ?? null, wompiAuthCode ?? null, wompiHash ?? null, id]
    );
  } else {
    sqliteDb.prepare(`
      UPDATE orders SET
        payment_status = COALESCE(?, payment_status),
        wompi_transaction_id = COALESCE(?, wompi_transaction_id),
        wompi_auth_code = COALESCE(?, wompi_auth_code),
        wompi_hash = COALESCE(?, wompi_hash)
      WHERE id = ? OR order_number = ?
    `).run(
      paymentStatus ?? null,
      wompiTransactionId ?? null,
      wompiAuthCode ?? null,
      wompiHash ?? null,
      id,
      id
    );
  }
  return getOrderById(id);
}

export async function updateOrderDeliveryStatus(id, deliveryStatus) {
  if (isPostgres) {
    await pool.query('UPDATE orders SET delivery_status = $1 WHERE id = $2 OR order_number = $2', [deliveryStatus, id]);
  } else {
    sqliteDb.prepare('UPDATE orders SET delivery_status = ? WHERE id = ? OR order_number = ?').run(deliveryStatus, id, id);
  }
  return getOrderById(id);
}

// ==============================================================================
// MÉTRICAS Y AJUSTES
// ==============================================================================
export async function getAdminMetrics() {
  if (isPostgres) {
    const totalSalesRes = await pool.query("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = 'APROBADO'");
    const totalOrdersRes = await pool.query('SELECT COUNT(*) as count FROM orders');
    const paidOrdersRes = await pool.query("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'APROBADO'");
    const totalProductsRes = await pool.query('SELECT COUNT(*) as count FROM products');
    const lowStockRes = await pool.query('SELECT COUNT(*) as count FROM products WHERE stock <= 5');
    const recentOrdersRes = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');

    return {
      totalSales: parseFloat(totalSalesRes.rows[0].total) || 0,
      totalOrders: parseInt(totalOrdersRes.rows[0].count, 10) || 0,
      paidOrders: parseInt(paidOrdersRes.rows[0].count, 10) || 0,
      totalProducts: parseInt(totalProductsRes.rows[0].count, 10) || 0,
      lowStockProducts: parseInt(lowStockRes.rows[0].count, 10) || 0,
      recentOrders: recentOrdersRes.rows.map(formatOrderFromRow)
    };
  } else {
    const totalSales = sqliteDb.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = 'APROBADO'").get().total;
    const totalOrders = sqliteDb.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const paidOrders = sqliteDb.prepare("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'APROBADO'").get().count;
    const totalProducts = sqliteDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const lowStockProducts = sqliteDb.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 5').get().count;
    const recentOrders = sqliteDb.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all().map(formatOrderFromRow);

    return {
      totalSales: parseFloat(totalSales) || 0,
      totalOrders,
      paidOrders,
      totalProducts,
      lowStockProducts,
      recentOrders
    };
  }
}

export async function getSetting(key, defaultValue = null) {
  if (isPostgres) {
    const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return res.rows[0] ? res.rows[0].value : defaultValue;
  } else {
    const row = sqliteDb.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  }
}

export async function getAllSettings() {
  if (isPostgres) {
    const res = await pool.query('SELECT key, value FROM settings');
    const obj = {};
    for (const r of res.rows) {
      obj[r.key] = r.value;
    }
    return obj;
  } else {
    const rows = sqliteDb.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    for (const r of rows) {
      obj[r.key] = r.value;
    }
    return obj;
  }
}

export async function updateSettings(settingsObj) {
  if (isPostgres) {
    for (const [key, value] of Object.entries(settingsObj)) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value)]
      );
    }
  } else {
    const upsert = sqliteDb.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    for (const [key, value] of Object.entries(settingsObj)) {
      upsert.run(key, String(value));
    }
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
    price: parseFloat(row.price),
    discountPrice: row.discount_price !== null ? parseFloat(row.discount_price) : null,
    stock: parseInt(row.stock, 10),
    sizes: typeof row.sizes === 'string' ? JSON.parse(row.sizes || '[]') : (row.sizes || []),
    colors: typeof row.colors === 'string' ? JSON.parse(row.colors || '[]') : (row.colors || []),
    images: typeof row.images === 'string' ? JSON.parse(row.images || '[]') : (row.images || []),
    description: row.description,
    features: typeof row.features === 'string' ? JSON.parse(row.features || '[]') : (row.features || []),
    fabricCare: typeof row.fabric_care === 'string' ? JSON.parse(row.fabric_care || '{}') : (row.fabric_care || {}),
    isFeatured: Boolean(row.is_featured),
    isSale: Boolean(row.is_sale),
    isNew: Boolean(row.is_new),
    rating: parseFloat(row.rating || 5.0),
    reviewsCount: parseInt(row.reviews_count || 0, 10),
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
    subtotal: parseFloat(row.subtotal),
    shippingCost: parseFloat(row.shipping_cost),
    total: parseFloat(row.total),
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

// ==============================================================================
// GESTIÓN DE CATEGORÍAS Y SUBCATEGORÍAS
// ==============================================================================

export async function getAllCategories() {
  let rows = [];
  if (isPostgres) {
    const res = await pool.query(`
      SELECT c.*, p.name as parent_name
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.parent_id NULLS FIRST, c.name ASC
    `);
    rows = res.rows;
  } else {
    rows = sqliteDb.prepare(`
      SELECT c.*, p.name as parent_name
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY CASE WHEN c.parent_id IS NULL THEN 0 ELSE 1 END, c.name ASC
    `).all();
  }

  const parents = rows.filter(r => !r.parent_id);
  const children = rows.filter(r => r.parent_id);

  const tree = parents.map(p => {
    const subcats = children
      .filter(c => Number(c.parent_id) === Number(p.id))
      .map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        parentId: p.id,
        parentName: p.name,
        description: c.description || '',
        createdAt: c.created_at
      }));

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      subcategories: subcats,
      createdAt: p.created_at
    };
  });

  return {
    tree,
    flat: rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      parentId: r.parent_id,
      parentName: r.parent_name || null,
      description: r.description || '',
      createdAt: r.created_at
    }))
  };
}

export async function createCategory({ name, slug, parentId, description }) {
  if (!name || !name.trim()) throw new Error('El nombre de la categoría es obligatorio.');

  const cleanName = name.trim();
  const cleanSlug = slug && slug.trim()
    ? slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
    : cleanName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '');
  const pid = parentId ? parseInt(parentId, 10) : null;
  const desc = description ? description.trim() : '';

  if (isPostgres) {
    const res = await pool.query(
      `INSERT INTO categories (name, slug, parent_id, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [cleanName, cleanSlug, pid, desc]
    );
    return res.rows[0];
  } else {
    const stmt = sqliteDb.prepare(
      `INSERT INTO categories (name, slug, parent_id, description) VALUES (?, ?, ?, ?)`
    );
    const info = stmt.run(cleanName, cleanSlug, pid, desc);
    return sqliteDb.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  }
}

export async function updateCategory(id, { name, slug, parentId, description }) {
  const catId = parseInt(id, 10);
  const cleanName = name ? name.trim() : undefined;
  const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') : undefined;
  const pid = parentId === '' || parentId === null || parentId === undefined ? null : parseInt(parentId, 10);
  const desc = description !== undefined ? description.trim() : undefined;

  if (isPostgres) {
    const res = await pool.query(
      `UPDATE categories
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           parent_id = $3,
           description = COALESCE($4, description)
       WHERE id = $5 RETURNING *`,
      [cleanName, cleanSlug, pid, desc, catId]
    );
    return res.rows[0];
  } else {
    sqliteDb.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          slug = COALESCE(?, slug),
          parent_id = ?,
          description = COALESCE(?, description)
      WHERE id = ?
    `).run(cleanName, cleanSlug, pid, desc, catId);
    return sqliteDb.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
  }
}

export async function deleteCategory(id) {
  const catId = parseInt(id, 10);
  if (isPostgres) {
    await pool.query('DELETE FROM categories WHERE id = $1', [catId]);
  } else {
    sqliteDb.prepare('DELETE FROM categories WHERE id = ?').run(catId);
  }
  return true;
}

// ==============================================================================
// AUTENTICACIÓN ADMINISTRADOR
// ==============================================================================

export async function verifyAdminCredentials(email, password) {
  const adminEmail = (await getSetting('admin_email')) || 'admin@tetel.com';
  const adminPassword = (await getSetting('admin_password')) || 'tetel@$2026';

  if (!email || !password) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase() && password === adminPassword;
}
