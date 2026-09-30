-- ==============================================================================
-- SCRIPT DE BASE DE DATOS: TETEL E-COMMERCE & WOMPI EL SALVADOR 3DS
-- Compatible con SQLite y PostgreSQL (Railway / Producción)
-- ==============================================================================

-- 1. TABLA DE PRENDAS Y PRODUCTOS
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    price REAL NOT NULL,
    discount_price REAL,
    stock INTEGER NOT NULL DEFAULT 0,
    sizes TEXT,              -- Array JSON: ["S", "M", "L", "XL"]
    colors TEXT,             -- Array JSON: [{"name": "Negro", "hex": "#111827"}]
    images TEXT,             -- Array JSON con URLs o rutas locales
    description TEXT,
    features TEXT,           -- Array JSON con viñetas de características
    fabric_care TEXT,        -- Objeto JSON con material, lavado, corte
    is_featured INTEGER DEFAULT 0,
    is_sale INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    rating REAL DEFAULT 5.0,
    reviews_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE PEDIDOS Y FACTURACIÓN
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    department TEXT NOT NULL,        -- Uno de los 14 departamentos de El Salvador
    municipality TEXT NOT NULL,      -- Municipio (ej. San Salvador Centro)
    district TEXT NOT NULL,          -- Distrito (ej. San Salvador, Santa Tecla)
    address_line TEXT NOT NULL,
    reference_point TEXT,
    postal_code TEXT DEFAULT 'CP 1101',
    subtotal REAL NOT NULL,
    shipping_cost REAL NOT NULL,
    total REAL NOT NULL,
    payment_method TEXT DEFAULT 'wompi_3ds',
    payment_status TEXT DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, FALLIDO
    wompi_transaction_id TEXT,
    wompi_auth_code TEXT,
    wompi_hash TEXT,
    delivery_status TEXT DEFAULT 'Procesando', -- Procesando, En Preparación, Enviado, Entregado, Cancelado
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE DETALLES DEL PEDIDO (ITEMS COMPRADOS)
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

-- 4. TABLA DE CONFIGURACIÓN DE LA TIENDA Y PASARELA 3DS
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 5. TABLA DE CATEGORÍAS Y SUBCATEGORÍAS
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INSERCIÓN DE DATOS SEMILLA: COLECCIÓN "THE NEW ERA" (TETEL)
-- ==============================================================================

INSERT OR REPLACE INTO products (
    id, name, sku, category, subcategory, price, discount_price, stock,
    sizes, colors, images, description, features, fabric_care,
    is_featured, is_sale, is_new, rating, reviews_count
) VALUES
(
    'prod-1',
    'Chaqueta Híbrida Cuero & Bandana ''The New Era''',
    'TTL-JKT-001',
    'Unisex',
    'Chaquetas',
    85.00,
    68.00,
    12,
    '["S","M","L","XL"]',
    '[{"name":"Negro Paisley","hex":"#111827"},{"name":"Rojo Rebel","hex":"#991b1b"}]',
    '["/assets/chaqueta-cuero-bandana.png","/assets/the-new-era-full-rack.png"]',
    'Pieza insignia de la colección ''The New Era''. Chaqueta con capucha confeccionada en eco-cuero satinado de alto gramaje y paneles con estampado bandana paisley en hombros, pecho y capucha. Cremallera frontal reforzada y puños elásticos.',
    '["Paneles de bandana paisley en algodón de alta densidad","Exterior en eco-cuero premium ultra flexible","Capucha forrada con cordones de ajuste","Edición Limitada Hecho con Cultura"]',
    '{"material":"60% Eco-cuero, 40% Algodón","washing":"Limpiar con paño húmedo","fit":"Boxy Streetwear Fit","origin":"El Salvador"}',
    1, 1, 1, 5.0, 47
),
(
    'prod-2',
    'Camisa Resort Bandana ''Black Paisley''',
    'TTL-CMS-002',
    'Unisex',
    'Camisas',
    45.00,
    34.90,
    20,
    '["S","M","L","XL","XXL"]',
    '[{"name":"Negro Clásico","hex":"#18181b"},{"name":"Blanco Hueso","hex":"#f8fafc"}]',
    '["/assets/camisa-bandana-negra.png","/assets/camisas-new-era-rack.png"]',
    'Camisa resort de manga corta y cuello cubano abierto. Estampado bandana simétrico que rinde tributo a la cultura urbana. Confección en tela ligera y transpirable perfecta para el clima de El Salvador.',
    '["100% Rayón sedoso de máxima frescura","Cuello camp cubano vintage contemporáneo","Botonadura frontal al tono","Estampado serigráfico de tacto cero"]',
    '{"material":"100% Viscosa / Rayón sedoso","washing":"Lavado con agua fría ciclo suave","fit":"Relaxed Fit","origin":"TETEL Studio"}',
    1, 1, 1, 4.9, 38
),
(
    'prod-3',
    'Camisa Resort Bandana ''Burgundy Culture''',
    'TTL-CMS-003',
    'Hombre',
    'Camisas',
    48.00,
    36.50,
    15,
    '["S","M","L","XL"]',
    '[{"name":"Guinda Borgoña","hex":"#7f1d1d"},{"name":"Negro","hex":"#09090b"}]',
    '["/assets/camisa-bandana-guinda.png","/assets/camisas-new-era-rack.png"]',
    'La versión en color guinda noble de nuestra icónica camisa bandana. Diseñada para destacar con elegancia urbana en eventos casuales, cenas o festivales.',
    '["Colorante reactivo tono Borgoña Imperial","Detalles paisley contrastantes en blanco nítido","Bolsillo frontal al pecho alineado con el patrón","Aberturas laterales en bajo"]',
    '{"material":"100% Algodón popelín","washing":"Lavar a 30°C con colores oscuros","fit":"Regular Fit urbano","origin":"Hecho con Cultura El Salvador"}',
    1, 1, 1, 4.9, 26
),
(
    'prod-4',
    'Pantalón Street Jogger Bandana ''Culture''',
    'TTL-PNT-004',
    'Unisex',
    'Pantalones',
    58.00,
    44.00,
    16,
    '["S","M","L","XL"]',
    '[{"name":"Negro Bandana","hex":"#111827"}]',
    '["/assets/joggers-bandana.png","/assets/the-new-era-full-rack.png"]',
    'Pantalón urbano tipo jogger con estampado integral de bandana paisley. Cintura con elástico grueso y cordón ajustable con herrajes metálicos. El complemento exacto para coordinar con la chaqueta o la camisa.',
    '["Tejido de sarga suave con elasticidad añadida","Cinturilla elástica con cordón de ajuste","Dos bolsillos laterales y uno trasero de ojal","Bajo con puño elástico ceñido al tobillo"]',
    '{"material":"97% Algodón peinado, 3% Elastano","washing":"Lavar al revés","fit":"Tapered Street Fit","origin":"El Salvador"}',
    1, 1, 0, 4.8, 19
),
(
    'prod-5',
    'Tote Bag Artesanal Bandana ''Black Canvas''',
    'TTL-ACC-005',
    'Accesorios',
    'Bolsos',
    28.00,
    19.99,
    25,
    '["Única"]',
    '[{"name":"Negro Bandana","hex":"#111827"}]',
    '["/assets/tote-bag-bandana.png"]',
    'Bolso tote amplio confeccionado en lona de algodón pesado de 14 oz con estampado bandana completo. Asas dobles reforzadas con puntada en cruz, ideal para laptop, libros o compras diarias con estilo streetwear.',
    '["Lona de algodón orgánico 100% de 14 oz ultra duradera","Asas de hombro de 65 cm reforzadas","Bolsillo interior con cremallera para llaves y móvil","Estampado integral en ambas caras"]',
    '{"material":"100% Lona de algodón","washing":"Lavado a mano con jabón neutro","fit":"Capacidad 18 litros","origin":"Artesanía Urbana TETEL"}',
    1, 1, 1, 5.0, 54
),
(
    'prod-6',
    'Camiseta Boxy ''New Era'' Split Paisley',
    'TTL-TSH-006',
    'Unisex',
    'Camisetas',
    36.00,
    28.00,
    30,
    '["S","M","L","XL","XXL"]',
    '[{"name":"Blanco / Bandana","hex":"#ffffff"},{"name":"Negro / Bandana","hex":"#18181b"}]',
    '["/assets/camisas-new-era-rack.png"]',
    'Camiseta pesada de 240 gsm con corte boxy caído en hombros. Detalle triangular de bandana paisley en el bajo frontal y logo minimalista ''TL'' bordado en la nuca.',
    '["100% Algodón grueso de 240 gsm que no pierde forma","Cuello cerrado acanalado de 3 cm resistente","Panel angular de bandana paisley cosido","Hombros caídos de streetwear japonés"]',
    '{"material":"100% Algodón peinado pesado","washing":"Lavar a máquina a 30°C","fit":"Boxy Oversized Fit","origin":"Colección Junio 2026"}',
    0, 1, 1, 4.9, 31
),
(
    'prod-7',
    'Set ''The New Era'' Limited Release (Colección Completa 4 Piezas)',
    'TTL-CAP-007',
    'Unisex',
    'Colecciones',
    195.00,
    149.00,
    5,
    '["S","M","L","XL"]',
    '[{"name":"Edición Limitada Monocromática","hex":"#09090b"}]',
    '["/assets/the-new-era-full-rack.png","/assets/campaign-banner.png"]',
    'El paquete de colección definitivo: incluye la Chaqueta Híbrida Cuero & Bandana, la Camisa Resort Paisley, la Camiseta Boxy TL y el Jogger a juego. Cada conjunto viene numerado con certificado de autenticidad.',
    '["Pack exclusivo de 4 prendas icónicas de la campaña","Ahorro de más de $60 frente a la compra individual","Empaque especial de coleccionista con logo TL","Envío gratis prioritario a todo El Salvador"]',
    '{"material":"Combinación eco-cuero, rayón sedoso y algodón","washing":"Ver instrucciones por prenda","fit":"Coordinado completo","origin":"Hecho con Cultura El Salvador"}',
    1, 1, 1, 5.0, 18
);

-- ==============================================================================
-- CONFIGURACIÓN DE LA TIENDA Y PASARELA 3DS
-- ==============================================================================
INSERT OR REPLACE INTO settings (key, value) VALUES
('store_name', 'TETEL | Hecho con Cultura El Salvador'),
('admin_email', 'admin@tetel.com'),
('admin_password', 'tetel@$2026'),
('wompi_client_id', 'demo_wompi_app_id'),
('wompi_client_secret', 'demo_wompi_secret'),
('wompi_environment', 'desarrollo'),
('wompi_simulator_mode', 'true'),
('free_shipping_threshold', '60.00'),
('currency', 'USD');

-- ==============================================================================
-- INSERCIÓN DE CATEGORÍAS Y SUBCATEGORÍAS INICIALES
-- ==============================================================================
INSERT OR REPLACE INTO categories (id, name, slug, parent_id, description) VALUES
(1, 'Chaquetas & Outerwear', 'chaquetas-outerwear', NULL, 'Prendas de abrigo urbano, eco-cuero y estampados paisley'),
(2, 'Camisas & Tops', 'camisas-tops', NULL, 'Camisas resort de autor, playeras oversize y tops de corte moderno'),
(3, 'Pantalones & Bottoms', 'pantalones-bottoms', NULL, 'Joggers paisley de corte relajado, cargo pants y denim de autor'),
(4, 'Calzado', 'calzado', NULL, 'Sneakers urbanos y calzado streetwear'),
(5, 'Accesorios', 'accesorios', NULL, 'Bandanas de seda salvadoreñas, tote bags y accesorios'),
-- Subcategorías
(6, 'Eco-cuero & Bandana', 'eco-cuero-bandana', 1, 'Prendas con apliques de eco-cuero'),
(7, 'Bomber Jackets', 'bomber-jackets', 1, 'Chaquetas bomber de corte relajado'),
(8, 'Chalecos Streetwear', 'chalecos-streetwear', 1, 'Chalecos utilitarios'),
(9, 'Camisas Resort', 'camisas-resort', 2, 'Camisas frescas manga corta con estampado'),
(10, 'Boxy Tees Oversize', 'boxy-tees-oversize', 2, 'Camisetas con cuello reforzado de 240g'),
(11, 'Hoodies Gráficos', 'hoodies-graficos', 2, 'Sudaderas con capucha de corte amplio'),
(12, 'Joggers Paisley', 'joggers-paisley', 3, 'Pantalones deportivos con cortes bandana'),
(13, 'Cargo Pants Urbanos', 'cargo-pants-urbanos', 3, 'Pantalones multibolsillo de corte recto'),
(14, 'Denim Streetwear', 'denim-streetwear', 3, 'Jeans con detalles de confección'),
(15, 'Sneakers Urbanos', 'sneakers-urbanos', 4, 'Calzado urbano contemporáneo'),
(16, 'Bandanas de Seda', 'bandanas-seda', 5, 'Bandanas artesanales de seda y algodón'),
(17, 'Tote Bags', 'tote-bags', 5, 'Bolsos de lona pesada con estampados');
