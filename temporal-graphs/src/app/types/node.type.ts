type Node = {
    id: string | number;
    label: string;
    time: Array<number>;
    coordinates: Array<{ x: number, y: number }>;
};

export default Node;