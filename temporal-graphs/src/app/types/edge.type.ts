import Node from './node.type';

type Edge = {
    id: string | number;
    source: Node;
    target: Node;
    time: Array<number>;
};

export default Edge;