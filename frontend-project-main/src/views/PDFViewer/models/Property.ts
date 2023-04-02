import type {Position} from "@/views/PDFViewer/models/Position";

interface Property {
    id: string,
    // isConfirmed: boolean,
    // checkPoints: {
    //     checkpointKey: string,
    //     checkpointValue: string
    // },
    //
    // position: Position,

    pageNumber: number,
    name: string,
    comment: string,
    content: string,
    rects: Position,
    isConfirmed: boolean,
    isImage: boolean,
}

export type {Property}