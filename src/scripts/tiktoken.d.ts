declare module "tiktoken" {
    export interface Tiktoken {
        encode(text: string): Uint32Array
        free(): void
    }
    
    export function encoding_for_model(model: string): Tiktoken
}

