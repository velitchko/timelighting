import Node from './node.type';

type Edge = {
    id: string;
    source: Node;
    target: Node;
    time: Array<number>;
    ages: Array<number>;
};

export default Edge;