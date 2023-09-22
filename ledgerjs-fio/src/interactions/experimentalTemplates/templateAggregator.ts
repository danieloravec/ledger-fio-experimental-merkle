import { COMMAND, TxIndependentCommandBase } from "./commands";
import { template_base_trnsfiopubky } from "./txIndependent/template_base_trnsfiopubky"
import { HexString } from "types/internal";
import { findNextPowerOfTwo } from "./utils/utils";
import { MerkleNodeWithoutHash, DfsNodeId, BfsNodeId, MerkleNode } from "./tree";
import assert from "assert";
import { Queue } from 'queue-typescript';
import { createHash } from "crypto";

const makeInitCommands = (): Array<TxIndependentCommandBase> => {
    return [
        {
            name: COMMAND.INIT,
            params: {},
        },
        {
            name: COMMAND.APPEND_DATA,
            params: {
                minBufLen: 10,
                maxBufLen: 10,
                show: false
            }
        },
        {
            name: COMMAND.APPEND_CONST_DATA,
            params: {
                data: "0000000001" as HexString
            },
        },
    ];
}

const makeEndCommands = (): Array<TxIndependentCommandBase> => {
    return [
        {
            name: COMMAND.APPEND_CONST_DATA,
            params: {
                data: "000000000000000000000000000000000000000000000000000000000000000000" as HexString,
            }
        },
        {
            name: COMMAND.FINISH,
            params: {},
        }
    ];
}

const aggregateAllTemplates = (): Array<TxIndependentCommandBase> => {
    // TODO be careful about the order of templates. The order will affect the hash tree.
    const templateBases = [
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
        if (command.name === COMMAND.START_FOR) {
            const paddedChildCommands = addPaddingToCommands(command.params.children);
            command.params.children = paddedChildCommands;
        } else {
            updatedCommands.push(command);
        }
    }

    // For the ease of implementation, we always want at least 2 command nodes on each "command" level.
    // This way, the root of the tree will always be a NonCommandMerkleNode. That's why there's Math.max in the next line.
    const numOfPaddingCommands = Math.max(findNextPowerOfTwo(updatedCommands.length), 2) - updatedCommands.length;
    for (let i = 0; i < numOfPaddingCommands; i++) {
        updatedCommands.push({
            name: COMMAND.NONE,
            params: {}
        });
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
        if (command.name === COMMAND.START_FOR) {
            const childTreeRootNonCommand = buildPlainTreeFromPaddedCommands(command.params.children);
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
    let inTime = 0;
    const addDfsIdsToNode = (node: MerkleNodeWithoutHash): DfsNodeId => {
        const dfsId: DfsNodeId = {
            inTime,
            outTime: -1,
        };
        inTime++;
        [node.leftChild, node.rightChild].forEach(child => {
            if (child) {
                dfsId.outTime = addDfsIdsToNode(child).outTime;
            }
        });
        node.dfsId = dfsId;
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
    // TODO change the JSON.stringify part to something more reasonable
    return Buffer.from([commandBase.name.toString(), JSON.stringify(commandBase.params)].join('#'), 'utf-8');
}

const serializeDfsId = (dfsId?: DfsNodeId): Buffer => {
    if (!dfsId) {
        return Buffer.from("0", 'utf-8');
    }
    return Buffer.from(["0", dfsId.inTime.toString(), dfsId.outTime.toString()].join('#'), 'utf-8');
}

const serializeBfsId = (bfsId?: BfsNodeId): Buffer => {
    if (!bfsId) {
        return Buffer.from("1", 'utf-8');
    }
    return Buffer.from(["1", bfsId.commandLevel.toString(), bfsId.levelSeqNumber.toString()].join('#'), 'utf-8');
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
        let serializedNodeToHash = Buffer.from("");
        if (node.commandBase) {
            serializedNodeToHash = Buffer.from([
                node.side,
                serializeCommandBase(node.commandBase),
                serializeBfsId(node.bfsId),
                serializeDfsId(node.dfsId),
                leftChildWithHash?.hash ?? "",
                rightChildWithHash?.hash ?? "",
            ].join("#"), 'utf-8');
        } else {
            serializedNodeToHash = Buffer.from((leftChildWithHash?.hash ?? "") + (rightChildWithHash?.hash ?? ""), 'utf-8');
        }
        const hash = createHash("sha256").update(serializedNodeToHash).digest("hex") as HexString;
        return {
            side: node.side,
            leftChild: leftChildWithHash,
            rightChild: rightChildWithHash,
            dfsId: node.dfsId ?? { inTime: -1, outTime: -1 },
            bfsId: node.bfsId ?? { commandLevel: -1, levelSeqNumber: -1 },
            hash
        }
    }
    return fillMerkleHashesToNode(root);
}

const buildMerkleTreeFromCommands = (commands: Array<TxIndependentCommandBase>): MerkleNode => {
    // First we need to add padding to "command" levels, so that the number of "leafs" in ich subtree is a power of 2
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
