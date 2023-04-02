import type {Property} from "@/views/PDFViewer/models/Property";

interface Group {
    groupName: string
    properties: Property[]
}

export type {Group}