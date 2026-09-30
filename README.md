# TETEL | Plataforma E-commerce de Moda & Alta Costura
### Con Pasarela Wompi El Salvador 3D Secure, Logística Nacional y Panel de Administración

Plataforma de comercio electrónico con propuesta visual y funcional **estilo Shopify**, diseñada específicamente para la venta de prendas de vestimenta en **El Salvador**.

---

## 🌟 Características Principales

### 1. Experiencia de Compra (Estilo Shopify)
- **Diseño Visual de Lujo**: Tipografía editorial (*Playfair Display* & *Plus Jakarta Sans*), microanimaciones fluidas, paleta *Slate Noir* & *Gold Champagne*, y tarjetas con efecto *Glassmorphism*.
- **Catálogo de Prendas con SKU**: Precios normales tachados, precios de oferta destacados en terracota, cálculo automático de porcentaje de descuento, etiquetas de stock y código SKU visible.
- **Carrito Deslizable (*Slide-Over Drawer*)**:
  - Barra de progreso interactiva para **Envío Gratis** a todo El Salvador.
  - Modificadores de cantidad en tiempo real (+ / -) y eliminación de prendas.
  - Selector de departamento dentro del carrito con cálculo instantáneo de envío y total.
- **Lista de Deseos (*Wishlist Drawer*)**: Guardado en memoria local, contador animado en cabecera y función de un clic para mover prendas al carrito.
- **Vista Rápida (*Quick View*)**: Galería de imágenes, selector de tallas (XS, S, M, L, XL, XXL), muestras de color interactivas, guía de tallas de El Salvador y detalles de tejido y confección.
- **Buscador en Vivo y Filtros**: Filtrado instantáneo por nombre, SKU o categoría (Mujer, Hombre, Unisex, En Oferta) y ordenamiento por precio o novedad.

---

### 2. Logística y Envíos en El Salvador (14 Departamentos y Distritos)
- Base de datos completa con los **14 departamentos**:
  1. San Salvador
  2. La Libertad
  3. Santa Ana
  4. Sonsonate
  5. Ahuachapán
  6. Cuscatlán
  7. La Paz
  8. Chalatenango
  9. San Vicente
  10. Cabañas
  11. Usulután
  12. San Miguel
  13. Morazán
  14. La Unión
- Estructura con los **44 municipios y distritos** (San Salvador Centro, Santa Tecla, Antiguo Cuscatlán, San Miguel Centro, Santa Ana Centro, etc.).
- **Calculador en Portada**: Permite al cliente cotizar el flete y conocer el tiempo estimado de entrega (24h, 48h, 72h) antes de iniciar la compra.

---

### 3. Pasarela de Pagos con Tarjeta: Wompi El Salvador 3DS
Integración siguiendo la [documentación oficial de Wompi El Salvador](https://docs.wompi.sv/metodos-api/crear-transaccion-compra-3ds):
- **Autenticación OAuth 2.0**: Consumo de `POST https://id.wompi.sv/connect/token` mediante *Client Credentials Flow* (`grant_type=client_credentials`, `audience=wompi_api`).
- **Creación de Transacción 3DS**: Invocación desde el backend a `POST https://api.wompi.sv/TransaccionCompra/3DS` con mapeo de códigos ISO 3166-2 para El Salvador (`SV-SS`, `SV-LI`, etc.).
- **Reto de Seguridad 3D Secure**:
  - Soporte para redirección a `urlCompletarPago3Ds`.
  - **Modo Simulador 3DS Integrado**: Permite probar compras de inmediato con tarjetas ficticias emulando el reto bancario de SMS OTP (Banco Agrícola / BAC / Cuscatlán) sin requerir una cuenta de comercio activa.
  - Validación de respuesta con código de autorización y guardado en base de datos.
- **Soporte Webhook**: Endpoint `/api/wompi/webhook` para recepción asíncrona de transacciones aprobadas.
- **Mascara de Tarjeta Interactiva**: Detección dinámica de marca (Visa, Mastercard, Amex), formateo de 16 dígitos y reflejo en tiempo real del titular y vencimiento.

---

### 4. Base de Datos Integrada (SQLite Nativo)
- Motor SQLite (`node:sqlite`) con persistencia local en `server/database.sqlite`.
- Tablas relacionales:
  - `products`: Catálogo completo con SKU, precios normales, precios oferta, inventario, tallas y especificaciones.
  - `orders`: Registro de pedidos, datos del cliente, dirección exacta en SV, montos, estado de pago y Wompi Auth Code.
  - `order_items`: Desglose de prendas, tallas y colores comprados.
  - `settings`: Configuración editable de Wompi (App ID, API Secret, Ambiente, Simulador, Envío gratis).

---

### 5. Panel de Administración (*Shopify Admin Style*)
Acceso directo desde el enlace superior **"Admin Store"** o mediante la URL: `http://localhost:3000#admin`.
- **Métricas en Tiempo Real**: Ventas totales cobradas por Wompi, pedidos registrados, cantidad de prendas en catálogo y alerta de stock bajo.
- **Subir Nueva Prenda**:
  - Nombre de la prenda y generación automática de **Código SKU** (`TTL-XXX-000`).
  - Categoría y subcategoría.
  - **Precio Normal** y **Precio con Descuento** (precio de oferta).
  - Cantidad en stock.
  - Tallas disponibles mediante casillas de verificación.
  - Subida de fotografías directamente desde la computadora (`/api/upload`) o mediante URL.
  - Descripción, características en viñetas y banderas de "Destacado en portada" o "En oferta".
- **Edición y Eliminación de Prendas**: Modificación de inventario y datos en cualquier momento.
- **Gestión de Pedidos**: Lista completa con actualización en vivo del estado logístico (*Procesando*, *En Preparación*, *Enviado*, *Entregado*, *Cancelado*).
- **Configuración de Wompi**: Formulario para colocar el App ID y API Secret oficiales de Wompi, conmutar entre Sandbox y Producción o activar/desactivar el modo simulador.

---

## 🚀 Cómo Ejecutar el Proyecto Localmente

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar la aplicación**:
   ```bash
   npm start
   ```

3. **Abrir en el navegador**:
   - **Tienda para clientes**: [http://localhost:3000](http://localhost:3000)
   - **Panel de administración**: [http://localhost:3000#admin](http://localhost:3000#admin)
   - **Confirmación Wompi**: [http://localhost:3000/checkout-confirmacion.html](http://localhost:3000/checkout-confirmacion.html)

---

## ⚙️ Conectar tus Credenciales Reales de Wompi El Salvador

Puedes configurar tus credenciales de dos maneras:

1. **Desde el Panel de Administración de la Web**:
   - Ingresa a [http://localhost:3000#admin](http://localhost:3000#admin)
   - Ve a la pestaña **"💳 Configuración Wompi"**
   - Ingresa tu **Wompi Client ID (App ID)** y tu **Wompi API Secret**
   - Selecciona el ambiente (**Producción** o **Desarrollo**)
   - Haz clic en **Guardar Configuración**

2. **O mediante archivo `.env`**:
   Copia `.env.example` a `.env` y completa las variables:
   ```env
   PORT=3000
   WOMPI_CLIENT_ID=tu_app_id_wompi
   WOMPI_CLIENT_SECRET=tu_api_secret_wompi
   WOMPI_ENVIRONMENT=desarrollo
   WOMPI_SIMULATOR_MODE=false
   ```
