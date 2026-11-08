# Shanghai Express — beta estática

Prototipo móvil independiente para Abancay. No modifica el sitio Chifa Shanghai.

## Vista previa

`python3 -m http.server 8437 --directory /workspace/shanghai-express/site`

Abrir http://localhost:8437/. Publicar el contenido de esta carpeta bajo cualquier subruta: todos los recursos propios usan rutas relativas.

## Incluye

- Inicio, búsqueda, Frutas, Verduras, Lácteos, Locales y ficha Chifa Shanghai.
- Ilustraciones SVG originales; logo copiado del sitio existente.
- Tres platos/precios copiados de la carta existente (registro en menu-source.json): Chaufa con pollo S/13, Tallarín saltado con pollo S/15, Pollo chijaukay S/18.
- Carrito en memoria, cantidades, subtotal, reparto y total.
- Checkout de prueba con validación de celular; efectivo/Yape ilustrativos. No QR, transferencias ni pedidos enviados.
- Seguimiento Leaflet con tiles OpenStreetMap, ruta ilustrativa, puntos de recojo/destino y motorizado animado.
- Simulación acelerada: recibido 0–6s, preparando 6–18s, en camino 18–120s, llegó desde 120s. Botón para repetir.

## Límites deliberados

Todos los productos del mercado, disponibilidad, reparto S/4 y tiempos son ejemplos. Los precios de los tres platos vienen de la carta pero no confirman disponibilidad ni tarifa delivery. Ningún negocio está integrado.

El mapa necesita conexión para cargar tiles; Leaflet está guardado localmente. Ubicaciones/ruta dibujadas a mano, no verificadas y no aptas para navegación. No se consulta el GPS del cliente ni de un repartidor. La función única `riderPositionSource(elapsed)` en app.js permite sustituir la posición simulada por un proveedor de GPS autenticado en una siguiente fase.

La dirección no cambia el destino del mapa: es texto ilustrativo. El formulario aconseja datos ficticios; el nombre, teléfono y referencia se descartan al simular y no se persisten ni transmiten. Dirección y pago quedan solo en memoria de esa pestaña. OSM recibe solicitudes de tiles del mapa, no datos del checkout.

No hay backend, pagos, cuentas, inventario, asignación de motorizados, notificaciones, pedidos reales ni persistencia tras recargar. Nada publicado.

## Validación realizada

Sintaxis JS comprobada con `node --check`. Flujo probado en DOM con jsdom: búsqueda/resultado vacío, categorías, carrito +/−, total/envío, checkout, escape de datos, estados y progreso del motorizado, repetición y carrito vacío. Servidor HTTP local devuelve 200 y se comprobó la presencia de recursos.

Pendiente: QA visual real a 390px, interacción del mapa/tiles y capturas en Chrome. No se generaron capturas: este ejecutor no dispone del subagente de navegador exigido por sus reglas y no puede sustituirlo por automatización Shell/Playwright.

## Créditos

Diseño e ilustraciones SVG originales. Logo Chifa Shanghai proporcionado por el sitio del propietario. Leaflet 1.9.4 (BSD-2-Clause; licencia en assets/LEAFLET-LICENSE.txt). Cartografía © OpenStreetMap contributors; atribución visible en el mapa. Mantener atribuciones y respetar https://operations.osmfoundation.org/policies/tiles/ antes de un lanzamiento público de mayor tráfico.
