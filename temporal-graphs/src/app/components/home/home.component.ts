import { Component, ViewChild, AfterViewInit, ElementRef } from '@angular/core';
import * as d3 from 'd3';
import Graph from '../../types/graph.type';
import { GraphService } from '../../services/graph.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements AfterViewInit {
  private graph: Graph | null;

  @ViewChild('graphContainer', { static: true }) graphContainer: ElementRef | null;
  private graphSVG: d3.Selection<SVGSVGElement, unknown, null, any> | null;

  @ViewChild('timelineContainer', { static: true }) timelineContainer: ElementRef | null;
  private timelineSVG: d3.Selection<SVGSVGElement, unknown, null, any> | null;

  constructor(private graphService: GraphService) {
    this.graph = null;

    this.graphService.loadData();

    this.graphContainer = null;
    this.graphSVG = null;

    this.timelineContainer = null;
    this.timelineSVG = null;
  }

  ngAfterViewInit() {
    this.graphService.getGraph().subscribe((data: Graph) => {
      this.graph = data;

      this.setup();
      this.drawGraph();
      this.drawTimeline();
    });
  }

  private setup() {
    this.graphSVG = d3.select(this.graphContainer?.nativeElement).append('svg');

    this.graphSVG
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', '0 0 100 100')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .append('g').attr('id', 'graph-wrapper');

    this.timelineSVG = d3.select(this.timelineContainer?.nativeElement).append('svg');

    this.timelineSVG
      .attr('width', '100%')
      .attr('height', '20%')
      .attr('viewBox', '0 0 100 100')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .append('g').attr('class', 'timeline-wrapper');
  }

  private drawGraph() {
    
  }

  private drawTimeline() {
  }
}
