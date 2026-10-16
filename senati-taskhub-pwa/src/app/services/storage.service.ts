import { Injectable } from '@angular/core';
import { EntregaLocal, EstadoSincronizacion } from '../models/entrega.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private dbName = 'senatiTaskDB';
  private dbVersion = 1;
  private storeName = 'entregas_pendientes';

  async abrirDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB no es compatible con este navegador.'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('estadoSincronizacion', 'estadoSincronizacion', { unique: false });
          store.createIndex('tareaId', 'tareaId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Error al abrir IndexedDB: ${request.error?.message}`));
    });
  }

  /**
   * Guarda una entrega local con fecha y estado inicial PENDIENTE (Regla TH-04).
   */
  async guardarEntregaLocal(
    datos: Omit<EntregaLocal, 'id' | 'fechaRegistro' | 'estadoSincronizacion' | 'intentosSincronizacion'>
  ): Promise<EntregaLocal> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const nuevaEntrega: Omit<EntregaLocal, 'id'> = {
          tareaId: datos.tareaId,
          curso: datos.curso,
          tituloTarea: datos.tituloTarea,
          comentario: datos.comentario,
          fechaRegistro: new Date().toISOString(),
          estadoSincronizacion: 'PENDIENTE',
          intentosSincronizacion: 0,
          ultimoError: undefined
        };

        const request = store.add(nuevaEntrega);

        request.onsuccess = () => {
          const id = request.result as number;
          resolve({ id, ...nuevaEntrega });
        };

        request.onerror = () => {
          reject(new Error(`No se pudo guardar la entrega: ${request.error?.message}`));
        };

        transaction.onerror = () => {
          reject(new Error(`Transacción fallida en IndexedDB: ${transaction.error?.message}`));
        };
      } catch (err: any) {
        reject(new Error(`Excepción en almacenamiento local: ${err?.message || err}`));
      }
    });
  }

  /**
   * Devuelve todas las entregas para la bandeja (Regla TH-03).
   */
  async listarEntregas(): Promise<EntregaLocal[]> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const resultado = (request.result as EntregaLocal[]) || [];
          // Orden descendente por id o fecha
          resultado.sort((a, b) => (b.id || 0) - (a.id || 0));
          resolve(resultado);
        };

        request.onerror = () => {
          reject(new Error(`Error al consultar entregas: ${request.error?.message}`));
        };

        transaction.onerror = () => {
          reject(new Error(`Error en transacción de lectura: ${transaction.error?.message}`));
        };
      } catch (err: any) {
        reject(new Error(`Excepción al listar entregas: ${err?.message || err}`));
      }
    });
  }

  /**
   * Consulta el detalle de una entrega específica por su ID.
   */
  async obtenerEntrega(id: number): Promise<EntregaLocal | undefined> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result as EntregaLocal | undefined);
        };

        request.onerror = () => {
          reject(new Error(`Error al obtener entrega #${id}: ${request.error?.message}`));
        };

        transaction.onerror = () => {
          reject(new Error(`Transacción de búsqueda fallida: ${transaction.error?.message}`));
        };
      } catch (err: any) {
        reject(new Error(`Excepción al obtener entrega: ${err?.message || err}`));
      }
    });
  }

  /**
   * Elimina un registro de entrega tras confirmación (Regla TH-07).
   */
  async eliminarEntrega(id: number): Promise<void> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(new Error(`Error al eliminar entrega #${id}: ${request.error?.message}`));
        };

        transaction.onerror = () => {
          reject(new Error(`Transacción de eliminación fallida: ${transaction.error?.message}`));
        };
      } catch (err: any) {
        reject(new Error(`Excepción al eliminar entrega: ${err?.message || err}`));
      }
    });
  }

  /**
   * Cuenta los registros en estado PENDIENTE directamente de la persistencia (Regla TH-05).
   */
  async contarPendientes(): Promise<number> {
    try {
      const entregas = await this.listarEntregas();
      return entregas.filter(e => e.estadoSincronizacion === 'PENDIENTE').length;
    } catch (e) {
      console.error('Error al contar pendientes en IndexedDB:', e);
      return 0;
    }
  }

  /**
   * Actualiza el estado y metadatos de sincronización tras un intento real.
   */
  async actualizarEstado(
    id: number,
    nuevoEstado: EstadoSincronizacion,
    ultimoError?: string
  ): Promise<void> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const item: EntregaLocal = getRequest.result;
          if (!item) {
            reject(new Error(`Entrega #${id} no encontrada para actualizar.`));
            return;
          }

          item.estadoSincronizacion = nuevoEstado;
          item.intentosSincronizacion = (item.intentosSincronizacion || 0) + 1;
          if (ultimoError !== undefined) {
            item.ultimoError = ultimoError;
          }

          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error(`Error al actualizar estado: ${putRequest.error?.message}`));
        };

        getRequest.onerror = () => {
          reject(new Error(`Error al leer entrega para actualización: ${getRequest.error?.message}`));
        };

        transaction.onerror = () => {
          reject(new Error(`Transacción de actualización fallida: ${transaction.error?.message}`));
        };
      } catch (err: any) {
        reject(new Error(`Excepción al actualizar estado: ${err?.message || err}`));
      }
    });
  }
}
