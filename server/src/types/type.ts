export interface User {
    id: string;
    name: string;
    ws: WebSocket
}

export interface Message {
    user: string;
    text: string;
    timestamp: Date;
}