import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TareaService, Tarea } from './services/tarea.service';
import { StorageService } from './services/storage.service';

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

  listaTareas: Tarea[] = [];
  tareaSeleccionadaId: number | null = null;
  comentarioEntrega: string = '';
  notificacionMensaje: string = '';
  entregasLocales: any[] = [];
  rolUsuario: 'Estudiante' | 'Instructor' = 'Estudiante';

  constructor() {
    window.addEventListener('online', () => {
      this.online = true;
      this.notificacionMensaje = '🟢 Conexión restablecida. Listo para sincronizar con el Campus Virtual.';
      this.cargarEntregasLocales();
    });
    window.addEventListener('offline', () => {
      this.online = false;
      this.notificacionMensaje = '🔴 Modo Fuera de Línea activado. Las entregas se guardarán en IndexedDB.';
    });
  }

  ngOnInit(): void {
    this.cargarTareas();
    this.cargarEntregasLocales();
  }

  cargarTareas(): void {
    this.tareaService.obtenerTareas().subscribe({
      next: (data) => {
        this.listaTareas = data;
        if (data && data.length > 0) {
          this.tareaSeleccionadaId = data[0].id;
        }
      },
      error: (err) => console.error('Error al recuperar tareas:', err)
    });
  }

  async cargarEntregasLocales(): Promise<void> {
    this.entregasLocales = await this.storageService.obtenerEntregasLocales();
  }

  async enviarEntrega(): Promise<void> {
    if (!this.comentarioEntrega.trim()) return;

    const tarea = this.listaTareas.find(t => t.id === Number(this.tareaSeleccionadaId)) || this.listaTareas[0];

    const entregaData = {
      tareaId: this.tareaSeleccionadaId,
      tituloTarea: tarea ? tarea.titulo : 'Tarea General',
      curso: tarea ? tarea.curso : 'Curso SENATI',
      comentario: this.comentarioEntrega,
      usuario: `${this.rolUsuario} SENATI`
    };

    if (this.online) {
      this.notificacionMensaje = '🟢 Entrega enviada exitosamente al servidor del Campus Virtual.';
    } else {
      await this.storageService.guardarEntregaLocal(entregaData);
      this.notificacionMensaje = '🔴 Sin Conexión: Entrega guardada en el dispositivo. Estado: PENDIENTE';
      await this.cargarEntregasLocales();
    }

    this.comentarioEntrega = '';
  }

  toggleRol(): void {
    this.rolUsuario = this.rolUsuario === 'Estudiante' ? 'Instructor' : 'Estudiante';
  }
}
