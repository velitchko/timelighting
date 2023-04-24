import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import Graph from '../types/graph.type';
import Node from '../types/node.type';
import { DATASETS } from './datasets';
import Edge from 'app/types/edge.type';

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

    this.graph.nodes.forEach((node: Node) => {
      // calculate difference between first and last time
      node.age = node.time[node.time.length - 1] - node.time[0];

      // calculate differences between each times and add to array
      if (node.ages) {
        for (let i = 0; i < node.time.length - 1; i++) {
          node.ages.push(node.time[i + 1] - node.time[0]);
        }
      }
    });

    // parse edges
    data.graphedges.forEach((edge: any) => {
      const source = this.graph.nodes.find((node: Node) => node.id === edge.source);
      const target = this.graph.nodes.find((node: Node) => node.id === edge.target);

      if(!source || !target) return;

      const newEdge: Edge = {
        id: edge.id,
        source: source,
        target: target,
        time: []
      };

      // iterate over each edges position array
      edge.presence.forEach((presence: any) => {

        // remove brackets and split on comma
        const parsedPresence = presence.string.replace(/[\])}[{(]/g, '');

        const parts = parsedPresence.split(':');

        const times = parts[0].split(',');

        newEdge.time.push(+times[0]);
        newEdge.time.push(+times[1]);
      });

      this.graph.edges.push(newEdge);
    });
  }

  // return graph as observable
  public getGraph(): Observable<Graph> {
    return of(this.graph);
  }
}
