import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { StorageService } from './services/storage.service';
import { TareaService } from './services/tarea.service';
import { of } from 'rxjs';

describe('AppComponent - SENATI TaskHub PWA', () => {
  let mockStorageService: jasmine.SpyObj<StorageService>;
  let mockTareaService: jasmine.SpyObj<TareaService>;

  const tareasPrueba = [
    {
      id: 101,
      curso: 'Desarrollo de Software PWA',
      titulo: 'Entregable 01: Service Worker',
      instructor: 'Ing. Jorge Luque',
      fechaEntrega: '2026-10-20',
      estado: 'Pendiente'
    },
    {
      id: 102,
      curso: 'Base de Datos Avanzada',
      titulo: 'Laboratorio 03: PostgreSQL',
      instructor: 'Ing. Carlos Mendoza',
      fechaEntrega: '2026-10-22',
      estado: 'Completado'
    }
  ];

  beforeEach(async () => {
    mockStorageService = jasmine.createSpyObj('StorageService', [
      'abrirDB',
      'guardarEntregaLocal',
      'listarEntregas',
      'obtenerEntrega',
      'eliminarEntrega',
      'contarPendientes',
      'actualizarEstado'
    ]);

    mockStorageService.listarEntregas.and.returnValue(Promise.resolve([]));
    mockStorageService.contarPendientes.and.returnValue(Promise.resolve(0));

    mockTareaService = jasmine.createSpyObj('TareaService', ['obtenerTareas']);
    mockTareaService.obtenerTareas.and.returnValue(of(tareasPrueba));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: mockStorageService },
        { provide: TareaService, useValue: mockTareaService }
      ]
    }).compileComponents();
  });

  it('debe instanciar el componente principal', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('TH-01: debe filtrar por título y curso de forma combinable', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.listaTareas = [...tareasPrueba];

    // Búsqueda por título
    app.busquedaTitulo = 'service';
    app.cursoFiltro = '';
    app.aplicarFiltros();
    expect(app.tareasFiltradas.length).toBe(1);
    expect(app.tareasFiltradas[0].id).toBe(101);

    // Búsqueda combinada
    app.busquedaTitulo = 'postgresql';
    app.cursoFiltro = 'Base de Datos Avanzada';
    app.aplicarFiltros();
    expect(app.tareasFiltradas.length).toBe(1);
    expect(app.tareasFiltradas[0].id).toBe(102);

    // Filtro sin coincidencias
    app.cursoFiltro = 'Desarrollo de Software PWA';
    app.aplicarFiltros();
    expect(app.tareasFiltradas.length).toBe(0);

    // Limpiar filtros
    app.limpiarFiltros();
    expect(app.tareasFiltradas.length).toBe(2);
  });

  it('TH-02: debe rechazar formularios sin tarea o con comentario vacío', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.listaTareas = [...tareasPrueba];

    // Sin tarea seleccionada
    app.tareaSeleccionadaId = null;
    app.comentarioEntrega = 'Comentario válido';
    expect(app.validarFormulario()).toBeFalse();
    expect(app.erroresValidacion.tarea).toBeDefined();

    // Con tarea pero comentario vacío o solo espacios
    app.tareaSeleccionadaId = 101;
    app.comentarioEntrega = '    ';
    expect(app.validarFormulario()).toBeFalse();
    expect(app.erroresValidacion.comentario).toBeDefined();

    // Formulario válido
    app.comentarioEntrega = 'Avance del laboratorio completado';
    expect(app.validarFormulario()).toBeTrue();
    expect(app.erroresValidacion.comentario).toBeUndefined();
  });

  it('TH-07: cancelar eliminación debe conservar el registro', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    const entregaMock = {
      id: 1,
      tareaId: 101,
      curso: 'PWA',
      tituloTarea: 'Tarea 1',
      comentario: 'Test',
      fechaRegistro: new Date().toISOString(),
      estadoSincronizacion: 'PENDIENTE' as const,
      intentosSincronizacion: 0
    };

    app.solicitarEliminar(entregaMock);
    expect(app.entregaParaEliminar).toEqual(entregaMock);

    app.cancelarEliminacion();
    expect(app.entregaParaEliminar).toBeNull();
    expect(mockStorageService.eliminarEntrega).not.toHaveBeenCalled();
  });
});
