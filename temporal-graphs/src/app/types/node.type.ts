type Node = {
    id: string;
    label: string;
    time: Array<number>; // NOTE: these are pairs of [start, end] times
    coordinates: Array<{ x: number, y: number }>; // NOTE: these are pairs of [start, end] coordinates
    ages?: Array<number>; // NOTE: these are pairs of [start, end] ages
    age?: number;
};

export default Node;