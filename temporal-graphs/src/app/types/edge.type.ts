import Node from './node.type';

type Edge = {
    id: string;
    source: Node;
    target: Node;
    time: Array<number>;
    ages: Array<number>;
    coordinates: Array<{
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    }>;
};

export default Edge;