import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import Graph from '../types/graph.type';
import Node from '../types/node.type';
import { DATASETS } from './datasets';

@Injectable({
  providedIn: 'root'
})
export class GraphService {

  private graph: Graph;

  constructor() { 
    this.graph = {
      nodes: [],
      edges: []
    };
  }

  // load data from json file
  public loadData(dataset?: string): void {
    const data = DATASETS[dataset ? dataset : 'vandebunte'];
    this.parseData(data);
  }

  // parse data from json file
  private parseData(data: any): void {
    // iterate over nodes
    data.graphnodes.forEach((node: any) => {
      // iterate over each nodes position array
      const id = node.id;

      node.position.forEach((position: any) => {

        // remove brackets and split on comma
        const parsedPosition = position.string.replace(/[\])}[{(]/g, '');

        const parts = parsedPosition.split(':');
        
        const times = parts[0].split(',');
        const coords = parts[1].split(',');

        // check if node already exists
        const found = this.graph.nodes.find((node: Node) => node.id === id);

        // if node exists, add coordinates and time
        if (found) {
          found.coordinates.push({ x: +coords[0], y: +coords[1] });
          found.coordinates.push({ x: +coords[2], y: +coords[3] });

          found.time.push(+times[0]);
          found.time.push(+times[1]);

          // calculate difference between first and last time
          found.age = found.time[found.time.length - 1] - found.time[0];

          // calculate differences between each times and add to array
          if (!found.ages) found.ages = [];

          for (let i = 0; i < found.time.length - 1; i++) {
            found.ages.push(found.time[i + 1] - found.time[0]);
          }
        } 
        // else create new node
        else {
          const newNode: Node = {
            id: id,
            label: `node-${node.id}`,
            time: [+times[0], +times[1]],
            coordinates: [{ x: +coords[0], y: +coords[1] }, { x: +coords[2], y: +coords[3] }],
            age: 0,
            ages: [0]
          };
          this.graph.nodes.push(newNode);
        }
      });
    });
  }

  // return graph as observable
  public getGraph(): Observable<Graph> {
    return of(this.graph);
  }
}
