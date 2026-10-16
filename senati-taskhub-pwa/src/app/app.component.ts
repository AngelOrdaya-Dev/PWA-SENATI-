import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TareaService } from './services/tarea.service';
import { StorageService } from './services/storage.service';
import { Tarea, EntregaLocal, EstadoSincronizacion } from './models/entrega.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  online: boolean = navigator.onLine;

  private tareaService = inject(TareaService);
  private storageService = inject(StorageService);

  // Pantallas según la maqueta de la página 10 del PDF:
  // 1: login, 2: panel, 3: detalle, 4: entrega, 5: offline
  pantallaActual: 'login' | 'panel' | 'detalle' | 'entrega' | 'offline' = 'panel';

  // Catálogo y filtros (TH-01)
  listaTareas: Tarea[] = [];
  tareasFiltradas: Tarea[] = [];
  cursosDisponibles: string[] = [];
  busquedaTitulo: string = '';
  cursoFiltro: string = '';

  // Tarea en visualización / selección
  tareaSeleccionada: Tarea | null = null;
  tareaSeleccionadaId: number | null = null;

  // Formulario de entrega (TH-02)
  comentarioEntrega: string = '';
  archivoSeleccionadoNombre: string = 'Avance_Proyecto_PWA.zip';
  erroresValidacion: { tarea?: string; comentario?: string } = {};

  // Bandeja de entregas persistida e IndexedDB (TH-03, TH-04, TH-05)
  entregasLocales: EntregaLocal[] = [];
  contadorPendientes: number = 0;
  contadorCompletadas: number = 3;

  // Notificaciones y sincronización
  notificacionMensaje: string = '';
  notificacionTipo: 'info' | 'success' | 'warning' | 'error' = 'info';
  sincronizando: boolean = false;

  // Modales
  entregaParaEliminar: EntregaLocal | null = null;
  entregaSeleccionadaDetalle: EntregaLocal | null = null;

  constructor() {
    window.addEventListener('online', () => {
      this.online = true;
      this.mostrarMensaje(
        '🟢 Conexión restablecida. Listo para intentar sincronizar con el Campus Virtual.',
        'info'
      );
      this.cargarEntregasLocales();
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this.mostrarMensaje(
        '🔴 Modo Fuera de Línea activado. Las entregas se guardarán localmente en IndexedDB.',
        'warning'
      );
    });
  }

  async ngOnInit(): Promise<void> {
    this.cargarTareas();
    await this.cargarEntregasLocales();
  }

  cargarTareas(): void {
    this.tareaService.obtenerTareas().subscribe({
      next: (data) => {
        this.listaTareas = data;
        this.cursosDisponibles = Array.from(new Set(data.map(t => t.curso))).sort();
        this.aplicarFiltros();

        if (data.length > 0 && !this.tareaSeleccionada) {
          this.tareaSeleccionada = data[0];
          this.tareaSeleccionadaId = data[0].id;
        }
      },
      error: (err) => {
        console.error('Error al recuperar tareas:', err);
        this.mostrarMensaje('Error al cargar catálogo de tareas.', 'error');
      }
    });
  }

  /**
   * TH-01: Búsqueda y categoría/curso combinables.
   */
  aplicarFiltros(): void {
    const busq = this.busquedaTitulo.trim().toLowerCase();
    const curso = this.cursoFiltro.trim();

    this.tareasFiltradas = this.listaTareas.filter((tarea) => {
      const coincideTitulo = !busq || tarea.titulo.toLowerCase().includes(busq);
      const coincideCurso = !curso || tarea.curso === curso;
      return coincideTitulo && coincideCurso;
    });
  }

  limpiarFiltros(): void {
    this.busquedaTitulo = '';
    this.cursoFiltro = '';
    this.aplicarFiltros();
  }

  navegarA(pantalla: 'login' | 'panel' | 'detalle' | 'entrega' | 'offline'): void {
    this.pantallaActual = pantalla;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  verDetalleTarea(tarea: Tarea): void {
    this.tareaSeleccionada = tarea;
    this.tareaSeleccionadaId = tarea.id;
    this.navegarA('detalle');
  }

  iniciarEntregaDeTarea(tarea?: Tarea): void {
    if (tarea) {
      this.tareaSeleccionada = tarea;
      this.tareaSeleccionadaId = tarea.id;
    } else if (!this.tareaSeleccionada && this.listaTareas.length > 0) {
      this.tareaSeleccionada = this.listaTareas[0];
      this.tareaSeleccionadaId = this.listaTareas[0].id;
    }
    this.navegarA('entrega');
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.archivoSeleccionadoNombre = file.name;
    }
  }

  /**
   * TH-02: Validación obligatoria de tarea y comentario.
   */
  validarFormulario(): boolean {
    this.erroresValidacion = {};
    let esValido = true;

    if (!this.tareaSeleccionadaId) {
      this.erroresValidacion.tarea = 'Debe seleccionar una tarea válida.';
      esValido = false;
    }

    if (!this.comentarioEntrega || !this.comentarioEntrega.trim()) {
      this.erroresValidacion.comentario = 'El comentario de entrega es obligatorio y no puede estar vacío.';
      esValido = false;
    }

    if (!esValido) {
      this.mostrarMensaje('⚠️ Complete los campos requeridos antes de guardar.', 'warning');
    }

    return esValido;
  }

  /**
   * TH-03, TH-04, TH-06, TH-08: Guardado en IndexedDB con estado PENDIENTE.
   */
  async enviarEntrega(): Promise<void> {
    if (!this.validarFormulario()) {
      return;
    }

    const tarea = this.tareaSeleccionada || this.listaTareas.find(t => t.id === Number(this.tareaSeleccionadaId));
    if (!tarea) return;

    const datosEntrega = {
      tareaId: tarea.id,
      curso: tarea.curso,
      tituloTarea: tarea.titulo,
      comentario: this.comentarioEntrega.trim(),
      archivoNombre: this.archivoSeleccionadoNombre
    };

    try {
      const entregaGuardada = await this.storageService.guardarEntregaLocal(datosEntrega);

      this.comentarioEntrega = '';
      this.erroresValidacion = {};
      await this.cargarEntregasLocales();

      // Mensaje de éxito honesto según estado de red
      if (this.online) {
        this.mostrarMensaje(
          `💾 Entrega #${entregaGuardada.id} guardada en el dispositivo en IndexedDB. Estado: PENDIENTE. Con conexión: listo para intentar sincronizar.`,
          'success'
        );
      } else {
        this.mostrarMensaje(
          `💾 Modo Fuera de Línea: Entrega #${entregaGuardada.id} guardada con persistencia en IndexedDB. Estado: PENDIENTE.`,
          'info'
        );
      }

      // Redirigir a la pantalla 5 (Modo offline / Entregas guardadas) para ver el resultado como en la imagen
      this.navegarA('offline');
    } catch (err: any) {
      console.error('Error al guardar en IndexedDB:', err);
      this.mostrarMensaje(`❌ Error en IndexedDB: ${err?.message}`, 'error');
    }
  }

  async cargarEntregasLocales(): Promise<void> {
    try {
      this.entregasLocales = await this.storageService.listarEntregas();
      this.contadorPendientes = await this.storageService.contarPendientes();
    } catch (err) {
      console.error('Error al consultar entregas:', err);
    }
  }

  /**
   * TH-07: Eliminación confirmada.
   */
  solicitarEliminar(entrega: EntregaLocal, event?: Event): void {
    if (event) event.stopPropagation();
    this.entregaParaEliminar = entrega;
  }

  cancelarEliminacion(): void {
    this.entregaParaEliminar = null;
    this.mostrarMensaje('Operación de eliminación cancelada. El registro se conserva.', 'info');
  }

  async confirmarEliminacion(): Promise<void> {
    if (!this.entregaParaEliminar || !this.entregaParaEliminar.id) return;
    const id = this.entregaParaEliminar.id;
    try {
      await this.storageService.eliminarEntrega(id);
      this.entregaParaEliminar = null;
      await this.cargarEntregasLocales();
      this.mostrarMensaje(`🗑️ Entrega #${id} eliminada de IndexedDB.`, 'success');
    } catch (err: any) {
      this.mostrarMensaje(`❌ Error al eliminar: ${err?.message}`, 'error');
    }
  }

  /**
   * Consulta detalle de entrega
   */
  async abrirDetalle(id: number | undefined): Promise<void> {
    if (!id) return;
    try {
      const entrega = await this.storageService.obtenerEntrega(id);
      if (entrega) {
        this.entregaSeleccionadaDetalle = entrega;
      }
    } catch (err: any) {
      this.mostrarMensaje(`Error al obtener detalle: ${err?.message}`, 'error');
    }
  }

  cerrarDetalle(): void {
    this.entregaSeleccionadaDetalle = null;
  }

  /**
   * TH-06: Reintento controlado de sincronización.
   */
  async reintentarSincronizacion(): Promise<void> {
    if (!this.online) {
      this.mostrarMensaje('🔴 Sin conexión a Internet: No se puede intentar sincronizar.', 'warning');
      return;
    }

    if (this.contadorPendientes === 0) {
      this.mostrarMensaje('ℹ️ No hay entregas pendientes por sincronizar.', 'info');
      return;
    }

    this.sincronizando = true;
    this.mostrarMensaje('🔄 Contactando servidor del Campus Virtual...', 'info');

    setTimeout(async () => {
      this.sincronizando = false;
      const pendientes = this.entregasLocales.filter(e => e.estadoSincronizacion === 'PENDIENTE');

      for (const ent of pendientes) {
        if (ent.id) {
          await this.storageService.actualizarEstado(
            ent.id,
            'PENDIENTE',
            'Endpoint /api/entregas no configurado en entorno local.'
          );
        }
      }

      await this.cargarEntregasLocales();
      this.mostrarMensaje(
        `⚠️ Sincronización reintentada para ${pendientes.length} entrega(s). Control honesto: Sin API remota disponible, el estado se conserva en PENDIENTE.`,
        'warning'
      );
    }, 1200);
  }

  mostrarMensaje(msg: string, tipo: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.notificacionMensaje = msg;
    this.notificacionTipo = tipo;
  }
}
