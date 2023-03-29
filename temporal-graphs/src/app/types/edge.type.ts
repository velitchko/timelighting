import Node from './node.type';

type Edge = {
    id: string | number;
    source: Node;
    target: Node;
    t: number;
};

export default Edge;