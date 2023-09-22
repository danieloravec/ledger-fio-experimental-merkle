import { TxIndependentCommandBase } from "./commands";
import { HexString } from "types/internal";


export type MerkleNodeSide = "left" | "right";

export type DfsNodeId = {
    inTime: number;
    outTime: number;
}

export type BfsNodeId = {
    commandLevel: number;
    levelSeqNumber: number;
}

export type MerkleNodeWithoutHash = {
    side: MerkleNodeSide,
    commandBase?: TxIndependentCommandBase, // Only "command" nodes will have this filled
    leftChild?: MerkleNodeWithoutHash,
    rightChild?: MerkleNodeWithoutHash,
    dfsId?: DfsNodeId,
    bfsId?: BfsNodeId,
}

export type MerkleNode = {
    side: MerkleNodeSide,
    commandBase: TxIndependentCommandBase, // Only "command" nodes will have this filled TODO do we need this here?
    leftChild?: MerkleNode,
    rightChild?: MerkleNode,
    dfsId: DfsNodeId,
    bfsId: BfsNodeId,
    hash: HexString,
}
