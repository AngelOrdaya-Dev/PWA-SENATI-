import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tarea } from '../models/entrega.model';

@Injectable({
  providedIn: 'root'
})
export class TareaService {
  private http = inject(HttpClient);
  private url = 'assets/data/tareas.json';

  obtenerTareas(): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(this.url);
  }
}
