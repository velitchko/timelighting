import { Component, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import * as d3 from 'd3';
import Graph from '../../types/graph.type';
import Node from '../../types/node.type';
import Edge from '../../types/edge.type';
import { GraphService } from '../../services/graph.service';
import * as _ from 'lodash';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements AfterViewInit {
  private graph: Graph | null;

  private graphWidth: number;
  private graphHeight: number;

  private graphMargin: { top: number, right: number, bottom: number, left: number };

  private timelineWidth: number;
  private timelineHeight: number;

  @ViewChild('graphContainer', { static: true }) graphContainer: ElementRef | null;
  private graphSVG: d3.Selection<SVGSVGElement, unknown, null, any> | null;

  @ViewChild('timelineContainer', { static: true }) timelineContainer: ElementRef | null;
  private timelineSVG: d3.Selection<SVGSVGElement, unknown, null, any> | null;

  private coordinateXScale: d3.ScaleLinear<number, number>;
  private coordinateYScale: d3.ScaleLinear<number, number>;

  private densityXScale: d3.ScaleLinear<number, number>;
  private densityYScale: d3.ScaleLinear<number, number>;

  // continous viridis color scale
  private colorScale: d3.ScaleSequential<string>;

  private timeScale: d3.ScaleLinear<number, number> | null;

  constructor(private graphService: GraphService) {
    this.graph = null;

    this.graphWidth = 0;
    this.graphHeight = 0;

    this.graphMargin = {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20
    };

    this.timelineWidth = 0;
    this.timelineHeight = 0;

    this.graphService.loadData();

    this.graphContainer = null;
    this.graphSVG = null;

    this.timelineContainer = null;
    this.timelineSVG = null;

    this.coordinateXScale = d3.scaleLinear();
    this.coordinateYScale = d3.scaleLinear();

    this.densityXScale = d3.scaleLinear();
    this.densityYScale = d3.scaleLinear();

    this.colorScale = d3.scaleSequential(d3.interpolateViridis);

    this.timeScale = null;
  }

  ngAfterViewInit() {
    this.graphService.getGraph().subscribe((data: Graph) => {
      this.graph = data;

      this.setup();
      this.drawGraph();
      this.drawDensity();
      this.drawTimeline();
    });
  }

  private setup() {
    if (!this.graph) {
      return;
    }
    this.graphSVG = d3.select(this.graphContainer?.nativeElement).append('svg');

    this.graphWidth = this.graphContainer?.nativeElement.offsetWidth;
    this.graphHeight = this.graphContainer?.nativeElement.offsetHeight;

    this.graphSVG
      .attr('width', this.graphWidth - (this.graphMargin.left + this.graphMargin.right))
      .attr('height', this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom))
      .append('g')
      .attr('id', 'graph-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth/2}, ${this.graphHeight/2})
      `);

    this.timelineSVG = d3.select(this.timelineContainer?.nativeElement).append('svg');

    this.timelineWidth = this.timelineContainer?.nativeElement.offsetWidth;
    this.timelineHeight = this.timelineContainer?.nativeElement.offsetHeight;

    this.timelineSVG
      .attr('width', this.timelineWidth)
      .attr('height', this.timelineHeight)
      .append('g').attr('class', 'timeline-wrapper');

    const coords = _.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.coordinates));

    const xExtent = d3.extent(coords, (d: any) => d.x);
    const yExtent = d3.extent(coords, (d: any) => d.y);

    this.coordinateXScale.domain(xExtent as Array<number>).range([
      -(this.graphWidth - (this.graphMargin.left + this.graphMargin.right)) / 2, 
      (this.graphWidth - (this.graphMargin.left + this.graphMargin.right)) / 2
    ]);

    this.coordinateYScale.domain(yExtent as Array<number>).range([
      -(this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom)) / 2, 
      (this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom)) / 2
    ]);

    const densityXExtent = d3.extent([
      -(this.graphWidth - (this.graphMargin.left + this.graphMargin.right)) / 2, 
      (this.graphWidth - (this.graphMargin.left + this.graphMargin.right)) / 2
    ]);

    const densityYExtent = d3.extent([
      -(this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom)) / 2,
      (this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom)) / 2
    ]);

    this.densityXScale.domain(densityXExtent as Array<number>).range([0, this.graphWidth]);
    this.densityYScale.domain(densityYExtent as Array<number>).range([0, this.graphHeight]);

    const timeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.time)));
    
    this.colorScale.domain(timeExtent as Array<number>);
    this.timeScale = d3.scaleLinear().domain(timeExtent as Array<number>).range([
      0 + this.graphMargin.left, 
      this.timelineWidth - this.graphMargin.right
    ]);
  }

  private drawGraph() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawGraph(), 1000);
      return;
    };

    // zip time and coordinates
    let zipped = new Array<{
      time: number,
      coordinates: { x: number, y: number }
      id: string | number,
      label: string
    }>();

    this.graph.nodes.forEach((node: Node) => {
      const zip = _.zip(node.time, node.coordinates);
      zip.forEach((z: any) => {
        zipped.push({
          time: z[0],
          coordinates: z[1],
          id: node.id,
          label: node.label
        });
      });
    });

    // draw nodes
    this.graphSVG?.select('#graph-wrapper')
      .append('g')
      .attr('id', 'nodes-wrapper')
      .selectAll('circle')
      .data(zipped)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', (d: {
        time: number,
        coordinates: { x: number, y: number }
        id: string | number,
        label: string
      }) => this.coordinateXScale(d.coordinates.x))
      .attr('cy', (d: {
        time: number,
        coordinates: { x: number, y: number }
        id: string | number,
        label: string
      }) => this.coordinateYScale(d.coordinates.y))
      .attr('r', 5)
      .attr('fill', (d: {
        time: number,
        coordinates: { x: number, y: number },
        id: string | number,
        label: string
      }) => d3.interpolateRainbow(d.time));


    // draw labels
    this.graphSVG?.select('#graph-wrapper')
      .append('g')
      .attr('id', 'labels-wrapper')
      .selectAll('text')
      .data(zipped)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .text((d: {
        time: number,
        coordinates: { x: number, y: number },
        id: string | number,
        label: string
      }) => d.label)
      .attr('x', (d: {
        time: number,
        coordinates: { x: number, y: number },
        id: string | number,
        label: string
      }) => this.coordinateXScale(d.coordinates.x))
      .attr('y', (d: {
        time: number,
        coordinates: { x: number, y: number },
        id: string | number,
        label: string
      }) => this.coordinateYScale(d.coordinates.y));
  }

  private drawDensity() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawGraph(), 1000);
      return;
    };

    // zip time and coordinates
    let zipped = new Array<{
      time: number,
      coordinates: { x: number, y: number }
      id: string | number,
      label: string
    }>();

    this.graph.nodes.forEach((node: Node) => {
      const zip = _.zip(node.time, node.coordinates);
      zip.forEach((z: any) => {
        zipped.push({
          time: z[0],
          coordinates: z[1],
          id: node.id,
          label: node.label
        });
      });
    });

    const densityData = d3.contourDensity()
      .x((d: any) => this.coordinateXScale(d.x)) // FIXME: scales need to be reworked according to size
      .y((d: any) => this.coordinateYScale(d.y))
      .size([ // FIXME: size cannot have negative values
        this.graphWidth, 
        this.graphHeight
      ])
      .bandwidth(20)
      (zipped.map((z: any) => z.coordinates))

    console.log(densityData);

    // draw density
    this.graphSVG?.select('#graph-wrapper')
      .append('g')
      .attr('id', 'densities-wrapper')
      .selectAll('path')
      .data(densityData)
      .enter()
      .append('path')
      .attr('class', 'density')
      .attr('d', d3.geoPath())
      .attr('fill', (d: any) => this.colorScale(d.value*10000));
  }

  private drawTimeline() {
    this.timelineSVG?.select('.timeline-wrapper');
  }
}
