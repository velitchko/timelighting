import { Component, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
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

  private areaChartXScale: d3.ScaleLinear<number, number>;
  private areaChartYScale: d3.ScaleLinear<number, number>;

  // continous viridis color scale
  private colorScale: d3.ScaleSequential<string>;

  private timeScale: d3.ScaleLinear<number, number>;

  private absoluteAgeScale: d3.ScaleLinear<number, number>;
  private relativeAgeScale: d3.ScaleLinear<number, number>;

  private timeBrush: d3.BrushBehavior<unknown>;
  private timeXAxis: d3.Axis<number | { valueOf(): number; }>;

  private graphZoom: d3.ZoomBehavior<SVGGElement, unknown>;

  protected showNodes: boolean = true;
  protected showDensities: boolean = true;
  protected showLabels: boolean = true;

  protected showTrajectories: boolean = true;

  constructor(private graphService: GraphService, private route: ActivatedRoute) {
    
    this.graph = null;
    
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

    this.timeScale = d3.scaleLinear();

    this.absoluteAgeScale = d3.scaleLinear();
    this.relativeAgeScale = d3.scaleLinear();

    this.timeBrush = d3.brushX();
    this.timeXAxis = d3.axisBottom(this.timeScale);

    this.graphZoom = d3.zoom();
  }

  ngAfterViewInit() {
    this.graphService.getGraph().subscribe((data: Graph) => {
      this.graph = data;

      this.setup();
      this.drawDensity();
      this.drawNodes();
      this.drawLinks();
      this.drawTrajectories();
      this.drawAreaChart();
      // this.drawTimeline();
    });
  }

  private toggleVisibility(group: string, show: boolean) {
    this.graphSVG?.select(`#${group}`)
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

  public toggleMouseOver() {
    this.showTrajectories = !this.showTrajectories;
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
    const timeCount = _.reduce(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.time)), (acc: any, time: number) => {
      acc[time] = (acc[time] || 0) + 1;
      return acc;
    }, {});

    const times = _.sortBy(_.map(timeCount, (count: number, time: string) => {
      return {
        time: parseFloat(time),
        count: count
      }
    }), 'time');

    const timeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.time)));

    this.areaChartXScale.domain(timeExtent as Array<number>).range([ 
      0 + this.graphMargin.left, 
      this.timelineWidth - this.graphMargin.right
    ]);

    this.areaChartYScale.domain([0, d3.max(times, (d: any ) => d.count)]).range([
      this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top),
      0 + this.graphMargin.top
    ]);

    this.colorScale.domain(timeExtent as Array<number>);

    this.timeScale = d3.scaleLinear().domain(timeExtent as Array<number>).range([
      0 + this.graphMargin.left, 
      this.timelineWidth - this.graphMargin.right
    ]);

    const absoluteAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.age ? node.age : 0)));

    this.absoluteAgeScale = d3.scaleLinear().domain(absoluteAgeExtent as Array<number>).range([0.1, 1]);

    const relativeAgeExtent = d3.extent(_.flattenDeep(_.map(this.graph.nodes, (node: Node) => node.ages ? node.ages : 0)));
  
    this.relativeAgeScale = d3.scaleLinear().domain(relativeAgeExtent as Array<number>).range([0.1, 1]);

    this.graphZoom
      .extent([[0, 0], [this.graphWidth, this.graphHeight]])
      .scaleExtent([0.1, 10])
      .on('zoom', this.zoomGraph.bind(this));

  }

  private brushed($event: d3.D3BrushEvent<unknown>) {
    // get brush extent
    if(!$event.selection) return;

    const extent = $event.selection;

    const t0 = this.timeScale.invert(<number>extent[0]);
    const t1 = this.timeScale.invert(<number>extent[1]);

    // update graph
    this.updateGraph(t0, t1);
    // update density
    this.updateDensity(t0, t1);
  }

  private nodeMouseOver($event: MouseEvent) {
    // select and highlight node
    if(!$event) return;

    const id = ($event.target as Element).id;
    this.graphSVG?.select(`#${id}`)
      .attr('fill', 'red');

    const trajectoryId = `trajectory-${id.split('-')[1]}`;
    // show trajectories of the current node id else show neighboring edges
    if(this.showTrajectories) {
      this.graphSVG?.select('#trajectories-wrapper')
        .selectAll('path')
        .attr('stroke-opacity', (d: any) => {
          if (d.id === trajectoryId) {
            return 1;
            } else {
              return 0;
            }
        })
        .attr('stroke', 'red');
    } else {
      this.graphSVG?.select('#edges-wrapper')
        .selectAll('line')
        .attr('stroke', (d: any) => {
          if (d.source.id === id || d.target.id === id) {
            return 'red';
          } else {
            return 'transparent';
          }
        })
        .attr('stroke-opacity', (d: any) => {
          if (d.source.id === id || d.target.id === id) {
            return 'red';
          } else {
            return 'transparent';
          }
        });
    }
  }

  private nodeMouseOut($event: MouseEvent) {
    // unselect and unhighlight node
    if(!$event) return;

    const id = ($event.target as Element).id;
    this.graphSVG?.select("#nodes-wrapper")
      .selectAll('circle')
      .attr('fill', 'gray');

    // hide trajectories of the current node id else hide neighboring edges
    if(this.showTrajectories) {
      this.graphSVG?.select('#trajectories-wrapper')
        .selectAll('path')
        .attr('stroke-opacity', 0);
    } else {
      this.graphSVG?.select('#edges-wrapper')
        .selectAll('line')
        .attr('stroke', 'gray')
        .attr('stroke-opacity', 1);
    }
  }

  private zoomGraph($event: d3.D3ZoomEvent<SVGGElement, any>) {
    console.log($event);
    this.graphSVG?.select('#graph-wrapper')
      .attr('transform', `${$event.transform}`);
  }

  private updateGraph(start: number, end: number) {
    // update graph nodes
    this.graphSVG?.select('#graph-wrapper')
      .selectAll('circle')
      .attr('fill', (d: any) => {
        if (d.time >= start && d.time <= end) {
          return 'gray';
        } else {
          return 'transparent';
        }
      })
      .attr('stroke-opacity', (d: any) => {
        if (d.time >= start && d.time <= end) {
          return 1;
          } else {
            return 0;
      }});
    // update graph labels
    this.graphSVG?.select('#graph-wrapper')
      .selectAll('text')
      .attr('fill', (d: any) => {
        if (d.time >= start && d.time <= end) {
          return 'black';
        } else {
          return 'transparent';
        }
      });
  }

  private updateDensity(start: number, end: number) {
    // update density
    this.graphSVG?.select('#density-wrapper')
      .selectAll('rect')
      // .attr('d', d3.geoPath())
      .attr('opacity', (d: any) => {
        if (d.time >= start && d.time <= end) {
          return 1;
        } else {
          return 0;
        }
      })
      .attr('stroke-opacity', (d: any) => {
        if (d.time >= start && d.time <= end) {
          return 1;
          } else {
            return 0;
      }});
  }
  
  private drawNodes() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawNodes(), 1000);
      return;
    };

    // zip time and coordinates
      // zip time and coordinates
      const zipped = new Array<{ id: string | number, x: number, y: number, time: number, age: number, index: number }>();
      this.graph.nodes.forEach((node: Node) => {
    
        node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
          zipped.push({
            id: node.id,
            x: coordinate.x,
            y: coordinate.y,
            time: node.time[index],
            age: node.ages ? node.ages[index] : 0,
            index: index
          });
        });
      });

    this.graphSVG?.call(<any>this.graphZoom);

    // draw nodes
    this.graphSVG?.select('#graph-wrapper')
      .append('g')
      .attr('id', 'nodes-wrapper')
      .selectAll('circle')
      .data(zipped)
      .enter()
      .append('circle')
      .attr('class', 'node')
      .attr('cx', (d: { id: string | number, x: number, y: number, time: number, age: number, index: number }) => this.coordinateXScale(d.x))
      .attr('cy', (d: { id: string | number, x: number, y: number, time: number, age: number, index: number }) => this.coordinateYScale(d.y))
      .attr('r', 8)
      .attr('fill', 'gray')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', (d: { id: string | number, x: number, y: number, time: number, age: number, index: number }) => {
        return this.relativeAgeScale(d.age);
      })
      .attr('opacity', (d: { id: string | number, x: number, y: number, time: number, age: number, index: number }) => {
        return this.relativeAgeScale(d.age);
      })
      .attr('id', (d: { id: string | number, x: number, y: number, time: number, age: number, index: number }) => `node-${d.id}-${d.index}`)
      .on('mouseover', this.nodeMouseOver.bind(this))
      .on('mouseout', this.nodeMouseOut.bind(this));
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
      .attr('pointer-events', 'none')
      .text((d: { id: string | number, x: number, y: number, time: number, age: number }) => `node-${d.id}`)
      .attr('x', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateXScale(d.x))
      .attr('y', (d: { id: string | number, x: number, y: number, time: number, age: number }) => this.coordinateYScale(d.y))
      .attr('opacity', (d: { id: string | number, x: number, y: number, time: number, age: number }) => { return this.relativeAgeScale(d.age); });
  }
  
  private drawLinks() {

  }

  private drawTrajectories() {
    if(!this.graph) {
      setTimeout(() => this.drawTrajectories(), 1000);
      return;
    }

    // create trajectories from pairs of nodes
    const trajectories = new Array<{ x0: number, y0: number, x1: number, y1: number, id: string}>();
    this.graph.nodes.forEach((node: Node) => {
      // iterate over coordinates and create trajectories
      node.coordinates.forEach((coordinate: { x: number, y: number }, index: number) => {
        if (index < node.coordinates.length - 1) {
          trajectories.push({
            x0: coordinate.x,
            y0: coordinate.y,
            x1: node.coordinates[index + 1].x,
            y1: node.coordinates[index + 1].y,
            id: `trajectory-${node.id}`
          });
        }
      });
    });

    // draw trajectories between pairs of nodes
    this.graphSVG?.select('#graph-wrapper')
      .append('g')
      .attr('id', 'trajectories-wrapper')
      .selectAll('path')
      .data(trajectories)
      .enter()
      .append('path')
      .attr('class', 'trajectory')
      .attr('d', (d: { x0: number, y0: number, x1: number, y1: number, id: string}) => {
          return d3.line()([
            [this.coordinateXScale(d.x0), this.coordinateYScale(d.y0)],
            [this.coordinateXScale(d.x1), this.coordinateYScale(d.y1)]
          ]);
      })
      .attr('id', (d: { x0: number, y0: number, x1: number, y1: number, id: string}) => d.id)
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
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
      .bandwidth(50)
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

  private drawAreaChart() {
     // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawAreaChart(), 1000);
      return;
    };

    // calculate number of nodes per time
    const nodesPerTime = new Array<{ time: number, count: number }>();

    this.graph.nodes.forEach((node: Node) => {
      node.time.forEach((time: number, index: number) => {
        const nodePerTime = nodesPerTime.find((npt: { time: number, count: number }) => npt.time === time);
        if (nodePerTime) {
          nodePerTime.count += 1;
        } else {
          nodesPerTime.push({
            time: time,
            count: 1
          });
        }
      });
    });

    nodesPerTime.sort((a: { time: number, count: number }, b: { time: number, count: number }) => a.time - b.time);

    this.timelineSVG?.select('#timeline-wrapper')
    .append('g')
    .call(this.timeBrush)
    .call(this.timeBrush.move, [this.graphMargin.left, this.timelineWidth - this.graphMargin.right]);

  // append axis
  this.timelineSVG?.select('#timeline-wrapper')
    .append('g')
    .attr('id', 'axis-wrapper')
    .attr('transform', `translate(0, ${this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top)})`)
    .call(d3.axisBottom(this.timeScale));

    // draw area chart
    this.timelineSVG?.select('#timeline-wrapper')
      .append('g')
      .attr('id', 'area-wrapper')
      .append('path')
      .attr('d', (d: any) => { 
        return d3.area<any>()
                .curve(d3.curveMonotoneX)
                .x((d: any) => {
                  return this.areaChartXScale(d.time)
                })
                .y0(this.areaChartYScale(0))
                .y1((d: any) => {
                  return this.areaChartYScale(d.count)
                })
                .bind(this)(nodesPerTime);
      })
      .attr('fill', 'gray')
      .attr('fill-opacity', 0.5);

      // draw line on top of area chart
      this.timelineSVG?.select('#timeline-wrapper')
      .append('g')
      .attr('id', 'line-wrapper')
      .append('path')
      .attr('d', (d: any) => {
        return d3.line<any>()
                .curve(d3.curveMonotoneX)
                .x((d: any) => {
                  return this.areaChartXScale(d.time)
                })
                .y((d: any) => {
                  return this.areaChartYScale(d.count)
                })
                .bind(this)(nodesPerTime);
      }
      )
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 2);
    

  }

  // OLD CODE
  private drawTimeline() {
    // check if graph is loaded
    if (!this.graph) {
      // try again in 1 second
      setTimeout(() => this.drawTimeline(), 1000);
      return;
    };

    // get node intervals and sort them
    // const intervals = new Array<{ id: string | number, start: number, end: number }>();
    // this.graph.nodes.forEach((node: Node) => {

    //   node.time.forEach((time: number, index: number) => {
    //     if(index === node.time.length - 1) return;

    //     intervals.push({
    //       id: node.id,
    //       start: time,
    //       end: node.time[index + 1]
    //     })
    //   });
    // });

    const points = new Array<{ id: string | number, time: number }>();
    const radius = 2

    this.graph.nodes.forEach((node: Node) => {
      node.time.forEach((time: number) => {
        points.push({
          id: node.id,
          time: time
        });
      });
    });

    this.timelineSVG?.select('#timeline-wrapper')
      .append('g')
      .call(this.timeBrush)
      .call(this.timeBrush.move, [this.graphMargin.left, this.timelineWidth - this.graphMargin.right]);

    // append axis
    this.timelineSVG?.select('#timeline-wrapper')
      .append('g')
      .attr('id', 'axis-wrapper')
      .attr('transform', `translate(0, ${this.timelineHeight - (this.graphMargin.bottom + this.graphMargin.top)})`)
      .call(d3.axisBottom(this.timeScale));

    // append points as circles that dont overlap
    let yCoordMap = new Map<string | number, number>();
    let yCounter = this.graphMargin.top + radius*2;

    this.timelineSVG?.select('#timeline-wrapper')
      .append('g')
      .attr('id', 'points-wrapper')
      .selectAll('circle')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'points')
      .attr('cx', (d: { id: string | number, time: number }) => radius + this.timeScale(d.time))
      .attr('cy', (d: { id: string | number, time: number }) => {
        if(!yCoordMap.has(d.id)) {
          yCoordMap.set(d.id, yCounter);
          yCounter += radius*2.5;
        }

        return yCoordMap.get(d.id) || 0;
      })
      .attr('r', radius)
      // .attr('width', (d: { id: string | number, start: number, end: number }) => this.timeScale(d.end) - this.timeScale(d.start))
      // .attr('height', 4)
      .attr('fill', () => {
        // return random hex color
        return '#e6ab02';
      })
  }
}
