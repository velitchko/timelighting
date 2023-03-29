import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import Graph from '../types/graph.type';

@Injectable({
  providedIn: 'root'
})
export class GraphService {

  constructor() { }

  public getGraph(): Observable<Graph> {
    return of({} as Graph);
  }
}
