import { COMMAND, TxIndependentCommandBase } from "./commands";
import { template_base_trnsfiopubky } from "./txIndependent/template_base_trnsfiopubky"
import { HexString } from "types/internal";
import { findNextPowerOfTwo } from "./utils/utils";
import { MerkleNodeWithoutHash } from "./tree";
import assert from "assert";

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

const buildMerkleTreeFromCommands = (commands: Array<TxIndependentCommandBase>) => {
    // First we need to add padding to "command" levels, so that the number of "leafs" in ich subtree is a power of 2
    const paddedCommands = addPaddingToCommands(commands);
    const treeBase = buildPlainTreeFromPaddedCommands(paddedCommands); // TODO implement this function
    const treeWithDfsIds = addDfsIdsToTree(treeBase); // TODO implement this function
    const treeWithDfsAndBfsIds = addBfsIdsToTree(treeWithDfsIds) // TODO implement this function
    const merkleTree = fillMerkleHashesToTree(treeWithDfsAndBfsIds); // TODO implement this function
    return merkleTree;
}

export const buildMerkleTree = () => {
    const commands = aggregateAllTemplates();
    return buildMerkleTreeFromCommands(commands);
}
