# Shanghai Express — beta web v2

Prototipo estático móvil para Abancay. No es APK, no tiene backend y no realiza pedidos, cobros, SMS, llamadas ni GPS reales.

## Vista previa

Servidor de esta revisión: http://localhost:8441/

Para reiniciar:

```sh
python3 -m http.server 8441 --directory /workspace/shanghai-express/site
```

Publicar index.html, app.js, styles.css, menu-source.json y assets/ conservando las rutas relativas. `_dev/` contiene pruebas, no hace falta publicarlo. No se modificó ni publicó la copia del repositorio.

## Acceso de prueba

- La primera apertura muestra celular de Perú (+51 fijo), Enviar código y **Omitir** visible.
- Formato: nueve dígitos empezando por 9. Usar números ficticios.
- No se envía SMS: el código visible para la demo es **123456**.
- Omitir abre inmediatamente la app y crea/reutiliza un perfil invitado local.
- En Inicio, **Cambiar** permite volver a la pantalla de acceso y cambiar de perfil.
- La sesión se recuerda al recargar; no se pide acceso otra vez si existe una sesión demo válida.

### Privacidad y alcance del almacenamiento

`localStorage` guarda la sesión (celular o decisión de omitir) y hasta 30 pedidos por perfil local. La UI solo carga pedidos cuyo propietario coincide con el teléfono/perfil invitado activo; no enumera pedidos de otros perfiles. Se conservan dirección, productos, total, pago simulado y chat para retomar la demo. Nombre, celular de checkout y referencia no se guardan. El carrito sigue solo en memoria.

Claves: `shanghai-express:session:v2`, `shanghai-express:guest:v2` y `shanghai-express:orders:v2:<perfil>`.

**No es autenticación ni una separación segura de cuentas.** Todo está en el navegador, sin cifrado. Cualquiera con acceso al mismo dispositivo puede elegir un teléfono conocido o inspeccionar su almacenamiento. Nunca usar esta beta para pedidos o datos personales reales. Producción requiere verificación SMS y autorización/aislamiento en servidor. Si el almacenamiento está deshabilitado, la demo funciona en memoria y no se recordará tras recargar.

## Flujo de entrega

1. Agregar productos y abrir checkout.
2. **Solicitar pedido** abre “Esperando a que un motorizado tome su pedido”, con animación, durante siete segundos.
3. Se asigna Carlos Huamán (nombre ficticio), con avatar SVG original, moto roja, placa de muestra DEMO-01 y valoración de ejemplo 4.9.
4. La tarjeta “Carlos ya tomó tu pedido” permite **Chatear**, **Llamar** o **Ver seguimiento en el mapa**.
5. En el mapa hay exactamente un motorizado asignado, más dos puntos estáticos ilustrativos (recojo y destino). No se muestran otros motorizados.
6. Etapas tras asignarse: Tomado 0–10 s; En camino 10–95 s; Llegando 95–120 s; Entregado desde 120 s. Demo acelerada y reanudable tras recargar.
7. **Repetir simulación** reinicia la búsqueda y la entrega del mismo pedido demo. Los pedidos anteriores del perfil aparecen debajo del seguimiento.

Chat: saludo inicial, aviso de recojo/en camino, mensaje de llegada y cierre. El cliente puede escribir mensajes; Carlos responde automáticamente después de aproximadamente 1.4 s. Todo es local y ficticio. Se escapa texto antes de mostrarlo.

Llamada: pantalla visual de simulación con avatar, nombre y **Colgar**. No hay enlaces telefónicos, números marcados, permisos de micrófono ni audio.

## Catálogo y mapa

Se conserva el inicio crema/rojo/dorado, búsqueda, categorías, carrito y checkout efectivo/Yape. Frutas/verduras/lácteos y reparto S/4 son ejemplos; no representan inventario real.

Tres platos/precios copiados de la carta digital existente: Chaufa con pollo S/13, Tallarín saltado con pollo S/15, Pollo chijaukay S/18. Origen en menu-source.json; disponibilidad y delivery no confirmados.

Leaflet local; tiles OpenStreetMap requieren conexión. Ruta y ubicaciones dibujadas a mano, no verificadas ni aptas para navegación. La dirección escrita no geocodifica el destino. Única fuente de posición: `riderPositionSource(elapsed)` en app.js; sustituible por un proveedor GPS autenticado en una fase posterior. Ningún dato de checkout se envía a OSM; el proveedor recibe las solicitudes de tiles del área del mapa.

## Pruebas realizadas

- `node --check app.js`: aprobado.
- `node _dev/test-v2.cjs`: aprobado (necesita jsdom; en este box está en /workspace/shanghai-express/test-tools/node_modules/jsdom).
- DOM: acceso, formato/código inválidos, código correcto, Omitir, perfiles invitados, cambio de teléfono, aislamiento UI, recarga/persistencia, espera, aceptación, seguimiento, interpolación, etapas, repetición, múltiples pedidos, chat/auto-respuesta, escape de HTML y llamada simulada.
- Stub Leaflet verifica exactamente dos pines estáticos y un marcador del motorizado asignado.
- HTTP local responde 200.

**Pendiente:** inspección visual real a 390×844, carga real de tiles/interacción Leaflet y seis capturas (login, waiting, accepted, tracking, chat, call). No se generaron PNG: este ejecutor no dispone del subagente de navegador exigido por sus reglas; no se sustituyó por Playwright/Shell. Las pruebas DOM no equivalen a QA visual.

## Archivos de esta revisión

Modificados: app.js, styles.css, README.md.
Añadidos: assets/rider-demo.svg, _dev/test-v2.cjs.
Sin cambios: index.html, menú de origen y demás recursos existentes.

## Créditos

Diseño e ilustraciones SVG originales. Logo Chifa Shanghai proporcionado por el sitio del propietario. Leaflet 1.9.4 (BSD-2-Clause; assets/LEAFLET-LICENSE.txt). Cartografía © OpenStreetMap contributors, con atribución visible. Respetar https://operations.osmfoundation.org/policies/tiles/ antes de un lanzamiento público de mayor tráfico.
