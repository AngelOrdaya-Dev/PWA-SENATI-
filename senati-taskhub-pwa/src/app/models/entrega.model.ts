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
  archivoNombre?: string;
}

export interface Tarea {
  id: number;
  curso: string;
  titulo: string;
  instructor: string;
  fechaEntrega: string;
  estado: string;
  descripcion?: string;
  adjunto?: string;
}
