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

  private timeScale: d3.ScaleLinear<number, number>;

  private absoluteAgeScale: d3.ScaleLinear<number, number>;
  private relativeAgeScale: d3.ScaleLinear<number, number>;

  private showNodes: boolean = true;
  private showDensities: boolean = true;
  private showLabels: boolean = true;

  constructor(private graphService: GraphService, private route: ActivatedRoute) {
    
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
    
    // get parameter from url
    this.route.queryParams
    .subscribe((params: Params) => {
      params['graph'] ? this.graphService.loadData(params['graph']) : this.graphService.loadData();
    });

    this.graphContainer = null;
    this.graphSVG = null;

    this.timelineContainer = null;
    this.timelineSVG = null;

    this.coordinateXScale = d3.scaleLinear();
    this.coordinateYScale = d3.scaleLinear();

    this.densityXScale = d3.scaleLinear();
    this.densityYScale = d3.scaleLinear();

    this.colorScale = d3.scaleSequential(d3.interpolateViridis);

    this.timeScale = d3.scaleLinear();

    this.absoluteAgeScale = d3.scaleLinear();
    this.relativeAgeScale = d3.scaleLinear();
  }

  ngAfterViewInit() {
    this.graphService.getGraph().subscribe((data: Graph) => {
      this.graph = data;

      this.setup();
      this.drawDensity();
      this.drawGraph();
      this.drawTimeline();
    });
  }

  private toggleVisibility(group: string, show: boolean) {
    d3.select(`#${group}`)
      .attr('display', show ? 'block' : 'none');
  }

  public toggleGroup(group: string) {
    // toggle svg group visibility based on passed string
    switch(group) {
      case 'nodes':
        this.showNodes = !this.showNodes;
        this.toggleVisibility('nodes-wrapper', this.showNodes);
        break;
      case 'densities':
        this.showDensities = !this.showDensities;
        this.toggleVisibility('densities-wrapper', this.showDensities);
        break;
      case 'labels': 
        this.showLabels = !this.showLabels;
        this.toggleVisibility('labels-wrapper', this.showLabels);
        break;
    }
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

    this.densityXScale.domain(xExtent as Array<number>).range([0, (this.graphWidth - (this.graphMargin.left + this.graphMargin.right))]);
    this.densityYScale.domain(yExtent as Array<number>).range([0, (this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom))]);

    const timeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.time)));
    
    this.colorScale.domain(timeExtent as Array<number>);

    this.timeScale = d3.scaleLinear().domain(timeExtent as Array<number>).range([
      0 + this.graphMargin.left, 
      this.timelineWidth - this.graphMargin.right
    ]);

    const absoluteAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.age ? node.age : 0)));

    this.absoluteAgeScale = d3.scaleLinear().domain(absoluteAgeExtent as Array<number>).range([0.1, 1]);

    const relativeAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.ages ? node.ages : 0)));
  
    this.relativeAgeScale = d3.scaleLinear().domain(relativeAgeExtent as Array<number>).range([0.1, 1]);
  }

  private drawGraph() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawGraph(), 1000);
      return;
    };

    // zip time and coordinates
      // zip time and coordinates
      const zipped = new Array<{ id: string | number, x: number, y: number, time: number, age: number }>();
      this.graph.nodes.forEach((node: Node) => {
    
        node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
          zipped.push({
            id: node.id,
            x: coordinate.x,
            y: coordinate.y,
            time: node.time[index],
            age: node.ages ? node.ages[index] : 0
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
      .attr('cx', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateXScale(d.x))
      .attr('cy', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateYScale(d.y))
      .attr('r', 8)
      .attr('fill', 'gray')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', (d: { id: string | number, x: number, y: number, time: number, age: number }) => {
        return this.relativeAgeScale(d.age);
      })
      .attr('opacity', (d: { id: string | number, x: number, y: number, time: number, age: number }) => {
        return this.relativeAgeScale(d.age);
      });
      // .attr('fill', (d: {
      //   time: number,
      //   coordinates: { x: number, y: number },
      //   id: string | number,
      //   label: string
      // }) => d3.interpolateRainbow(d.time));


    // draw labels
    this.graphSVG?.select('#graph-wrapper')
      .append('g')
      .attr('id', 'labels-wrapper')
      .selectAll('text')
      .data(zipped)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .text((d: { id: string | number, x: number, y: number, time: number, age: number }) => `node-${d.id}`)
      .attr('x', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateXScale(d.x))
      .attr('y', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateYScale(d.y));
  }

  private drawDensity() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawGraph(), 1000);
      return;
    };

    // zip time and coordinates
    const zipped = new Array<{ id: string | number, x: number, y: number, time: number, age: number }>();
    this.graph.nodes.forEach((node: Node) => {
  
      node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
        zipped.push({
          id: node.id,
          x: coordinate.x,
          y: coordinate.y,
          time: node.time[index],
          age: node.ages ? node.ages[index] : 0
        });
      });
    });

    const densityData = d3.contourDensity<{ id: string | number, x: number, y: number, time: number, age: number }>()
      .x((d: { id: string | number, x: number, y: number, time: number, age: number }) => this.densityXScale(d.x))
      .y((d: { id: string | number, x: number, y: number, time: number, age: number }) => this.densityYScale(d.y))
      .size([
        (this.graphWidth - (this.graphMargin.left + this.graphMargin.right)), 
        (this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom))
      ])
      .bandwidth(20)
      .weight((d: { id: string | number, x: number, y: number, time: number, age: number }) => {
        return this.relativeAgeScale(d.age); 
        // return 1;
      })
      (zipped);

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
      .attr('fill', (d: any) => this.colorScale(d.value*10000))
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 1)
      .attr('opacity', (d: any) => {
        // return 1;
        return d.value*1000;
      })
      .attr('transform', `translate
        (
          ${-1*(this.graphWidth - (this.graphMargin.left + this.graphMargin.right))/2}, 
          ${-1*(this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom))/2}
        )
      `);
  }

  // TODO: implement this
  private drawTimeline() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawGraph(), 1000);
      return;
    };

    // get node intervals and sort them
    const intervals = new Array<{ id: string | number, start: number, end: number }>();
    this.graph.nodes.forEach((node: Node) => {

      node.time.forEach((time: number, index: number) => {
        if(index === node.time.length - 1) return;

        intervals.push({
          id: node.id,
          start: time,
          end: node.time[index + 1]
        })
      });
    });

    console.log(this.graph.nodes);
    console.log(intervals);

    let yCoordMap = new Map<string | number, number>();
    let yCounter = 0;
    this.timelineSVG?.select('.timeline-wrapper')
      .append('g')
      .attr('id', 'intervals-wrapper')
      .selectAll('rect')
      .data(intervals)
      .enter()
      .append('rect')
      .attr('class', 'interval')
      .attr('x', (d: { id: string | number, start: number, end: number }) => this.timeScale(d.start))
      .attr('y', (d: { id: string | number, start: number, end: number }) => {
        if(!yCoordMap.has(d.id)) {
          yCoordMap.set(d.id, yCounter);
          yCounter += 5;
        }

        return yCoordMap.get(d.id) || 0;
      })
      .attr('width', (d: { id: string | number, start: number, end: number }) => this.timeScale(d.end) - this.timeScale(d.start))
      .attr('height', 4)
      .attr('fill', () => {
        // return random hex color
        return '#' + Math.floor(Math.random()*16777215).toString(16);
      })
      .attr('opacity', 0.5);

      console.log(yCoordMap);
  }
}
