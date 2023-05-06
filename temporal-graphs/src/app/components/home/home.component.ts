import { Component, ViewChild, AfterContentInit, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import * as d3 from 'd3';
import Graph from '../../types/graph.type';
import Node from '../../types/node.type';
import Edge from '../../types/edge.type';
import Trajectory from '../../types/trajectories';
import { GraphService } from '../../services/graph.service';
import * as _ from 'lodash';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements AfterContentInit {
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

  private coordinateXScale: d3.ScaleLinear<number, number>;
  private coordinateYScale: d3.ScaleLinear<number, number>;

  private densityXScale: d3.ScaleLinear<number, number>;
  private densityYScale: d3.ScaleLinear<number, number>;

  private areaChartXScale: d3.ScaleLinear<number, number>;
  private areaChartYScale: d3.ScaleLinear<number, number>;

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

  private start: number = 0;
  private end: number = 0;
  private distances: Array<{ id: string, distance: number }> = [];
  private trajectories: Array<Trajectory> = [];

  constructor(private graphService: GraphService, private route: ActivatedRoute, private cdref: ChangeDetectorRef) {

    this.graph = null;
    this.originalGraph = null;

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

    this.areaChartXScale = d3.scaleLinear();
    this.areaChartYScale = d3.scaleLinear();

    this.colorScale = d3.scaleSequential(d3.interpolateViridis);
    this.distanceColorScale = d3.scaleSequential(d3.interpolateCool);

    this.timeScale = d3.scaleLinear();

    this.absoluteAgeScale = d3.scaleLinear();
    this.relativeAgeScale = d3.scaleLinear();

    this.timeBrush = d3.brushX();
    this.timeXAxis = d3.axisBottom(this.timeScale);

    this.graphZoom = d3.zoom<SVGSVGElement, unknown>();
  }

  ngAfterContentInit() {
    this.graphService.getGraph().subscribe((data: Graph) => {
      this.graph = data;

      // setup svgs and scales
      this.setup();
       // resample nodes, trajectories and edges
      this.resampleNodes(this.start, this.end);
      this.resampleTrajectories(this.start, this.end);
      this.resampleEdges(this.start, this.end);
      // draw graph
      this.drawLinks();
      this.drawTrajectories();
      this.drawNodes();
      this.drawDensity();
      this.drawAreaChart();
    });
  }

  protected saveNodeIds() {
    this.selectedNodeIds = this.nodeIds.filter((node: { id: string, checked: boolean }) => node.checked).map((node: { id: string, checked: boolean }) => node.id);
  }

  protected toggleNode(id: string | number) {
    // toggle checked flag
    this.nodeIds.find((node: { id: string | number, checked: boolean }) => node.id === id)!.checked = !this.nodeIds.find((node: { id: string | number, checked: boolean }) => node.id === id)!.checked;
  }

  protected clearNodeIds() {
    this.selectedNodeIds = [];
    this.nodeIds.forEach((node: { id: string | number, checked: boolean }) => node.checked = false);
  }

  protected toggleSidebar() {
    this.showSidebar = !this.showSidebar;
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

  public updateSliderValue($event: Event) {

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
      `);

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'trajectories-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth / 2}, ${this.graphHeight / 2})
      `);

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'densities-wrapper');

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'nodes-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth / 2}, ${this.graphHeight / 2})
      `);

    this.graphSVG.select('#graph-wrapper')
      .append('g')
      .attr('id', 'labels-wrapper')
      .attr('transform', `translate(
        ${this.graphWidth / 2}, ${this.graphHeight / 2})
      `);

    this.graphSVG?.call(this.graphZoom);

    this.timelineSVG = d3.select(this.timelineContainer?.nativeElement).append('svg');

    this.timelineWidth = this.timelineContainer?.nativeElement.offsetWidth;
    this.timelineHeight = this.timelineContainer?.nativeElement.offsetHeight;

    this.timelineSVG
      .attr('width', this.timelineWidth)
      .attr('height', this.timelineHeight)
      .append('g')
      .attr('id', 'timeline-wrapper');

    this.timeBrush.extent([[this.graphMargin.left, this.graphMargin.top], [this.timelineWidth - this.graphMargin.right, this.timelineHeight - (this.graphMargin.top + this.graphMargin.bottom)]])
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

    // reduce edge time array and sum up the amount of nodes per time convert toy array and sort by time
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

    this.start = <number>nodeTimeExtent[0];
    this.end = <number>nodeTimeExtent[1];

    this.areaChartXScale.domain(nodeTimeExtent as Array<number>).range([
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

    this.timeScale = d3.scaleLinear().domain(nodeTimeExtent as Array<number>).range([
      0 + this.graphMargin.left,
      this.timelineWidth - this.graphMargin.right
    ]);

    const absoluteAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.age ? node.age : 0)));

    this.absoluteAgeScale = d3.scaleLinear().domain(absoluteAgeExtent as Array<number>).range([0.1, 1]);

    const relativeAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.ages ? node.ages : 0)));

    this.relativeAgeScale = d3.scaleLinear().domain(relativeAgeExtent as Array<number>).range([0.1, 1]);
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

    // update distances
    this.calculateDistances(this.start, this.end);

    // resample nodes, trajectories and edges
    this.resampleNodes(this.start, this.end);
    // this.resampleTrajectories(this.start, this.end);
    // this.resampleEdges(this.start, this.end);

    // update graph
    // this.updateGraph(this.start, this.end);
    this.drawNodes();
    // update density
    this.drawDensity();
  }

  protected updateBandwidth($event: Event) {
    this.bandwidth = parseInt(($event.target as HTMLInputElement).value);
    this.drawDensity();
  }

  private nodeMouseOver($event: MouseEvent) {
    // select and highlight node
    if (!$event) return;

    const id = ($event.target as Element).id;
    this.graphSVG?.select(`#${id}`)
      .attr('fill', 'red');

    // set div tooltip position visibility and content
    d3.select('#tooltip')?.style('left', `${$event.pageX + 5}px`)
      .style('top', `${$event.pageY - 25}px`)
      .style('z-index', '100')
      .style('display', 'block')
      .html(id);

    const nodeIndex = parseInt(($event.target as Element).id.split('-')[2]);
    const nodeId = ($event.target as Element).id.split('-')[1];

    const trajectoryId = `trajectory-${id.split('-')[1]}`;
    // show trajectories of the current node id else show neighboring edges
    if (this.showTrajectories) {
      this.graphSVG?.select('#trajectories-wrapper')
        .selectAll('path')
        .attr('stroke-opacity', (d: any) => {
          // if edge isnt in the current time range hide edge
          if (d.t0 < this.start || d.t1 > this.end) return 0;

          if (d.id === trajectoryId) {
            return this.relativeAgeScale(d.age);
          } else {
            return 0;
          }
        });
    } else {
      this.graphSVG?.select('#links-wrapper')
        .selectAll('line')
        .attr('stroke-opacity', (d: any) => {
          // if edge isnt in the current time range hide edge
          if (d.t0 < this.start && d.t1 > this.end) return 0;


          // get start and end time of node id
          const found = this.graph?.nodes.find((node: Node) => node.id === nodeId);

          if (!found) return 0;

          // if found start and end time is outside of the current time range hide edge
          if (found.time[nodeIndex] < d.t0 && found.time[nodeIndex + 1] > d.t1) return 0;

          if (id.includes(d.sourceId) || id.includes(d.targetId)) {
            return this.relativeAgeScale(d.age);
          } else {
            return 0;
          }
        });
    }
  }

  private resampleNodes(start: number, end: number) {
    if(!this.graph) return;

    if(this.originalGraph) { 
      this.graph = this.originalGraph;
    }

    // resample nodes
    const filteredTimesAndCoordinates = new Array<{ id: string, times: Array<number>, coordinates: Array<{ x: number, y: number }>}>();
    // get nodes in current time frame
    this.graph.nodes.forEach((node: Node) => {
      node.time.forEach((time: number, index: number) => {
        if (time >= start && time <= end) {
          // check if node is already in filteredTimesAndCoordinates
          const found = filteredTimesAndCoordinates.find((filteredNode: { id: string, times: Array<number>, coordinates: Array<{ x: number, y: number }>}) => filteredNode.id === node.id);

          if (found) {
            found.times.push(time);
            found.coordinates.push(node.coordinates[index]);
          } else {
            filteredTimesAndCoordinates.push({
              id: node.id,
              times: [time],
              coordinates: [node.coordinates[index]]
            });
          }
        }
      });
    });

    // create this.resampleFrequency nodes between each pair of times and coordinates of filtered nodes
    const resampledNodes = new Array<Node>();
    filteredTimesAndCoordinates.forEach((node : { id: string, times: Array<number>, coordinates: Array<{ x: number, y: number }>}) => {
      for (let i = 0; i < node.times.length - 1; i++) {
        const t0 = node.times[i];
        const t1 = node.times[i + 1];

        const x0 = node.coordinates[i].x;
        const x1 = node.coordinates[i + 1].x;

        const y0 = node.coordinates[i].y;
        const y1 = node.coordinates[i + 1].y;

        for (let j = 0; j < this.resampleFrequency; j++) {
          // resample using this.lerp
          const t = this.lerp(t0, t1, j / this.resampleFrequency);
          const x = this.lerp(x0, x1, j / this.resampleFrequency);
          const y = this.lerp(y0, y1, j / this.resampleFrequency);

          // check if node is already in resampledNodes
          const found = resampledNodes.find((resampledNode: Node) => resampledNode.id === node.id);

          if (found) {
            found.time.push(t);
            found.coordinates.push({ x, y });
          } else {
            resampledNodes.push({
              id: node.id,
              label: node.id,
              time: [t],
              coordinates: [{ x, y }]
            });
          }
        }
      }
    });
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
    this.graph.nodes = resampledNodes;

  }

  private resampleTrajectories(start: number, end: number) {
    // resample trajectories
  }

  private resampleEdges(start: number, end: number) {
    // resample edges
  }

  private nodeMouseOut($event: MouseEvent) {
    // unselect and unhighlight node
    if (!$event) return;

    // set div tooltip position visibility and content
    d3.select('#tooltip')
      .style('left', `${$event.pageX}px`)
      .style('top', `${$event.pageY}px`)
      .style('display', 'none')
      .html('');

    this.graphSVG?.select("#nodes-wrapper")
      .selectAll('circle')
      .attr('fill', (d: any) => {
        const distance = this.distances.find((distance: { id: string, distance: number }) => {
          return d.id.includes(distance.id.split('-')[1])
        });

        return distance ? this.distanceColorScale(distance.distance) : 'gray';
      });

    // hide trajectories of the current node id else hide neighboring edges
    if (this.showTrajectories) {
      this.graphSVG?.select('#trajectories-wrapper')
        .selectAll('path')
        .attr('stroke-opacity', 0);
    } else {
      this.graphSVG?.select('#links-wrapper')
        .selectAll('line')
        .attr('stroke-opacity', 0);
    }
  }

  private zoomGraph($event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
    if (!$event.transform) return;

    this.graphSVG?.select('#graph-wrapper').attr('transform', `${$event.transform}`);
  }

  // private updateGraph(start: number, end: number) {
  //   if (!this.graph) return;

  //   // filter times out of nodes
  //   const filteredAges = new Array<number>();
  //   const ageIndices = new Array<number>();
  //   this.graph.nodes.forEach((node: Node) => {
  //     node.time.forEach((time: number, index: number) => {
  //       if (time >= start && time <= end) {
  //         ageIndices.push(node.ages ? node.ages[index] : -1);
  //       }
  //     });
  //     filteredAges.push(...ageIndices);
  //   });

  //   this.relativeAgeScale = d3.scaleLinear().domain(d3.extent(filteredAges) as Array<number>).range([0.1, 1]);

  //   // update node opacity with new compoted scales
  //   this.graphSVG?.select('#nodes-wrapper')
  //     .selectAll('circle')
  //     .data(this.graph.nodes)
  //     .enter()
  //     .append('circle')
  //     .attr('cx', (d: any) => d.coordinates[0].x)
  //     .attr('cy', (d: any) => d.coordinates[0].y)
  //     .attr('r', 5)
  //     .attr('fill', (d: any) => {
  //       const distance = this.distances.find((distance: { id: string, distance: number }) => {
  //         return d.id.includes(distance.id.split('-')[1])
  //       });

  //       return distance ? this.distanceColorScale(distance.distance) : 'gray';
  //     })
  //     .attr('opacity', (d: any) => {
  //       if (d.time < start || d.time > end) return 0;

  //       return this.relativeAgeScale(d.age);
  //     });

  //   // update label opacity
  //   this.graphSVG?.select('#labels-wrapper')
  //     .selectAll('text')
  //     .attr('opacity', (d: any) => {
  //       if (d.time < start || d.time > end) return 0;

  //       return this.relativeAgeScale(d.age);
  //     });

    // update trajectory opacity
    // this.graphSVG?.select('#trajectories-wrapper')
    //   .selectAll('path')
    //   .attr('stroke-opacity', (d: any) => {
    //     console.log(d.t0, d.t1, start, end)
    //     if (d.t0 <= start && d.t1 >= end) return 0;

    //     return this.relativeAgeScale(d.age);
    //   });
  // }

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
      return b.distance - a.distance;
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
    const zipped = new Array<{ id: string, x: number, y: number, time: number, age: number, index: number }>();
    this.graph.nodes.forEach((node: Node) => {

      node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
        zipped.push({
          id: node.id,
          x: coordinate.x,
          y: coordinate.y,
          time: node.time[index],
          age: node.ages ? node.ages[index] : 0,
          index: index + 1
        });
      });
    });

    // draw density
    const nodes = this.graphSVG?.select('#nodes-wrapper')

    if (!nodes) return;

    nodes
      .selectAll('circle')
      .data(zipped)
      .join('circle')
      .attr('class', 'node')
      .attr('cx', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => this.coordinateXScale(d.x))
      .attr('cy', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => this.coordinateYScale(d.y))
      .attr('r', 8)
      .attr('fill', 'gray')
      .attr('fill-opacity', 0.5)
      // .attr('stroke', 'black')
      // .attr('stroke-width', 2)
      // .attr('stroke-opacity', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => {
      //   return this.relativeAgeScale(d.age);
      // })
      .attr('opacity', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => {
        return this.relativeAgeScale(d.age);
      })
      .attr('id', (d: { id: string, x: number, y: number, time: number, age: number, index: number }) => `node-${d.id}-${d.index}`)
      .on('mouseover', this.nodeMouseOver.bind(this))
      .on('mouseout', this.nodeMouseOut.bind(this))

    nodes.exit().remove();

    // filter out last occurrence of each node from graph nodes
    const lastOccurrences = new Array<{ id: string | number, x: number, y: number, time: number, age: number }>();
    this.graph.nodes.forEach((node: Node) => {
      const lastOccurrence = node.coordinates[node.coordinates.length - 1];
      const lastTime = node.time[node.time.length - 1];
      const lastAge = node.age;

      lastOccurrences.push({
        id: node.id,
        x: lastOccurrence.x,
        y: lastOccurrence.y,
        time: lastTime,
        age: lastAge || 0
      });
    });

    this.graphSVG?.select('#labels-wrapper')
      .selectAll('text')
      .data(lastOccurrences)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('pointer-events', 'none')
      .text((d: { id: string | number, x: number, y: number, time: number, age: number }) => `node-${d.id}`)
      .attr('x', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateXScale(d.x))
      .attr('y', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateYScale(d.y))
      .attr('opacity', (d: { id: string | number, x: number, y: number, time: number, age: number }) => { return this.relativeAgeScale(d.age); });
  }

  private drawLinks() {
    if (!this.graph) {
      setTimeout(() => this.drawLinks(), 1000);
      return;
    }

    const zipped = new Array<{ id: string | number, sourceId: string | number, targetId: string | number, t0: number, t1: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }>();

    this.graph.edges.forEach((edge: Edge) => {

      const sourceNode = this.graph?.nodes.find((node: Node) => node.id === edge.source.id);
      const targetNode = this.graph?.nodes.find((node: Node) => node.id === edge.target.id);

      if (sourceNode && targetNode) {
        // iterate over pairs of time array in edge
        for (let i = 0; i < edge.time.length; i += 2) {
          // return index in node time array equal to edge time
          let sourceTimeIndex = undefined;
          for (let j = 0; j < sourceNode.time.length - 1; j += 2) {
            if (sourceNode.time[j] <= edge.time[i] && sourceNode.time[j + 1] >= edge.time[i]) {
              sourceTimeIndex = j;
              break;
            }
          }
          let targetTimeIndex = undefined;
          for (let j = 0; j < targetNode.time.length - 1; j += 2) {
            if (targetNode.time[j] <= edge.time[i] && targetNode.time[j + 1] >= edge.time[i]) {
              targetTimeIndex = j;
              break;
            }
          }
          if (!sourceTimeIndex || !targetTimeIndex) {
            return;
          }

          const x0 = sourceNode.coordinates[sourceTimeIndex].x;
          const y0 = sourceNode.coordinates[sourceTimeIndex].y;
          const x1 = targetNode.coordinates[targetTimeIndex].x;
          const y1 = targetNode.coordinates[targetTimeIndex].y;

          zipped.push({
            id: edge.id,
            sourceId: edge.source.id,
            targetId: edge.target.id,
            t0: edge.time[i],
            t1: edge.time[i + 1],
            age: edge.ages[i],
            index: i,
            x0: x0,
            y0: y0,
            x1: x1,
            y1: y1
          });
        }

      }
    });

    // draw links between nodes
    this.graphSVG?.select('#links-wrapper')
      .selectAll('line')
      .data(zipped)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('x1', (d: { id: string | number, t0: number, t1: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateXScale(d.x0);
      })
      .attr('x2', (d: { id: string | number, t0: number, t1: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateXScale(d.x1);
      })
      .attr('y1', (d: { id: string | number, t0: number, t1: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateYScale(d.y0);
      })
      .attr('y2', (d: { id: string | number, t0: number, t1: number, age: number, index: number, x0: number, y0: number, x1: number, y1: number }) => {
        return this.coordinateYScale(d.y1);
      })
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0);
  }

  private drawTrajectories() {
    if (!this.graph) {
      setTimeout(() => this.drawTrajectories(), 1000);
      return;
    }

    this.calculateDistances();

    const distanceExtent = d3.extent(this.distances, (d: { id: string, distance: number }) => d.distance);

    this.distanceColorScale.domain((distanceExtent as Array<number>));

    // draw trajectories between pairs of nodes
    this.graphSVG?.select('#trajectories-wrapper')
      .selectAll('path')
      .data(this.trajectories)
      .enter()
      .append('path')
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
      .attr('stroke-opacity', 0);
  }

  private drawDensity() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawDensity(), 1000);
      return;
    };

    // zip time and coordinates
    const zipped = new Array<{ id: string | number, x: number, y: number, time: number, age: number }>();

    this.graph.nodes.forEach((node: Node) => {
      node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
        if ((this.start && this.end) && (node.time[index] < this.start || node.time[index] > this.end)) return;
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
      .bandwidth(this.bandwidth)
      .weight((d: { id: string | number, x: number, y: number, time: number, age: number }) => {
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
        return d.value * 1000;
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

    if ($event) this.resampleFrequency = ($event.target as any).value;

    this.resampleNodes(this.start, this.end);
    
    this.drawNodes();
  }

  private drawAreaChart() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawAreaChart(), 1000);
      return;
    };

    let nodeIntervals = new Map<number, Array<string>>();
    let edgeIntervals = new Map<number, Array<string>>();

    // calculate stride based on this.start and this.end
    const stride = (this.end - this.start) / 100; // TODO: decide on a good number of points to sample

    const pointTimes = new Array<number>();
    // create array of points for each stride in the interval of this.start and this.end
    for (let i = this.start; i <= this.end; i += stride) {
      pointTimes.push(i);
    }

    if(!pointTimes.includes(this.end)) pointTimes.push(this.end);

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

    // append axis
    this.timelineSVG?.select('#timeline-wrapper')
      .append('g')
      .attr('id', 'axis-wrapper')
      .attr('transform', `translate(0, ${this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top)})`)
      .call(d3.axisBottom(this.timeScale));

    this.timelineSVG?.select('#timeline-wrapper')
      .append('g')
      .call(this.timeBrush)
      .call(this.timeBrush.move, [this.graphMargin.left, this.timelineWidth - this.graphMargin.right]);

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
          .bind(this)(nodeData);
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
          .bind(this)(nodeData);
      })
      .attr('id', 'node-line')
      .attr('fill', 'none')
      .attr('stroke', 'red')
      .attr('stroke-width', 1)
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
          .bind(this)(edgeData);
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
          .bind(this)(edgeData);
      })
      .attr('id', 'edge-line')
      .attr('fill', 'none')
      .attr('stroke', 'blue')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.5);
  }
}
