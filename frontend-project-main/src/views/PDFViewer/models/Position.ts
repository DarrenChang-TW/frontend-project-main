interface Position {
    pageNumber: number,
    boundingRect: {
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        width: number,
        height: number
    }
}

export type {Position}