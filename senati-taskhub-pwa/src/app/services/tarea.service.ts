import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Tarea {
  id: number;
  curso: string;
  titulo: string;
  instructor: string;
  fechaEntrega: string;
  estado: string;
}

@Injectable({
  providedIn: 'root'
})
export class TareaService {
  private http = inject(HttpClient);
  private url = '/assets/data/tareas.json';

  obtenerTareas(): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(this.url);
  }
}
