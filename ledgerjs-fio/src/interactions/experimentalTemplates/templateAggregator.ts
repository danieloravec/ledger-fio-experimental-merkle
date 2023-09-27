import {
    TxIndependentCommandBase,
    BASE_COMMAND_INIT,
    BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW,
    BASE_COMMAND_FINISH,
    BASE_COMMAND_APPEND_CONST_DATA,
    BASE_COMMAND_NONE
} from "./baseCommands";
import { template_base_trnsfiopubky } from "./txIndependent/template_base_trnsfiopubky"
import { HexString } from "types/internal";
import { findNextPowerOfTwo } from "./utils/utils";
import { MerkleNodeWithoutHash, DfsNodeId, BfsNodeId, MerkleNode } from "./tree";
import assert from "assert";
import { Queue } from 'queue-typescript';
import { createHash } from "crypto";

const DFS_BFS_ID_NO_VALUE = 0xffffffff;

const makeInitCommands = (): Array<TxIndependentCommandBase> => {
    return [
        BASE_COMMAND_INIT(),
        BASE_COMMAND_APPEND_DATA_BUFFER_DO_NOT_SHOW(10, 10),
        BASE_COMMAND_APPEND_CONST_DATA("0000000001" as HexString),
    ];
}

const makeEndCommands = (): Array<TxIndependentCommandBase> => {
    return [
        BASE_COMMAND_APPEND_CONST_DATA("000000000000000000000000000000000000000000000000000000000000000000" as HexString),
        BASE_COMMAND_FINISH(),
    ];
}

const aggregateAllTemplates = (): Array<TxIndependentCommandBase> => {
    // TODO be careful about the order of templates. The order will affect the hash tree.
    let templateBases = [
        template_base_trnsfiopubky
    ];

    return templateBases.map(base => {
        return [
            ...makeInitCommands(),
            ...base(),
            ...makeEndCommands()
        ]
    }).flat();
};

// Makes sure that each "command" level in the "intuitive" tree has a size of a power of 2
// so that a binary tree can be built easily over those levels.
const addPaddingToCommands = (commands: Array<TxIndependentCommandBase>): Array<TxIndependentCommandBase> => {
    const updatedCommands: Array<TxIndependentCommandBase> = [];
    for (const command of commands) {
        if (command.children) {
            const paddedChildCommands = addPaddingToCommands(command.children);
            command.children = paddedChildCommands;
        } else {
            updatedCommands.push(command);
        }
    }

    // For the ease of implementation, we always want at least 2 command nodes on each "command" level.
    // This way, the root of the tree will always be a NonCommandMerkleNode. That's why there's Math.max in the next line.
    const numOfPaddingCommands = Math.max(findNextPowerOfTwo(updatedCommands.length), 2) - updatedCommands.length;
    for (let i = 0; i < numOfPaddingCommands; i++) {
        updatedCommands.push(BASE_COMMAND_NONE());
    }

    return updatedCommands;
}

const buildPlainTreeFromPaddedCommands = (commands: Array<TxIndependentCommandBase>): MerkleNodeWithoutHash => {

    // Phase 1: Build a subtree of each START_FOR command, transform all commands to nodes
    const commandNodesLevel = [];
    for (const [index, command] of commands.entries()) {
        const side = index % 2 === 0 ? "left" : "right";

        let commandNode: MerkleNodeWithoutHash = {
            commandBase: command,
            side
        };
        if (command.children) {
            const childTreeRootNonCommand = buildPlainTreeFromPaddedCommands(command.children);
            // Transform the new root into a command one
            commandNode = {
                ...childTreeRootNonCommand,
                ...commandNode,
            };
        }
        commandNodesLevel.push(commandNode);
    }

    // Phase 2: The tree is already recursively built below, now we need to build the tree above all the way to root
    let nodesLevel = commandNodesLevel;
    while (nodesLevel.length > 1) {
        assert(nodesLevel.length % 2 === 0, "The number of nodes on each level should be even (and a power of 2)")
        const nextNodesLevel: Array<MerkleNodeWithoutHash> = [];
        for (let i = 0; i < nodesLevel.length; i += 2) {
            const leftChild = nodesLevel[i];
            const rightChild = nodesLevel[i + 1];
            const side = i % 4 == 0 ? "left" : "right";
            const nonCommandNode: MerkleNodeWithoutHash = {
                leftChild,
                rightChild,
                side,
            };
            nextNodesLevel.push(nonCommandNode);
        }
        nodesLevel = nextNodesLevel;
    }

    return nodesLevel[0];
}

const addDfsIdsToTree = (root: MerkleNodeWithoutHash): MerkleNodeWithoutHash => {
    let currTime = 0;
    const addDfsIdsToNode = (node: MerkleNodeWithoutHash): DfsNodeId => {
        const dfsId: DfsNodeId = {
            inTime: currTime,
            outTime: DFS_BFS_ID_NO_VALUE,
        };
        currTime++;
        [node.leftChild, node.rightChild].forEach(child => {
            if (child) {
                addDfsIdsToNode(child);
            }
        });
        dfsId.outTime = currTime;
        currTime++;
        node.dfsId = dfsId;
        console.log(JSON.stringify(node.dfsId));
        return dfsId;
    }
    addDfsIdsToNode(root);
    return root;
}

const addBfsIdsToTree = (root: MerkleNodeWithoutHash): MerkleNodeWithoutHash => {
    // Also store prevCommandLevel besides the node, because we want to skip non-command nodes in numbering
    // This is because we need to be able to say that the next allowed instruction is from (currentLevel - 1).
    // If we also included non-command nodes in this numbering, then the previous command-level would be (currentLevel - x),
    // where x could be any natural number.
    const queue = new Queue<[MerkleNodeWithoutHash, number]>();
    queue.enqueue([root, -1]);
    let levelSeqNumber = 0;
    while (queue.length > 0) {
        const [node, prevCommandLevel] = queue.dequeue();
        let prevCommandLevelForChild = prevCommandLevel;
        if (node.commandBase) {
            node.bfsId = {
                commandLevel: prevCommandLevel + 1,
                levelSeqNumber,
            };
            prevCommandLevelForChild = node.bfsId.commandLevel;
            levelSeqNumber++;
        } else {
            levelSeqNumber = 0;
        }
        [node.leftChild, node.rightChild].forEach(child => {
            if (child) {
                queue.enqueue([child, prevCommandLevelForChild]);
            }
        });
    }
    return root;
}

const serializeCommandBase = (commandBase: TxIndependentCommandBase): Buffer => {
    return Buffer.concat([
        Buffer.from([commandBase.name]),
        Buffer.from(commandBase.serializedConstData, "hex")
    ]);
}

// This takes up 9 bytes:
//   -> 1 byte is for the "00" prefix (differentiating this from BFS ID)
//   -> 4 bytes for inTime (or FF FF FF FF if not present)
//   -> 4 bytes for outTime (or FF FF FF FF if not present)
const serializeDfsId = (dfsId?: DfsNodeId): Buffer => {
    if (!dfsId) {
        dfsId = { inTime: DFS_BFS_ID_NO_VALUE, outTime: DFS_BFS_ID_NO_VALUE };
    }

    const inTimeBuffer = Buffer.alloc(4);
    inTimeBuffer.writeUInt32LE(dfsId.inTime, 0);

    const outTimeBuffer = Buffer.alloc(4);
    outTimeBuffer.writeUInt32LE(dfsId.outTime, 0);

    return Buffer.concat([
        Buffer.from("00", 'hex'),
        inTimeBuffer,
        outTimeBuffer
    ]);
}

// This takes up 9 bytes:
//   -> 1 byte is for the "01" prefix (differentiating this from DFS ID)
//   -> 4 bytes for commandLevel (or FF FF FF FF if not present)
//   -> 4 bytes for levelSeqNumber (or FF FF FF FF if not present)
const serializeBfsId = (bfsId?: BfsNodeId): Buffer => {
    if (!bfsId) {
        bfsId = { commandLevel: DFS_BFS_ID_NO_VALUE, levelSeqNumber: DFS_BFS_ID_NO_VALUE };
    }

    const commandLevelBuffer = Buffer.alloc(4);
    commandLevelBuffer.writeUInt32LE(bfsId.commandLevel, 0);

    const levelSeqNumberBuffer = Buffer.alloc(4);
    levelSeqNumberBuffer.writeUInt32LE(bfsId.levelSeqNumber, 0);

    return Buffer.concat([
        Buffer.from("01", 'hex'),
        commandLevelBuffer,
        levelSeqNumberBuffer
    ]);
}

// Takes up 1 + 9 + 9 + 32 + 32 + ? bytes
//  -> 1 byte for side (left / right)
//  -> 9 bytes for DFS ID
//  -> 9 bytes for BFS ID
//  -> 32 bytes for left child hash
//  -> 32 bytes for right child hash
//  -> ? bytes for commandBase (if present)
const serializeMerkleNodeWithoutHash = (node: MerkleNodeWithoutHash, leftChildHash?: string, rightChildHash?: string): Buffer => {
    const zeroHash = "0000000000000000000000000000000000000000000000000000000000000000";
    if (!leftChildHash) {
        leftChildHash = zeroHash;
    }
    if (!rightChildHash) {
        rightChildHash = zeroHash;
    }
    const serializedSide = Buffer.from(node.side === "left" ? "00" : "01", "hex");
    const serializedLeftChildHash = Buffer.from(leftChildHash, "hex");
    const serializedRightChildHash = Buffer.from(rightChildHash, "hex");
    const serializedBufferWithoutCommandBase = Buffer.concat([
        serializedSide,
        serializeDfsId(node.dfsId),
        serializeBfsId(node.bfsId),
        serializedLeftChildHash,
        serializedRightChildHash,
    ]);
    if (node.commandBase) {
        return Buffer.concat([
            serializedBufferWithoutCommandBase,
            serializeCommandBase(node.commandBase),
        ]);
    }
    return serializedBufferWithoutCommandBase;
}

const fillMerkleHashesToTree = (root: MerkleNodeWithoutHash): MerkleNode => {
    const fillMerkleHashesToNode = (node: MerkleNodeWithoutHash): MerkleNode => {
        let leftChildWithHash: MerkleNode | undefined = undefined;
        let rightChildWithHash: MerkleNode | undefined = undefined;
        if (node.leftChild) {
            leftChildWithHash = fillMerkleHashesToNode(node.leftChild);
        }
        if (node.rightChild) {
            rightChildWithHash = fillMerkleHashesToNode(node.rightChild);
        }
        let serializedNodeToHash = serializeMerkleNodeWithoutHash(node, leftChildWithHash?.hash, rightChildWithHash?.hash);
        const hash = createHash("sha256").update(serializedNodeToHash).digest("hex") as HexString;
        return {
            side: node.side,
            leftChild: leftChildWithHash,
            rightChild: rightChildWithHash,
            dfsId: node.dfsId ?? { inTime: DFS_BFS_ID_NO_VALUE, outTime: DFS_BFS_ID_NO_VALUE },
            bfsId: node.bfsId ?? { commandLevel: DFS_BFS_ID_NO_VALUE, levelSeqNumber: DFS_BFS_ID_NO_VALUE },
            hash
        }
    }
    return fillMerkleHashesToNode(root);
}

const buildMerkleTreeFromCommands = (commands: Array<TxIndependentCommandBase>): MerkleNode => {
    // First we need to add padding to "command" levels, so that the number of "leafs" in each subtree is a power of 2
    const paddedCommands = addPaddingToCommands(commands);
    const treeBase = buildPlainTreeFromPaddedCommands(paddedCommands);
    const treeWithDfsIds = addDfsIdsToTree(treeBase);
    const treeWithDfsAndBfsIds = addBfsIdsToTree(treeWithDfsIds);
    const merkleTreeRoot = fillMerkleHashesToTree(treeWithDfsAndBfsIds);
    return merkleTreeRoot;
}

export const buildMerkleTree = (): MerkleNode => {
    const commands = aggregateAllTemplates();
    return buildMerkleTreeFromCommands(commands);
}
