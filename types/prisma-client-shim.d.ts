declare module '@prisma/client' {
  export class PrismaClient {
    constructor(...args: any[]);
    [key: string]: any;
    $disconnect(): Promise<void>;
    $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
  }
}
