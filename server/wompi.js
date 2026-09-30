import crypto from 'node:crypto';
import { getSetting } from './db.js';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Obtener Token OAuth 2.0 de Wompi El Salvador
 * Endpoint: POST https://id.wompi.sv/connect/token
 */
export async function getWompiAccessToken() {
  const clientId = getSetting('wompi_client_id');
  const clientSecret = getSetting('wompi_client_secret');
  const isSimulator = getSetting('wompi_simulator_mode') === 'true';

  if (isSimulator || !clientId || clientId.startsWith('demo_')) {
    return 'demo_simulated_bearer_token_' + Date.now();
  }

  // Verificar si el token en caché aún es válido (con margen de 60 segundos)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('audience', 'wompi_api');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const response = await fetch('https://id.wompi.sv/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('⚠️ Error al autenticar con Wompi OAuth:', errText);
      throw new Error(`Wompi Auth Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    return cachedToken;
  } catch (error) {
    console.error('Error obteniendo token Wompi:', error.message);
    throw error;
  }
}

/**
 * Mapeo de Códigos de Departamento El Salvador a ISO 3166-2 para Wompi
 */
const DEPARTMENT_ISO_MAP = {
  'Ahuachapán': 'SV-AH',
  'Santa Ana': 'SV-SA',
  'Sonsonate': 'SV-SO',
  'Chalatenango': 'SV-CH',
  'La Libertad': 'SV-LI',
  'San Salvador': 'SV-SS',
  'Cuscatlán': 'SV-CU',
  'La Paz': 'SV-PA',
  'Cabañas': 'SV-CA',
  'San Vicente': 'SV-SV',
  'Usulután': 'SV-US',
  'San Miguel': 'SV-SM',
  'Morazán': 'SV-MO',
  'La Unión': 'SV-UN'
};

/**
 * Crear Transacción Compra con 3DS en Wompi El Salvador
 * Endpoint: POST https://api.wompi.sv/TransaccionCompra/3DS
 */
export async function createWompiTransaction3DS({
  cardData,
  amount,
  customer,
  delivery,
  orderNumber,
  redirectUrlBase
}) {
  const isSimulator = getSetting('wompi_simulator_mode') === 'true';
  const clientId = getSetting('wompi_client_id');
  const clientSecret = getSetting('wompi_client_secret');

  const idRegion = DEPARTMENT_ISO_MAP[delivery.department] || 'SV-SS';
  const cleanCardNumber = cardData.cardNumber.replace(/\s+/g, '');
  const month = parseInt(cardData.expMonth, 10);
  const year = parseInt(cardData.expYear.toString().length === 2 ? `20${cardData.expYear}` : cardData.expYear, 10);

  // Separar nombre y apellido si vienen juntos
  const nameParts = customer.name.trim().split(' ');
  const nombre = nameParts[0] || 'Cliente';
  const apellido = nameParts.slice(1).join(' ') || 'General';

  // Si estamos en modo simulador o las credenciales no están configuradas,
  // proveer la experiencia 3DS simulada realista
  if (isSimulator || !clientId || clientId.startsWith('demo_') || !clientSecret || clientSecret.startsWith('demo_')) {
    const idTransaccion = crypto.randomUUID();
    const isSuccess = cardData.cvv !== '111'; // Simulación oficial de Wompi: CVV 111 deniega

    // URL 3DS challenge simulada
    const simulatedChallengeUrl = `${redirectUrlBase}/3ds-auth.html?idTransaccion=${idTransaccion}&monto=${amount.toFixed(2)}&orderNumber=${orderNumber}&nombre=${encodeURIComponent(customer.name)}&tarjeta=${cleanCardNumber.slice(-4)}&aprobada=${isSuccess}`;

    return {
      success: true,
      isSimulated: true,
      idTransaccion,
      esReal: false,
      urlCompletarPago3Ds: simulatedChallengeUrl,
      monto: amount
    };
  }

  // --- Ejecución en el API Real de Wompi ---
  try {
    const accessToken = await getWompiAccessToken();
    const returnUrl = `${redirectUrlBase}/checkout-confirmacion.html?orderNumber=${orderNumber}`;

    const payload = {
      tarjetaCreditoDebido: {
        numeroTarjeta: cleanCardNumber,
        cvv: cardData.cvv,
        mesVencimiento: month,
        anioVencimiento: year
      },
      monto: parseFloat(amount.toFixed(2)),
      urlRedirect: returnUrl,
      nombre,
      apellido,
      email: customer.email,
      ciudad: delivery.district || delivery.municipality || 'San Salvador',
      direccion: `${delivery.addressLine}, ${delivery.district}, ${delivery.department}`,
      idPais: 'SV',
      idRegion: idRegion,
      codigoPostal: delivery.postalCode || 'CP 1101',
      telefono: customer.phone,
      configuracion: {
        notificarTransaccionCliente: true
      },
      datosAdicionales: {
        orderNumber,
        department: delivery.department,
        district: delivery.district
      }
    };

    const response = await fetch('https://api.wompi.sv/TransaccionCompra/3DS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error desde API Wompi 3DS:', errorData);
      return {
        success: false,
        error: `Wompi error (${response.status}): ${errorData}`
      };
    }

    const result = await response.json();
    return {
      success: true,
      isSimulated: false,
      idTransaccion: result.idTransaccion,
      esReal: result.esReal,
      urlCompletarPago3Ds: result.urlCompletarPago3Ds,
      monto: result.monto
    };
  } catch (err) {
    console.error('Fallo de conexión con Wompi:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Consulta del estado de una transacción Wompi por ID
 * Endpoint: GET https://api.wompi.sv/TransaccionCompra/{id}
 */
export async function getWompiTransaction(transactionId) {
  const isSimulator = getSetting('wompi_simulator_mode') === 'true';
  if (isSimulator) {
    return {
      idTransaccion: transactionId,
      esReal: false,
      esAprobada: true,
      codigoAutorizacion: 'AUTH' + Math.floor(100000 + Math.random() * 900000),
      mensaje: 'TRANSACCION SIMULADA EXITOSA'
    };
  }

  try {
    const accessToken = await getWompiAccessToken();
    const response = await fetch(`https://api.wompi.sv/TransaccionCompra/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error consultando transacción Wompi: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error al consultar transacción Wompi:', error);
    return null;
  }
}

/**
 * Generador / Validador de Hash HMAC de Wompi para asegurar integridad en Redirect
 */
export function generateWompiHash({ idTransaccion, monto, codigoAutorizacion, secretKey }) {
  const data = `${idTransaccion}${monto}${codigoAutorizacion}`;
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}
