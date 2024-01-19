import { Component, ViewChild, AfterContentInit, ElementRef, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import * as d3 from 'd3';
import Graph from '../../types/graph.type';
import Node from '../../types/node.type';
import Edge from '../../types/edge.type';
import Trajectory from '../../types/trajectories';
import { GraphService } from '../../services/graph.service';
import { DATASETS } from '../../services/datasets';
import * as _ from 'lodash';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterContentInit {
  private graph: Graph | null;
  private originalGraph: Graph | null;

  private graphWidth: number;
  private graphHeight: number;

  private graphMargin: { top: number, right: number, bottom: number, left: number };

  private timelineWidth: number;
  private timelineHeight: number;

  @ViewChild('graphContainer', { static: true }) graphContainer: ElementRef | null;
  private graphSVG: d3.Selection<SVGSVGElement, unknown, null, any> | null;

  @ViewChild('timelineContainer', { static: true }) timelineContainer: ElementRef | null;
  private timelineSVG: d3.Selection<SVGSVGElement, unknown, null, any> | null;

  @ViewChild('colorScaleContainer', { static: true }) colorScaleContainer: ElementRef | null;
  private colorScaleSVG: d3.Selection<SVGSVGElement, unknown, null, any> | null;

  protected datasets: Array<{ src: string, label: string, displayName: string }> = [];

  private coordinateXScale: d3.ScaleLinear<number, number>;
  private coordinateYScale: d3.ScaleLinear<number, number>;

  private densityXScale: d3.ScaleLinear<number, number>;
  private densityYScale: d3.ScaleLinear<number, number>;

  private areaChartXScale: d3.ScaleLinear<number, number>;
  private areaChartYScale: d3.ScaleLinear<number, number>;
  public movementScale: d3.ScaleLinear<number, number>;

  // continous viridis color scale
  private colorScale: d3.ScaleSequential<string>;
  private distanceColorScale: d3.ScaleSequential<string>;


  private timeScale: d3.ScaleLinear<number, number>;

  private absoluteAgeScale: d3.ScaleLinear<number, number>;
  private relativeAgeScale: d3.ScaleLinear<number, number>;

  private colorScaleNodes = d3.scaleOrdinal(d3.schemeCategory10);

  private timeBrush: d3.BrushBehavior<unknown>;
  private timeXAxis: d3.Axis<number | { valueOf(): number; }>;

  private graphZoom: d3.ZoomBehavior<SVGSVGElement, unknown>;

  protected showNodes: boolean = true;
  protected showDensities: boolean = true;
  protected showLabels: boolean = true;
  protected showTrajectories: boolean = true;
  protected showSidebar: boolean = false;
  protected selectedNodeIds: Array<string> = [];
  protected nodeIds: Array<{ id: string, checked: boolean, distance: number }> = [];
  protected resampleFrequency: number = 10;
  protected bandwidth: number = 20;
  protected colorNodesByDistance: boolean = false;
  protected showDropdown: boolean = false;

  private start: number | undefined;
  private end: number | undefined;
  private originalStart: number = 0;
  private originalEnd: number = 0;
  private distances: Array<{ id: string, distance: number }> = [];
  private trajectories: Array<Trajectory> = [];
  private initGuidance: boolean = true;

  constructor(private graphService: GraphService, private cdref: ChangeDetectorRef) {

    this.graph = null;
    this.originalGraph = null;

    this.datasets = Object.keys(DATASETS).map(key => DATASETS[key]);

    this.graphWidth = 0;
    this.graphHeight = 0;

    this.graphMargin = {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10
    };

    this.timelineWidth = 0;
    this.timelineHeight = 0;

    this.graphContainer = null;
    this.graphSVG = null;

    this.timelineContainer = null;
    this.timelineSVG = null;

    this.colorScaleContainer = null;
    this.colorScaleSVG = null;

    this.coordinateXScale = d3.scaleLinear();
    this.coordinateYScale = d3.scaleLinear();

    this.densityXScale = d3.scaleLinear();
    this.densityYScale = d3.scaleLinear();

    this.areaChartXScale = d3.scaleLinear();
    this.areaChartYScale = d3.scaleLinear();

    this.colorScale = d3.scaleSequential(d3.interpolateCividis);
    //this.distanceColorScale = d3.scaleSequential(d3.interpolateCool);
    this.distanceColorScale = d3.scaleSequential(d3.interpolateWarm);

    this.movementScale = d3.scaleLinear().range([0, 100]);

    this.timeScale = d3.scaleLinear();

    this.absoluteAgeScale = d3.scaleLinear();
    this.relativeAgeScale = d3.scaleLinear();

    this.timeBrush = d3.brushX();
    this.timeXAxis = d3.axisBottom(this.timeScale);

    this.graphZoom = d3.zoom<SVGSVGElement, unknown>();
  }

  ngOnInit() {
    this.graphService.loadData();
  }

  ngAfterContentInit() {
    this.init();
  }

  private init() {
    this.graphService.getGraph().subscribe((data: Graph) => {
      this.graph = data;
      console.log(this.graph);

      // setup svgs and scales
      this.setup();
      // draw legend
      this.drawColorLegend();

      this.calculateDistances(this.start, this.end);
      // resample nodes, trajectories and edges
      this.resampleNodes(this.start, this.end);
      // this.resampleTrajectories(this.start, this.end);
      this.resampleEdges(this.start, this.end);

      this.drawTrajectories();
      this.drawLinks();
      this.drawNodes();
      this.drawDensity();
      this.drawAreaChart();

      this.timelineGuidance();
    });
  }

  private update() {
    // this.calculateDistances(this.start, this.end);

    this.resampleNodes(this.start, this.end);
    this.resampleEdges(this.start, this.end);

    this.drawNodes();
    this.drawLinks();
    this.drawTrajectories();
    this.drawDensity();

    this.timelineGuidance();
  }

  protected saveNodeIds() {
    this.selectedNodeIds = this.nodeIds.filter((node: { id: string, checked: boolean }) => node.checked).map((node: { id: string, checked: boolean }) => node.id);
    this.update();
    this.timelineGuidance();
  }

  protected toggleNode(id: string) {
    // toggle checked flag
    this.nodeIds.find((node: { id: string, checked: boolean }) => node.id === id)!.checked = !this.nodeIds.find((node: { id: string, checked: boolean }) => node.id === id)!.checked;
  }

  protected clearNodeIds() {
    this.selectedNodeIds = [];
    this.nodeIds.forEach((node: { id: string, checked: boolean }) => node.checked = false);
    this.update();
  }

  protected toggleSidebar() {
    this.showSidebar = !this.showSidebar;
  }

  protected toggleDropdown($event: Event) {
    $event.preventDefault();

    this.showDropdown = !this.showDropdown;
  }

  private toggleVisibility(group: string, show: boolean) {
    this.graphSVG?.select(`#${group}`)
      .attr('display', show ? 'block' : 'none');
  }

  public toggleGroup(group: string) {
    // toggle svg group visibility based on passed string
    switch (group) {
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

  public toggleMouseOver() {
    this.showTrajectories = !this.showTrajectories;
  }

  protected reload(dataset: string) {
    this.showDropdown = false;

    this.graphService.loadData(dataset);

    d3.selectAll('svg').remove();

    this.graphService.getGraph().subscribe((data: Graph) => {
      this.graph = data;
      this.originalGraph = data;
      this.initGuidance = true;

      this.cdref.detectChanges();
      this.init();
    });
  }

  private clearTrajectories() {
    this.graphSVG?.select('#trajectories-wrapper')
      .selectAll('path')
      .remove();
  }

  private clearDistances() {
    this.distances = [];
  }

  private clearGuidance() {
    this.graphSVG?.select('#time-guidance-wrapper')
      .selectAll('line')
      .remove();
  }

  private clearLinks() {
    this.graphSVG?.select('#links-wrapper')
      .selectAll('line')
      .remove();
  }

  private clearNodes() {
    this.graphSVG?.select('#nodes-wrapper')
      .selectAll('circle')
      .remove();
  }

  private clearDensity() {
    this.graphSVG?.select('#densities-wrapper')
      .selectAll('rect')
      .remove();
  }

  private clearAreaChart() {
    this.timelineSVG?.select('#area-wrapper')
      .selectAll('path')
      .remove();
  }


  private setup() {
    if (!this.graph) {
      return;
    }

    // get all unique node ids
    this.nodeIds = this.graph.nodes.map(node => { return { id: node.id, checked: false, distance: 0 }; });

    this.graphSVG = d3.select(this.graphContainer?.nativeElement).append('svg');

    this.graphWidth = this.graphContainer?.nativeElement.offsetWidth;
    this.graphHeight = this.graphContainer?.nativeElement.offsetHeight;

    this.graphZoom
      .extent([[0, 0], [this.graphWidth, this.graphHeight]])
      .scaleExtent([0.1, 10])
      .on('zoom', this.zoomGraph.bind(this));

    this.graphSVG
      .attr('width', this.graphWidth - (this.graphMargin.left + this.graphMargin.right))
      .attr('height', this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom))
      .append('g')
      .attr('id', 'graph-wrapper');

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'links-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth / 2}, ${this.graphHeight / 2})
      `)
      .attr('pointer-events', 'none');

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'densities-wrapper')
      .attr('pointer-events', 'none');

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'nodes-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth / 2}, ${this.graphHeight / 2})
      `);

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'trajectories-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth / 2}, ${this.graphHeight / 2})
      `)
      .attr('pointer-events', 'none');

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'labels-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth / 2}, ${this.graphHeight / 2})
      `)
      .attr('pointer-events', 'none');

    this.graphSVG?.call(this.graphZoom);

    this.timelineSVG = d3.select(this.timelineContainer?.nativeElement).append('svg');

    this.timelineWidth = this.timelineContainer?.nativeElement.offsetWidth;
    this.timelineHeight = this.timelineContainer?.nativeElement.offsetHeight;

    this.timelineSVG
      .attr('width', this.timelineWidth)
      .attr('height', this.timelineHeight)
      .append('g')
      .attr('id', 'timeline-wrapper');

    this.timelineSVG.select('#timeline-wrapper')
      .append('g')
      .attr('id', 'time-guidance-wrapper');

    this.timeBrush.extent([[this.graphMargin.left, 10 + this.graphMargin.top], [this.timelineWidth - this.graphMargin.right, this.timelineHeight - (this.graphMargin.top + this.graphMargin.bottom)]])
      .on('end', this.brushed.bind(this));

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

    // reduce node time array and sum up the amount of nodes per time convert toy array and sort by time
    const nodeTimeCount = _.reduce(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.time)), (acc: any, time: number) => {
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {});

    const nodeTimes = _.sortBy(_.map(nodeTimeCount, (count: number, time: string) => {
      return {
        time: parseFloat(time),
        count: count
      }
    }), 'time');

    // reduce edge time array and sum up the amount of nodes per time convert to array and sort by time
    const edgeTimeCount = _.reduce(_.flattenDeep(_.map(this.graph.edges, (edge: Edge) => edge.time)), (acc: any, time: number) => {
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {});

    const edgeTimes = _.sortBy(_.map(edgeTimeCount, (count: number, time: string) => {
      return {
        time: parseFloat(time),
        count: count
      }
    }), 'time');

    const nodeTimeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.time)));
    const edgeTimeExtent = d3.extent(_.flattenDeep(_.map(this.graph.edges, (edge: Edge) => edge.time)));

    this.start = Math.min(<number>nodeTimeExtent[0], <number>edgeTimeExtent[0]);
    this.end = Math.max(<number>nodeTimeExtent[1], <number>edgeTimeExtent[1]);

    this.originalStart = this.start;
    this.originalEnd = this.end;

    this.areaChartXScale.domain([this.originalStart, this.originalEnd]).range([
      0 + this.graphMargin.left,
      this.timelineWidth - this.graphMargin.right
    ]);

    const maxNodes = _.maxBy(nodeTimes, (time: any) => time.count) || { time: 0, count: 0 };
    const maxEdges = _.maxBy(edgeTimes, (time: any) => time.count) || { time: 0, count: 0 };
    const max = maxNodes > maxEdges ? maxNodes : maxEdges;

    this.areaChartYScale.domain([0, max.count] as Array<number>).range([
      this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top),
      0 + this.graphMargin.top + this.graphMargin.bottom
    ]);

    this.colorScale.domain(nodeTimeExtent as Array<number>);

    this.colorScaleNodes.domain(this.graph.nodes.map((node: Node) => node.id) as Array<string>);

    this.colorScaleSVG = d3.select(this.colorScaleContainer?.nativeElement).append('svg');

    this.colorScaleSVG
      .attr('width', '200px')
      .attr('height', '40px');

    this.timeScale = d3.scaleLinear().domain(nodeTimeExtent as Array<number>).range([
      0 + this.graphMargin.left,
      this.timelineWidth - this.graphMargin.right
    ]);

    const absoluteAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.age ? node.age : 0)));

    this.absoluteAgeScale = d3.scaleLinear().domain(absoluteAgeExtent as Array<number>).range([0.1, 1]);

    const relativeAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.ages ? node.ages : 0)));

    this.relativeAgeScale = d3.scaleLinear().domain(relativeAgeExtent as Array<number>).range([0.1, 1]);
  }

  private drawColorLegend() {
    if (!this.colorScaleSVG) return;

    // append color scale to colorScaleSVG
    this.colorScaleSVG
      .append('g')
      .attr('class', 'colorScale')

    const defs = this.colorScaleSVG.append('defs');

    const linearGradient = defs.append('linearGradient')
      .attr('id', 'linear-gradient');

    linearGradient.selectAll('stop')
      .data((this.distanceColorScale as any).ticks().map((t: string, i: number, n: any) => ({ offset: `${100 * i / n.length}%`, color: this.distanceColorScale(+t) })))
      .enter().append('stop')
      .attr('offset', (d: any) => d.offset)
      .attr('stop-color', (d: any) => d.color);

    this.colorScaleSVG.append('g')
      .append('rect')
      .attr('width', '200px')
      .attr('height', '20px')
      .attr('transform', 'translate(0, 5)')
      .style('fill', 'url(#linear-gradient)');

    // append text to colorScaleSVG
    this.colorScaleSVG.append('g')
      .append('text')
      .attr('x', '0')
      .attr('y', '35')
      .text('Low')
      .style('font-size', '12px')
      .style('fill', 'black');

    this.colorScaleSVG.append('g')
      .append('text')
      .attr('x', '175')
      .attr('y', '35')
      .text('High')
      .style('font-size', '12px')
      .style('fill', 'black');
  }

  private brushed($event: d3.D3BrushEvent<unknown>) {
    // get brush extent
    if (!$event.selection) return;
    if (!$event.sourceEvent) return;

    const extent = $event.selection;

    const t0 = this.timeScale.invert(<number>extent[0]);
    const t1 = this.timeScale.invert(<number>extent[1]);

    this.start = t0;
    this.end = t1;

    console.log(`brushed from ${this.start} to ${this.end}`);

    // update distances
    // this.calculateDistances(this.start, this.end);

    // update relativeAgeScale
    // this.relativeAgeScale.domain(d3.extent(_.flattenDeep(_.map(this.graph?.nodes, (node: Node) => node.ages ? node.ages : 0))) as Array<number>);

    // resample nodes, trajectories and edges
    this.resampleNodes(this.start, this.end);
    // this.resampleTrajectories(this.start, this.end);
    this.resampleEdges(this.start, this.end);

    // update graph
    // this.updateGraph(this.start, this.end);
    this.drawNodes();
    // update density
    this.drawDensity();
    // update links 
    this.drawLinks();
  }

  protected updateBandwidth($event: Event) {
    $event.preventDefault();
    this.bandwidth = parseInt(($event.target as HTMLInputElement).value);
    this.drawDensity();
  }

  protected updateNodeColoring($event: Event) {
    $event.preventDefault();
    this.colorNodesByDistance = !this.colorNodesByDistance;


    this.graphSVG?.select("#nodes-wrapper")
      .selectAll('circle')
      .attr('fill', (d: any) => {
        // if nodeId is in nodeIds (persistently selected)
        const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
          return n.id === d.id;
        });

        if (found?.checked) {
          if ((this.start === this.originalStart && this.end === this.originalEnd)) return '#ff0000';

          // if found and time is within start/end 
          if (this.start !== undefined && this.end !== undefined && (d.time >= this.start && d.time <= this.end)) {
            return 'red';
          } else {
            return '#ffdcdc';
            //return 'url(#diagonal-stripe-1)';
          }
        } else {
          const distance = this.distances.find((distance: { id: string, distance: number }) => {
            return d.id.includes(distance.id.split('-')[1])
          });

          return this.colorNodesByDistance ? this.distanceColorScale(distance?.distance || 0) : 'gray';
        }
      });
  }

  private nodeMouseOver($event: MouseEvent) {
    // select and highlight node
    if (!$event) return;

    $event.preventDefault();

    const id = ($event.target as Element).id;
    this.graphSVG?.select(`#${id}`)
      .attr('fill', '#FFF01F')
      .attr('stroke', '#000000')
      .attr('stroke-width', '2px')
      .attr('stroke-opacity', '1')
      .attr('fill-opacity', '1')
      .raise();

    // set div tooltip position visibility and content
    d3.select('#tooltip')?.style('left', `${$event.pageX + 5}px`)
      .style('top', `${$event.pageY - 25}px`)
      .style('z-index', '100')
      .style('display', 'inline-block')
      .style('opacity', '.7')
      .style('font-weight', 'bold')
      .html(`<mark>${id.replace('node-', '').replace('__0', '').split('-')[0]}</mark>`);

    const nodeIndex = parseInt(($event.target as Element).id.split('-')[2]);
    const nodeId = ($event.target as Element).id.split('-')[1];
    let time = this.graph?.nodes.find((node: Node) => node.id === nodeId)?.time[nodeIndex - 1];
    if (time === undefined)
      time = 0;
    const trajectoryId = `trajectory-${id.split('-')[1]}`;

    // draw time needle on top of area chart
    this.timelineSVG?.select('#area-wrapper')
    .append('line')
      .attr('x1', this.areaChartXScale(time))
      .attr('y1', 0 + this.graphMargin.top + this.graphMargin.bottom)
      .attr('x2', this.areaChartXScale(time))
      .attr('y2', this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top))
      .attr('id', 'time-needle-stroke')
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 4)
      .attr('stroke-opacity', 1);

    this.timelineSVG?.select('#area-wrapper')
      .append('line')
      .attr('x1', this.areaChartXScale(time))
      .attr('y1', 0 + this.graphMargin.top + this.graphMargin.bottom)
      .attr('x2', this.areaChartXScale(time))
      .attr('y2', this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top))
      .attr('id', 'time-needle')
      .attr('fill', 'none')
      .attr('stroke', 'yellow')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 1);

    // show trajectories of the current node id else show neighboring edges
    if (this.showTrajectories) {
      this.graphSVG?.select('#trajectories-wrapper')
        .selectAll('path')
        .attr('stroke-opacity', (d: any) => {
          // get node id from d.id 
          const found = this.graph?.nodes.find((node: Node) => node.id === nodeId);

          // check if found is in nodeIds
          const foundNode = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
            return n.id === found?.id;
          });

          // if foundNode exists and is checked 
          if (foundNode?.checked && d.id === trajectoryId) {
            return this.relativeAgeScale(d.age);
          }

          // if edge isnt in the current time range hide edge
          if (this.start !== undefined && this.end !== undefined && (d.t0 < this.start || d.t1 > this.end)) return 0;

          if (d.id === trajectoryId) {
            return this.relativeAgeScale(d.age);
          } else {
            return 0;
          }
        })
        .raise();
    } else {
      this.graphSVG?.select('#links-wrapper')
        .selectAll('line')
        .attr('stroke-opacity', (d: any) => {
          // if edge isnt in the current time range hide edge
          if (this.start !== undefined && this.end !== undefined && (d.t < this.start && d.t > this.end)) return 0;


          // get start and end time of node id
          const found = this.graph?.nodes.find((node: Node) => node.id === nodeId);

          if (!found) return 0;

          // // if found start and end time is outside of the current time range hide edge
          // if (found.time[nodeIndex] < d.t0 && found.time[nodeIndex + 1] > d.t1) return 0;

          if (id.includes(d.sourceId) || id.includes(d.targetId)) {
            return this.relativeAgeScale(d.age);
          } else {
            return 0;
          }
        });
    }
  }

  private resampleNodes(start: number | undefined, end: number | undefined) {
    if (!this.graph) return;

    if (!start || !end) return;

    if (this.originalGraph) {
      this.graph = this.originalGraph;
    }
    console.log(`resampling nodes from ${start} to ${end}`)
    // resample nodes
    const filteredTimesAndCoordinates = new Array<Node>();
    // get nodes in current time frame
    this.graph.nodes.forEach((node: Node) => {
      node.time.forEach((time: number, index: number) => {
        const isPersistent = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => n.id === node.id);
        if ((time >= start && time <= end || isPersistent?.checked)) {
          // check if node is already in filteredTimesAndCoordinates
          const found = filteredTimesAndCoordinates.find((filteredNode: Node) => filteredNode.id === node.id);

          if (found) {
            found.time.push(time);
            found.coordinates.push(node.coordinates[index]);
            found.ages.push(node.ages[index]);
            found.resampled.push(node.resampled[index]);
          } else {
            filteredTimesAndCoordinates.push({
              id: node.id,
              label: node.label,
              time: [time],
              coordinates: [node.coordinates[index]],
              ages: [node.ages[index]],
              resampled: [node.resampled[index]]
            });
          }
        }
      });
    });

    // create this.resampleFrequency nodes between each pair of times and coordinates of filtered nodes
    const resampledNodes = new Array<Node>();
    filteredTimesAndCoordinates.forEach((node: Node) => {
      // Fix for intervals of length = 1
      if (node.time.length <= 1) {
        // find original nodes closest end time and push it to time and coordinates array
        const found = this.graph?.nodes.find((n: Node) => n.id === node.id);
        if (!found) return;

        node.time.push(end);

        // find closest coordinate to end time from original node
        let closest = 0;
        let closestIndex = 0;
        found.time.forEach((time: number, i: number) => {
          if (Math.abs(time - end) < Math.abs(closest - end)) {
            closest = time;
            closestIndex = i;
          }
        });

        // push closest coordinate to coordinates array
        node.coordinates.push(found.coordinates[closestIndex]);

        // calculate difference between first and last time
        let age = end - node.time[0];
        node.ages.push(age);
        node.resampled.push(true);
      }

      for (let i = 0; i < node.time.length - 1; i++) {
        const t0 = node.time[i];
        const t1 = node.time[i + 1];

        const x0 = node.coordinates[i].x;
        const x1 = node.coordinates[i + 1].x;

        const y0 = node.coordinates[i].y;
        const y1 = node.coordinates[i + 1].y;

        const age0 = node.ages[i];
        const age1 = node.ages[i + 1];       

        for (let j = 0; j <= this.resampleFrequency; j++) {
          // resample using this.lerp
          const t = this.lerp(t0, t1, j / this.resampleFrequency);
          const x = this.lerp(x0, x1, j / this.resampleFrequency);
          const y = this.lerp(y0, y1, j / this.resampleFrequency);
          const age = this.lerp(age0, age1, j / this.resampleFrequency);

          // check if node is already in resampledNodes
          const found = resampledNodes.find((resampledNode: Node) => resampledNode.id === node.id);

          if (found) {
            // if we are at the last iteration push the final time and coordinates 
            if (j === this.resampleFrequency) {
              found.time.push(t1);
              found.coordinates.push({ x: x1, y: y1 });
              found.ages.push(age1);
              found.resampled.push(false);
            } else {
              found.time.push(t);
              found.coordinates.push({ x, y });
              found.resampled.push(j == 0 ? false : true);
              if (found.ages) found.ages.push(age);
            }
          } else {
            resampledNodes.push({
              id: node.id,
              label: node.id,
              time: [t],
              coordinates: [{ x, y }],
              ages: [age],
              resampled: [j == 0 ? false : true]
            });
          }
        }
      }
    });

    console.log(resampledNodes);

    // sum up count of times in this.graph.nodes
    let count = 0;
    this.graph.nodes.forEach((node: Node) => {
      node.time.forEach((time: number) => {
        count++;
      });
    });
    // sum up count of times in resampledNodes
    let resampledCount = 0;
    resampledNodes.forEach((node: Node) => {
      node.time.forEach((time: number) => {
        resampledCount++;
      });
    });
    console.log(`resampled ${count} nodes to ${resampledCount} nodes`);

    this.originalGraph = {
      nodes: this.graph.nodes,
      edges: this.graph.edges
    }
    // swap nodes
    if(this.resampleFrequency > 0) {
      this.graph.nodes = resampledNodes;
    }
  }

  private resampleTrajectories(start: number, end: number) {
    // resample trajectories
  }

  private resampleEdges(start: number | undefined, end: number | undefined) {
    // resample edges
    if (!this.graph) return;

    if (!start || !end) return;

    // match edges to nodes
    const matchedEdges = new Array<Edge>();

    this.graph.edges.forEach((edge: Edge) => {
      // find times of source and target within start and end
      edge.time.forEach((time: number, i: number) => {

        if (time >= start && time <= end) {
          // check if edge is already in matchedEdges
          const found = matchedEdges.find((matchedEdge: Edge) => matchedEdge.source.id === edge.source.id && matchedEdge.target.id === edge.target.id);

          // find source and target from this.graph.nodes
          const s = this.graph?.nodes.find((node: Node) => node.id === edge.source.id);
          const t = this.graph?.nodes.find((node: Node) => node.id === edge.target.id);

          if (!s || !t) return;

          // check for nearest source and target time 
          let sTime = s.time[0];
          let tTime = t.time[0];
          let sIndex = 0;
          let tIndex = 0;

          s.time.forEach((sT: number, i: number) => {
            if (Math.abs(sT - time) < Math.abs(sTime - time)) {
              sTime = sT;
              sIndex = i;
            }
          });

          t.time.forEach((tT: number, i: number) => {
            if (Math.abs(tT - time) < Math.abs(tTime - time)) {
              tTime = tT;
              tIndex = i;
            }
          });

          if (found) {
            found.time.push(time);
            found.ages.push(edge.ages[i]);
            found.coordinates.push({
              x0: s.coordinates[sIndex].x,
              y0: s.coordinates[sIndex].y,
              x1: t.coordinates[tIndex].x,
              y1: t.coordinates[tIndex].y
            });
          } else {
            matchedEdges.push({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              time: [time],
              ages: [edge.ages[i]],
              coordinates: [{
                x0: s.coordinates[sIndex].x,
                y0: s.coordinates[sIndex].y,
                x1: t.coordinates[tIndex].x,
                y1: t.coordinates[tIndex].y
              }]
            });
          }
        }
      });
    });

    console.log(`matched ${this.graph.edges.length} edges to ${matchedEdges.length} edges`);

    this.graph.edges = matchedEdges;
  }

  private nodeMouseOut($event: MouseEvent) {
    // unselect and unhighlight node
    if (!$event) return;

    $event.preventDefault();

    // set div tooltip position visibility and content
    d3.select('#tooltip')
      .style('left', `${$event.pageX}px`)
      .style('top', `${$event.pageY}px`)
      .style('display', 'none')
      .html('');

    this.graphSVG?.select("#nodes-wrapper")
      .selectAll('circle')
      .attr('fill', (d: any) => {
        if (this.colorNodesByDistance) {
          // see if node is persistently highlighted 
          const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
            return n.id === d.id;
          });

          if (found?.checked) {
            if ((this.start === this.originalStart && this.end === this.originalEnd)) return '#ff0000';

            // if found and time is within start/end
            if (this.start !== undefined && this.end !== undefined && (d.time >= this.start && d.time <= this.end)) {
              return 'red';
            } else {
              return '#ffdcdc' /*'url(#diagonal-stripe-1)'*/;
            }
          }

          const distance = this.distances.find((distance: { id: string, distance: number }) => {
            return d.id.includes(distance.id.split('-')[1])
          });

          return this.distanceColorScale(distance?.distance || 0);
        } else {
          // if nodeId is in nodeIds (persistently selected)
          const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
            return n.id === d.id;
          });

          if (found?.checked) {
            if ((this.start === this.originalStart && this.end === this.originalEnd) && found.checked) {
              if (d.time >= this.start && d.time <= this.end) {
                return 'red';
              } else {
                return '#ffdcdc';
              }
              // return '#ffdcdc';
            };

            // if found and time is within start/end 
            if (this.start !== undefined && this.end !== undefined && (d.time >= this.start && d.time <= this.end) && found.checked) return 'red';
            // 50% red is kinda pinkish
            // return 'gray';
            return '#ffdcdc' /*'url(#diagonal-stripe-1)'*/;
          } else
            return 'gray';
        }
      })
      .attr('stroke', (d: any) => d.resampled ? 'none' : 'orange')
      .attr('fill-opacity', (d: any) => {
        return this.relativeAgeScale(d.age);
      })

    // hide trajectories of the current node id else hide neighboring edges
    if (this.showTrajectories) {
      this.graphSVG?.select('#trajectories-wrapper')
        .selectAll('path')
        .attr('stroke-opacity', (d: any) => {
          // get node id from path id
          const id = d.id.split('-')[1];

          // check if node is persistently highlighted
          const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
            return n.id === id;
          });

          // if found.checked set opacity of only the mouseovered trajectory
          if (found?.checked) {
            return this.relativeAgeScale(d.age);
          }

          return 0;
        });
    } else {
      this.graphSVG?.select('#links-wrapper')
        .selectAll('line')
        .attr('stroke-opacity', 0);
    }

    this.timelineSVG?.select('#area-wrapper #time-needle')
      .remove();

    this.timelineSVG?.select('#area-wrapper #time-needle-stroke')
      .remove();
  }

  private zoomGraph($event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
    if (!$event.transform) return;

    this.graphSVG?.select('#graph-wrapper').attr('transform', `${$event.transform}`);
  }

  private calculateDistances(start?: number, end?: number) {
    if (!this.graph) return;

    // create trajectories from pairs of nodes
    const trajectories = new Array<{ x0: number, y0: number, x1: number, y1: number, id: string, age: number, t0: number, t1: number }>();
    this.graph.nodes.forEach((node: Node) => {
      // iterate over coordinates and create trajectories
      node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
        if (index < node.coordinates.length - 1) {
          trajectories.push({
            x0: coordinate.x,
            y0: coordinate.y,
            x1: node.coordinates[index + 1].x,
            y1: node.coordinates[index + 1].y,
            id: `trajectory-${node.id}`,
            age: node.ages ? (node.ages[index] + node.ages[index + 1]) / 2 : 0,
            t0: node.time[index],
            t1: node.time[index + 1]
          });
        }
      });
    });

    this.trajectories = trajectories;

    let filteredTrajectories = undefined;

    // if start & end we filter trajectories by time
    if (start && end) {
      filteredTrajectories = this.trajectories.filter((trajectory: { x0: number, y0: number, x1: number, y1: number, id: string, age: number, t0: number, t1: number }) => {
        return trajectory.t0 >= start && trajectory.t1 <= end;
      });
    }

    const distances = new Array<{ id: string, distance: number }>();

    // group trajectories by id with coordinate array
    const groupedTrajectories = new Map<string, Array<Trajectory>>();

    const trajectoryIterable = filteredTrajectories ? filteredTrajectories : this.trajectories;

    trajectoryIterable.forEach((trajectory: Trajectory) => {
      if (groupedTrajectories.has(trajectory.id)) {
        groupedTrajectories.get(trajectory.id)?.push(trajectory);
      } else {
        groupedTrajectories.set(trajectory.id, [trajectory]);
      }
    });

    groupedTrajectories.forEach((trajectories: Array<Trajectory>) => {
      let distance = 0;
      trajectories.forEach((trajectory: Trajectory) => {
        distance += Math.sqrt(Math.pow(trajectory.x1 - trajectory.x0, 2) + Math.pow(trajectory.y1 - trajectory.y0, 2));
      });
      distances.push({
        id: trajectories[0].id,
        distance: distance
      });
    });

    distances.sort((a: { id: string, distance: number }, b: { id: string, distance: number }) => {
      return a.distance - b.distance;
    });

    this.distances = distances;

    // assign distances to nodeIds
    this.nodeIds.forEach((nodeId: { id: string, checked: boolean, distance: number }) => {
      const distance = distances.find((d: { id: string, distance: number }) => d.id.split('-')[1] === nodeId.id)?.distance || 0;
      nodeId.distance = +distance.toFixed(2);
    });

    this.nodeIds.sort((a: { id: string, checked: boolean }, b: { id: string, checked: boolean }) => {
      const distA = distances.find((d: { id: string, distance: number }) => d.id.split('-')[1] === a.id)?.distance || 0;
      const distB = distances.find((d: { id: string, distance: number }) => d.id.split('-')[1] === b.id)?.distance || 0;
      return distB - distA;
    });


    const distMax = d3.max(this.distances, (d: { id: string, distance: number }) => d.distance);

    console.log(`distance extent: ${distMax}`)

    this.distanceColorScale.domain([0, distMax] as Array<number>);
    this.movementScale.domain([0, distMax] as Array<number>);


    if (this.initGuidance) {
      this.initGuidance = !this.initGuidance;
      // grab top 3 and enable
      for (let i = 0; i < 3; i++) {
        this.nodeIds[i].checked = true;
      }
    }
  }

  // draw intermediary nodes at sample rate
  private drawNodes() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawNodes(), 1000);
      return;
    };

    // zip time and coordinates
    const zipped = new Array<{ id: string, x: number, y: number, time: number, age: number, index: number, resampled: boolean }>();
    this.graph.nodes.forEach((node: Node) => {
      node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
        zipped.push({
          id: node.id,
          x: coordinate.x,
          y: coordinate.y,
          time: node.time[index],
          age: node.ages ? node.ages[index] : 0,
          index: index + 1,
          resampled: node.resampled[index]
        });
      });
    });

    // draw nodes
    const nodes = this.graphSVG?.select('#nodes-wrapper')

    if (!nodes) return;

    nodes
      .selectAll('circle')
      .data(zipped)
      .join('circle')
      .attr('class', 'node')
      .attr('cx', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => this.coordinateXScale(d.x))
      .attr('cy', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => this.coordinateYScale(d.y))
      .attr('r', (d: { id: string, x: number, y: number, time: number, age: number, index: number, resampled: boolean }) => d.resampled ? 7 : 11)
      .attr('interval', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => {
        const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
          return n.id === d.id;
        });

        if (found?.checked) {
          if ((this.start === this.originalStart && this.end === this.originalEnd)) return true;

          // if found and time is within start/end
          if (this.start !== undefined && this.end !== undefined && (d.time >= this.start && d.time <= this.end)) return true;

          return false;
        }

        return false;
      })
      .attr('fill', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => {
        if (this.colorNodesByDistance) {
          // see if node is persistently highlighted 
          const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
            return n.id === d.id;
          });

          if (found?.checked) {
            if ((this.start === this.originalStart && this.end === this.originalEnd)) return '#ff0000';

            // if found and time is within start/end
            if (this.start !== undefined && this.end !== undefined && (d.time >= this.start && d.time <= this.end)) {
            // select this circle with d3 and add custom property to it 
              return 'red';
            } else {
              return '#ffdcdc' /*'url(#diagonal-stripe-1)'*/;
            }
          }

          const distance = this.distances.find((distance: { id: string, distance: number }) => {
            return d.id.includes(distance.id.split('-')[1])
          });

          return this.distanceColorScale(distance?.distance || 0);
        } else {
          // if nodeId is in nodeIds (persistently selected)
          const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
            return n.id === d.id;
          });

          if (found?.checked) {
            if ((this.start === this.originalStart && this.end === this.originalEnd) && found.checked) {
              // checked and original interval
              // d3.select(`#node-${d.id}-${d.index}`).attr('interval', 'true');
              return 'red';  
            }

            // if found and time is within start/end 
            if (this.start !== undefined && this.end !== undefined && (d.time >= this.start && d.time <= this.end) && found.checked) {
              // d3.select(`#node-${d.id}-${d.index}`).attr('interval', 'true');
              return 'red';
            }
              // 50% red is kinda pinkish
            // return 'gray';

            return '#ffdcdc' /*'url(#diagonal-stripe-1)'*/;
          } else
            return 'gray';
        }
      })
      .attr('fill-opacity', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => {
        const found = this.nodeIds.find((n: { id: string, checked: boolean, distance: number }) => {
          return n.id === d.id;
        });
        // if checked and within start - end range return 1
        if (found?.checked && this.start !== undefined && this.end !== undefined && (d.time >= this.start && d.time <= this.end)) return 1;

        return this.relativeAgeScale(d.age);
      })
      .attr('id', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => `node-${d.id}-${d.index}`)
      .attr('stroke', (d: { resampled: boolean }) => d.resampled ? 'none' : 'orange')
      .on('mouseover', this.nodeMouseOver.bind(this))
      .on('mouseout', this.nodeMouseOut.bind(this));

    // select all nodes where start and end date is within the current interval selection and raise them
    d3.selectAll('circle[interval="true"]').raise();
    nodes.exit().remove();

    // filter out last occurrence of each node from graph nodes
    const lastOccurrences = new Array<{ id: string, x: number, y: number, time: number, age: number }>();
    this.graph.nodes.forEach((node: Node) => {
      const lastOccurrence = node.coordinates[node.coordinates.length - 1];
      const lastTime = node.time[node.time.length - 1];
      const lastAge = node.ages[node.ages.length - 1];

      lastOccurrences.push({
        id: node.id,
        x: lastOccurrence.x,
        y: lastOccurrence.y,
        time: lastTime,
        age: lastAge
      });
    });

    const labels = this.graphSVG?.select('#labels-wrapper')

    if (!labels) return;

    labels
      .selectAll('text')
      .data(lastOccurrences)
      .join('text')
      .attr('class', 'node-label')
      .attr('pointer-events', 'none')
      .text((d: { id: string, x: number, y: number, time: number, age: number }) => `${d.id.replace('__0', '').split('-')[0]}`)
      .attr('x', (d: { id: string, x: number, y: number, time: number, age: number }) => this.coordinateXScale(d.x))
      .attr('y', (d: { id: string, x: number, y: number, time: number, age: number }) => this.coordinateYScale(d.y))
      .attr('opacity', (d: { id: string, x: number, y: number, time: number, age: number }) => { return this.relativeAgeScale(d.age); })
      .attr('stroke', 'white')
      .attr('stroke-width', '1px')
      .attr('paint-order', 'stroke');

    labels.exit().remove();
  }

  private drawLinks() {
    if (!this.graph) {
      setTimeout(() => this.drawLinks(), 1000);
      return;
    }

    const zipped = new Array<{ id: string, sourceId: string, targetId: string, t: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }>();

    this.graph.edges.forEach((edge: Edge) => {
      edge.coordinates.forEach((coordinate: { x0: number; y0: number; x1: number; y1: number }, i: number) => {
        zipped.push({
          id: edge.id,
          sourceId: edge.source.id,
          targetId: edge.target.id,
          t: edge.time[i],
          age: edge.ages[i],
          index: i,
          x0: coordinate.x0,
          y0: coordinate.y0,
          x1: coordinate.x1,
          y1: coordinate.y1
        });
      });
    });

    // draw links between nodes
    // draw density
    const edges = this.graphSVG?.select('#links-wrapper')

    if (!edges) return;

    edges
      .selectAll('line')
      .data(zipped)
      .join('line')
      .attr('class', 'link')
      .attr('x1', (d: { id: string, t: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateXScale(d.x0);
      })
      .attr('x2', (d: { id: string, t: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateXScale(d.x1);
      })
      .attr('y1', (d: { id: string, t: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateYScale(d.y0);
      })
      .attr('y2', (d: { id: string, t: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateYScale(d.y1);
      })
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0);

    edges.exit().remove();
  }

  private drawTrajectories() {
    if (!this.graph) {
      setTimeout(() => this.drawTrajectories(), 1000);
      return;
    }

    this.calculateDistances();

    // draw trajectories between pairs of nodes
    const trajectories = this.graphSVG?.select('#trajectories-wrapper');

    if (!trajectories) return;

    trajectories
      .selectAll('path')
      .data(this.trajectories)
      .join('path')
      .attr('class', 'trajectory')
      .attr('d', (d: { x0: number, y0: number, x1: number, y1: number, id: string }) => {
        return d3.line()([
          [this.coordinateXScale(d.x0), this.coordinateYScale(d.y0)],
          [this.coordinateXScale(d.x1), this.coordinateYScale(d.y1)]
        ]);
      })
      .attr('id', (d: { x0: number, y0: number, x1: number, y1: number, id: string }) => d.id)
      .attr('stroke', 'black')
      .attr('stroke-width', 3)
      .attr('fill', 'none')
      .attr('stroke-opacity', (d: { x0: number, y0: number, x1: number, y1: number, id: string }) => {
        const nodeId = d.id.split('-')[1];

        return this.nodeIds.find((n: any) => n.id === nodeId)?.checked ? 1 : 0;
      });

    trajectories.exit().remove();
  }

  private drawDensity() {
    // check if graph is loaded
    if (!this.originalGraph) {
      // try again in 1 second
      setTimeout(() => this.drawDensity(), 1000);
      return;
    };


    // zip time and coordinates
    const zipped = new Array<{ id: string, x: number, y: number, time: number, age: number }>();

    this.originalGraph.nodes.forEach((node: Node) => {

      node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
        if (this.start === undefined && this.end === undefined) return;

        if (this.start !== undefined && this.end !== undefined && (node.time[index] < this.start || node.time[index] > this.end)) return;

        zipped.push({
          id: node.id,
          x: coordinate.x,
          y: coordinate.y,
          time: node.time[index],
          age: node.ages ? node.ages[index] : 0
        });
      });
    });

    const densityData = d3.contourDensity<{ id: string, x: number, y: number, time: number, age: number }>()
      .x((d: { id: string, x: number, y: number, time: number, age: number }) => this.densityXScale(d.x))
      .y((d: { id: string, x: number, y: number, time: number, age: number }) => this.densityYScale(d.y))
      .size([
        (this.graphWidth - (this.graphMargin.left + this.graphMargin.right)),
        (this.graphHeight - (this.graphMargin.top + this.graphMargin.bottom))
      ])
      .bandwidth(this.bandwidth)
      .weight((d: { id: string, x: number, y: number, time: number, age: number }) => {
        return this.relativeAgeScale(d.age);
        // return 1;
      })
      (zipped);


    // draw density
    const density = this.graphSVG?.select('#densities-wrapper')

    if (!density) return;

    density
      .selectAll('path')
      .data(densityData)
      .join('path')
      .attr('class', 'density')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 1)
      .attr('d', d3.geoPath())
      .attr('fill', (d: any) => this.colorScale(d.value))
      .attr('opacity', (d: any) => {
        // return 1;
        return d.value * 700;
      });

    density.exit().remove();
  }

  private lerp(x: number, y: number, a: number) {
    // return x * (1 - a) + y * a;
    return x + (y - x) * a;
  }

  protected resample($event?: Event) {
    // resample the node data according to the stride
    if (!this.graph) { console.log('no graph'); return; }

    console.log('resampling' + this.resampleFrequency);

    if ($event) this.resampleFrequency = ($event.target as any).value;

    this.update();
  }

  private drawAreaChart() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawAreaChart(), 1000);
      return;
    };

    if (this.start !== undefined && this.end !== undefined) {
      let nodeIntervals = new Map<number, Array<string>>();
      let edgeIntervals = new Map<number, Array<string>>();

      // calculate stride based on this.start and this.end
      const stride = (this.end - this.start) / 100; // TODO: decide on a good number of points to sample

      const pointTimes = new Array<number>();
      // create array of points for each stride in the interval of this.start and this.end
      for (let i = this.start; i <= this.end; i += stride) {
        pointTimes.push(i);
      }

      if (!pointTimes.includes(this.end)) pointTimes.push(this.end);

      this.graph.nodes.forEach((node: Node) => {
        for (let i = 0; i < node.time.length - 1; i++) {
          // grab pairs of times
          const t0 = node.time[i];
          const t1 = node.time[i + 1];
          pointTimes.forEach((time: number) => {
            // if time is between t0 and t1 add node to pointTimes
            if (time >= t0 && time <= t1) {
              // set nodeIntervals map 
              if (!nodeIntervals.get(time)) {
                nodeIntervals.set(time, new Array<string>());
                nodeIntervals.get(time)?.push(node.id);
              } else {
                // check if node.id is already in array
                if (!nodeIntervals.get(time)?.includes(node.id)) {
                  nodeIntervals.get(time)?.push(node.id);
                }
              }
            }
          });
        }
      });

      // convert node intervals to array of time and count where count is length of array
      const nodeData = new Array<{ time: number, count: number }>();
      nodeIntervals.forEach((nodes: Array<string>, time: number) => {
        nodeData.push({ time: time, count: nodes.length });
      });

      // sort nodeData by time
      nodeData.sort((a, b) => a.time - b.time);

      this.graph.edges.forEach((edge: Edge) => {
        for (let i = 0; i < edge.time.length - 1; i++) {
          // grab pairs of times
          const t0 = edge.time[i];
          const t1 = edge.time[i + 1];
          pointTimes.forEach((time: number) => {
            // if time is between t0 and t1 add edge to pointTimes
            if (time >= t0 && time <= t1) {
              // set edgeIntervals map 
              if (!edgeIntervals.get(time)) {
                edgeIntervals.set(time, new Array<string>());
                edgeIntervals.get(time)?.push(edge.id);
              } else {
                // check if edge.id is already in array
                if (!edgeIntervals.get(time)?.includes(edge.id)) {
                  edgeIntervals.get(time)?.push(edge.id);
                }
              }
            }
          });
        }
      });

      // convert node intervals to array of time and count where count is length of array
      const edgeData = new Array<{ time: number, count: number }>();
      edgeIntervals.forEach((edges: Array<string>, time: number) => {
        edgeData.push({ time: time, count: edges.length });
      });

      // sort edgeData by time
      edgeData.sort((a, b) => a.time - b.time);

      // find max count from edgeData and nodeData
      const maxCount = Math.max(d3.max(edgeData, d => d.count) || 0, d3.max(nodeData, d => d.count) || 0);

      // update areaChartYScale domain
      this.areaChartYScale.domain([0, maxCount]);

      // compare max time of nodeData and edgeData and calculate difference
      const cutoff = [
        this.areaChartXScale.domain()[0],
        Math.min(d3.max(nodeData, d => d.time) || 0, d3.max(edgeData, d => d.time) || 0)
      ];
      
      // update areaChartXScale domain
      this.areaChartXScale.domain(cutoff);

      // update timeSCale
      this.timeScale.domain(cutoff);

      // cutoff edges that are outside of the domain
      const cutoffEdges = edgeData.filter((d: { time: number, count: number }) => {
        return d.time >= cutoff[0] && d.time <= cutoff[1];
      });

      const cutoffNodes = nodeData.filter((d: { time: number, count: number }) => {
        return d.time >= cutoff[0] && d.time <= cutoff[1];
      });

      // append axis
      this.timelineSVG?.select('#timeline-wrapper')
        .append('g')
        .attr('id', 'axis-wrapper')
        .attr('transform', `translate(0, ${this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top)})`)
        .call(d3.axisBottom(this.timeScale));

      this.timelineSVG?.select('#timeline-wrapper')
        .append('g')
        .attr('id', 'brush')
        .call(this.timeBrush)
        // .call(this.timeBrush.move, [this.graphMargin.left, this.timelineWidth - this.graphMargin.right]);

      // draw area chart
      this.timelineSVG?.select('#timeline-wrapper')
        .append('g')
        .attr('id', 'area-wrapper')
        .append('path')
        .attr('d', () => {
          return d3.area<{ time: number, count: number }>()
            .curve(d3.curveMonotoneX)
            .x((d: { time: number, count: number }) => {
              return this.areaChartXScale(d.time)
            })
            .y0(this.areaChartYScale(0))
            .y1((d: { time: number, count: number }) => {
              return this.areaChartYScale(d.count)
            })
            .bind(this)(cutoffNodes);
        })
        .attr('id', 'node-area')
        .attr('fill', 'red')
        .attr('fill-opacity', 0.15)
        .style('pointer-events', 'none');

      // draw line on top of area chart
      this.timelineSVG?.select('#area-wrapper')
        .append('path')
        .attr('d', () => {
          return d3.line<{ time: number, count: number }>()
            .curve(d3.curveMonotoneX)
            .x((d: { time: number, count: number }) => {
              return this.areaChartXScale(d.time)
            })
            .y((d: { time: number, count: number }) => {
              return this.areaChartYScale(d.count)
            })
            .bind(this)(cutoffNodes);
        })
        .attr('id', 'node-line')
        .attr('fill', 'none')
        .attr('stroke', 'red')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.5);


      // draw area chart
      this.timelineSVG?.select('#area-wrapper')
        .append('path')
        .attr('d', () => {
          return d3.area<{ time: number, count: number }>()
            .curve(d3.curveMonotoneX)
            .x((d: { time: number, count: number }) => {
              return this.areaChartXScale(d.time)
            })
            .y0(this.areaChartYScale(0))
            .y1((d: { time: number, count: number }) => {
              return this.areaChartYScale(d.count)
            })
            .bind(this)(cutoffEdges);
        })
        .attr('id', 'edge-area')
        .attr('fill', 'blue')
        .attr('fill-opacity', 0.15)
        .style('pointer-events', 'none');

      // draw line on top of area chart
      this.timelineSVG?.select('#area-wrapper')
        .append('path')
        .attr('d', () => {
          return d3.line<{ time: number, count: number }>()
            .curve(d3.curveMonotoneX)
            .x((d: { time: number, count: number }) => {
              return this.areaChartXScale(d.time)
            })
            .y((d: { time: number, count: number }) => {
              return this.areaChartYScale(d.count)
            })
            .bind(this)(cutoffEdges);
        })
        .attr('id', 'edge-line')
        .attr('fill', 'none')
        .attr('stroke', 'blue')
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.5);
    }

    // add legend on top left corner of the area chart
    const legend = this.timelineSVG?.select('#area-wrapper')
      .append('g')
      .attr('id', 'legend-wrapper')
      .attr('transform', `translate(${this.graphMargin.left}, -${this.graphMargin.top})`);

    legend?.append('rect')
      .attr('x', 10)
      .attr('y', 35)
      .attr('width', 20)
      .attr('height', 20)
      .attr('fill', 'red')
      .attr('fill-opacity', 0.15);

    legend?.append('text')
      .attr('x', 40)
      .attr('y', 45)
      .attr('font-size', '12px')
      .text('Nodes');

    legend?.append('rect')
      .attr('x', 10)
      .attr('y', 65)
      .attr('width', 20)
      .attr('height', 20)
      .attr('fill', 'blue')
      .attr('fill-opacity', 0.15);

    legend?.append('text')
      .attr('x', 40)
      .attr('y', 75)
      .attr('font-size', '12px')
      .text('Edges');

    legend?.lower();
  }

  private graphGuidance() {
    // reset checked

    // grab top 3 and enable
    for (let i = 0; i < 3; i++) {
      this.nodeIds[i].checked = true;
    }
  }

  private selectBrushWindow(newSelectionRange: Array<number>) {
    this.timelineSVG?.select('#brush')
      .call(<any>this.timeBrush.move, newSelectionRange);

    this.update();
  }

  private findCommonIntervals(items: Array<Array<{ start: number, end: number }>>): Array<{ start: number, end: number }> {
    // Step 1: Flatten the array of intervals into a single array of events
    let events = [];
    for (let i = 0; i < items.length; i++) {
        for (let j = 0; j < items[i].length; j++) {
            events.push({time: items[i][j].start, type: 'start'});
            events.push({time: items[i][j].end, type: 'end'});
        }
    }

    // Step 2: Sort the array of events
    events.sort((a, b) => a.time - b.time || (a.type === 'start' ? -1 : 1));

    // Step 3 and 4: Iterate over the sorted array of events
    let count = 0;
    let result = new Array<{ start: number, end: number }>();
    let startTime;
    for (let i = 0; i < events.length; i++) {
        if (events[i].type === 'start') {
            count++;
            if (count === items.length) {
                startTime = events[i].time;
            }
        } else {
            if (count === items.length && startTime) {
                result.push({ start: startTime, end: events[i].time });
            }
            count--;
        }
    }

    // filter out results for intervals where start and end are the same
    result = result.filter((d: { start: number, end: number }) => {
      return d.start !== d.end;
    });

    return result;
}

  private timelineGuidance() {
    if (!this.graph) {
      setTimeout(() => this.timelineGuidance(), 1000);
    }

    const foundNodes = new Array<Node>();
    // go through persistently selected / highlighted nodes and check if all 3 exist in the current start - end interval
    this.nodeIds.forEach((n: { id: string, checked: boolean, distance: number }) => {
      // find the node in the graph.nodes
      if (!n.checked) return;

      const found = this.originalGraph?.nodes.find((node: Node) => node.id === n.id);
      if (found) foundNodes.push(found);
    });

    const arrayOfNodes = new Array<Array<{ start: number, end: number }>>();
    foundNodes.forEach((node: Node) => {
      let intervals = new Array<{ start: number, end: number }>();
      for (let i = 0; i < node.time.length - 1; i += 2) {
        intervals.push({ start: node.time[i], end: node.time[i + 1] });
      }
      arrayOfNodes.push(intervals);
    });

    const overlaps = this.findCommonIntervals(arrayOfNodes);

    // cutoff overlaps that are outside of the domain
    overlaps.forEach((d: { start: number, end: number }) => {
      if(d.end >= this.originalEnd) d.end = this.originalEnd;
    });
    
    if (overlaps.length === 0) {
      // clear guidance
      const guidance = this.timelineSVG?.select('#time-guidance-wrapper');

      guidance?.selectAll('rect').remove();
      // clear icons 

      guidance?.selectAll('text').remove();

      return;
    }

    const guidance = this.timelineSVG?.select('#time-guidance-wrapper');

    if (!guidance) return;

    guidance
      .selectAll('rect')
      .data(overlaps)
      .join('rect')
      .attr('class', 'guidelines')
      .attr('stroke', 'black')
      .attr('x', (d: { start: number, end: number }) => this.areaChartXScale(d.start))
      .attr('width', (d: { start: number, end: number }) => {
        const end = d.end >= this.areaChartXScale.domain()[1] ? this.areaChartXScale.domain()[1] : d.end;
        return this.areaChartXScale(end) - this.areaChartXScale(d.start);
      })
      .attr('y', 20)
      .attr('height', this.timelineHeight - 40)
      .attr('fill', 'orange')
      .attr('fill-opacity', 0.1);

    guidance
      .selectAll('text')
      .data(overlaps)
      .join('text')
      .attr('class', 'guidelines-labels')
      .attr('x', (d: { start: number, end: number }) => this.areaChartXScale(d.start))
      .attr('y', 20)
      .style('font-size', '20px')
      .style('font-weight', '400')
      .style('cursor', 'pointer')
      .text('\u24D8')
      .on('click', ($event: Event) => {
        if (!$event) return;

        $event.preventDefault();

        const selection = ($event.target as any).__data__;

        this.start = selection.start;
        this.end = selection.end;

        console.log(this.start, this.end);

        this.selectBrushWindow([this.areaChartXScale(selection.start), this.areaChartXScale(selection.end)]);
      });
  }
}
  