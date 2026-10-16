# SENATI TaskHub PWA - Actividad 2
## Reto: Bandeja de entregas offline con validación y control de estado

**Institución:** SENATI - Escuela de Tecnologías de la Información  
**Curso / Módulo:** Taller PWA – App Manifest & Service Workers  
**Instructor:** Jorge Luque Chambi  
**Proyecto:** PROYECTO 2 · SENATI TaskHub PWA  
**Tecnologías:** Angular 17/19 · TypeScript · Angular Service Worker (`@angular/service-worker`) · Cache Storage · IndexedDB (`senatiTaskDB`) · SCSS  

---

## 📌 1. Resumen y Alcance del Proyecto

Este proyecto convierte el prototipo inicial de gestión de tareas en un **flujo completo de entregas académicas local, consultable, validado y con control honesto de sincronización**:
- **Catálogo interactivo:** Búsqueda en tiempo real por título y filtro combinable por curso con opción de restablecimiento.
- **Formulario validado:** Control estricto de selección de tarea y contenido no vacío antes de procesar el registro.
- **Persistencia en IndexedDB (`senatiTaskDB`):** Almacenamiento estructurado en la tabla/object store `entregas_pendientes`. Los datos no se pierden tras recargar el navegador (`F5`) ni al cerrar la sesión.
- **Bandeja "Mis Entregas Locales":** Consulta histórica de entregas, visualización técnica de detalles y eliminación protegida mediante confirmación modal.
- **Criterio Técnico Transversal (Honestidad de Sincronización):** No se engaña al usuario afirmando que una entrega se envió a un servidor cuando no existe una API remota empresarial. Cada registro inicia en estado `PENDIENTE`. Con conexión disponible se indica `Con conexión: listo para intentar sincronizar`. Al reintentar, se audita el intento y se informa con veracidad técnica.

---

## 🚀 2. Instrucciones de Instalación y Ejecución

### Prerrequisitos
- Node.js (v18.x o v20.x recomendado)
- NPM (v10.x)
- Angular CLI

### Pasos para iniciar en modo desarrollo
```bash
# Navegar a la carpeta del proyecto
cd senati-taskhub-pwa

# Instalar dependencias si no estuvieran instaladas
npm install

# Iniciar servidor de desarrollo local
npm start
# o
ng serve
```
Abra su navegador en: `http://localhost:4200/`

### Pasos para compilar y probar Service Worker en Producción
El Service Worker de Angular se activa en compilaciones de producción:
```bash
# Compilar bundle de producción con Service Worker
npm run build

# Servir con cualquier servidor HTTP local (por ejemplo con npx http-server)
npx http-server dist/senati-taskhub-pwa -p 8080 -c-1
```
Abra `http://localhost:8080/` para auditar el Service Worker en DevTools.

---

## 🧩 3. Arquitectura y Mecanismos PWA

| Mecanismo | Uso específico en SENATI TaskHub | Lo que NO significa |
| :--- | :--- | :--- |
| **App Manifest** (`manifest.webmanifest`) | Nombre, íconos adaptativos, colores institucionales (#0033A0) y modo de visualización `standalone`. | No guarda datos de tareas ni entregas. |
| **Service Worker / Cache Storage** | Almacena la shell de la aplicación (HTML, CSS, JS) y la petición GET a `tareas.json`. | No es una cola automática de solicitudes POST. |
| **IndexedDB** (`senatiTaskDB`) | Base de datos NoSQL local que persiste objetos completos `EntregaLocal`. | No sincroniza por arte de magia sin una API. |
| **navigator.onLine** | Proporciona detección reactiva de eventos `online` y `offline` del navegador. | No garantiza que una API empresarial responda. |

---

## 📋 4. Modelo de Datos y Servicios Implementados

### Interfaz `EntregaLocal`
```typescript
export type EstadoSincronizacion = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';

export interface EntregaLocal {
  id?: number;
  tareaId: number;
  curso: string;
  tituloTarea: string;
  comentario: string;
  fechaRegistro: string;
  estadoSincronizacion: EstadoSincronizacion;
  intentosSincronizacion: number;
  ultimoError?: string;
}
```

### Métodos del `StorageService`
- `abrirDB()`: Inicializa o conecta con `senatiTaskDB` versión 1 y asegura el object store `entregas_pendientes`.
- `guardarEntregaLocal(entrega)`: Asigna timestamp ISO, estado inicial `PENDIENTE`, intentos = 0 y persiste el registro de forma atómica.
- `listarEntregas()`: Recupera todos los registros ordenados descendentemente.
- `obtenerEntrega(id)`: Consulta individual de un registro para ver su detalle.
- `eliminarEntrega(id)`: Elimina definitivamente un registro tras confirmación.
- `contarPendientes()`: Calcula de forma reactiva cuántas entregas están en estado `PENDIENTE`.
- `actualizarEstado(id, estado, ultimoError)`: Modifica metadatos tras intentos de sincronización.

---

## ✅ 5. Plan de Pruebas y Resultados de Verificación (T1 - T8)

| ID | Prueba | Procedimiento Realizado | Resultado Verificable / Aceptación |
| :---: | :--- | :--- | :--- |
| **T1** | Buscar por título y filtrar curso | Escribir término (ej. "service") y seleccionar curso "Desarrollo de Software PWA". | Se filtran en tiempo real solo las tareas que satisfacen ambos filtros combinados. |
| **T2** | Enviar formulario vacío | Dejar comentario en blanco o sin tarea y hacer clic en Guardar. | El formulario bloquea el registro, resalta los campos en rojo y muestra mensajes específicos de error. |
| **T3** | Guardar comentario en Offline | Simular red Offline en DevTools y registrar una entrega. | Se almacena correctamente en IndexedDB con estado explícito `PENDIENTE`. |
| **T4** | Recargar la PWA (Persistencia) | Presionar F5 o recargar la página. | Los registros en "Mis Entregas Locales" se leen de IndexedDB y permanecen íntegros con sus campos. |
| **T5** | Crear varias entregas y contador | Registrar dos o más entregas. | El contador de pendientes en la cabecera y pestañas refleja fielmente el total de entregas pendientes en base de datos. |
| **T6** | Cancelar y confirmar eliminación | Clic en "Eliminar" en una entrega. Probar "Cancelar", luego probar "Confirmar". | "Cancelar" conserva el registro intacto; "Confirmar" lo elimina de IndexedDB y descuenta el contador. |
| **T7** | Cambiar de Offline a Online | Desactivar Offline en DevTools. | El banner cambia a verde `Listo para intentar sincronizar`. No altera falsamente el estado a `SINCRONIZADO` sin API remota. |
| **T8** | Inspeccionar IndexedDB | Abrir DevTools &rarr; Application &rarr; IndexedDB &rarr; `senatiTaskDB` &rarr; `entregas_pendientes`. | Se comprueban los campos: `id`, `tareaId`, `curso`, `tituloTarea`, `comentario`, `fechaRegistro`, `estadoSincronizacion: PENDIENTE`, `intentosSincronizacion`. |

---

## 💡 6. Respuestas a las Preguntas de Reflexión (Sección I)

### 1. ¿Por qué una entrega debe persistir tras recargar el navegador?
> **Respuesta:** En entornos reales de taller o campo, los estudiantes o técnicos sufren interrupciones de red, cierres accidentales de pestañas o recargas de página. Si la entrega se mantuviera únicamente en la memoria RAM del componente Angular, toda la redacción y avance del estudiante se perdería de forma irreversible. Persistir de inmediato en IndexedDB garantiza durabilidad y confiabilidad de los datos (*resiliencia offline*).

### 2. ¿Qué campos relacionan la entrega con su tarea?
> **Respuesta:** El campo clave relacional principal es `tareaId` (identificador numérico único de la tarea asignada). Adicionalmente, se desnormalizan los campos `tituloTarea` y `curso` para permitir una visualización instantánea e histórica del contexto académico en la bandeja local sin necesidad de realizar consultas anidadas o depender de que el catálogo remoto esté disponible en ese instante.

### 3. ¿Qué riesgo hay al reintentar sincronizar varias veces?
> **Respuesta:** El principal riesgo técnico es la **duplicidad de registros** en el servidor de destino (creación múltiple del mismo entregable) o condiciones de carrera si no se maneja idempotencia. Además, reintentar de forma descontrolada sin *backoff exponencial* puede sobrecargar la red y consumir batería en dispositivos móviles. Por ello, la PWA audita los `intentosSincronizacion` y reporta con honestidad los resultados sin repetir peticiones a ciegas.

### 4. ¿Qué validaciones debe repetir el servidor al integrar una API?
> **Respuesta:** Nunca se debe confiar ciegamente en las validaciones del cliente, ya que el código frontend puede ser manipulado o la red interceptada. El servidor debe validar obligatoriamente:
> - Existencia y vigencia de la tarea (`tareaId` existente y fecha límite de entrega no vencida).
> - Autenticación y autorización del estudiante remitente (token JWT / sesión activa).
> - Longitud, sanitización y ausencia de inyecciones maliciosas (XSS / SQLi) en el campo `comentario`.
> - Detección de idempotencia mediante un identificador único (UUID o hash) para no registrar entregas duplicadas tras reintentos del cliente.

---

## 🛡️ 7. Limitaciones Actuales y Futuras Mejoras
- **Sincronización Remota:** El entorno actual no cuenta con un backend empresarial desplegado; la sincronización está simulada de forma controlada y honesta, registrando los intentos en IndexedDB.
- **Background Sync API:** En una siguiente iteración con HTTPS y soporte de navegador, se puede registrar un `SyncManager` en el Service Worker para despachar las entregas en segundo plano tan pronto el dispositivo recupere conexión.
