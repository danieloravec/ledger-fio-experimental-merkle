import * as fs from 'fs';
import { buildMerkleTree } from '../interactions/experimentalTemplates/templateAggregator';

const writeMerkleTreeToFile = () => {
    const merkleTree = buildMerkleTree();
    const treeJson = JSON.stringify(merkleTree, null, 2);
    fs.writeFileSync('./dist/visuals/merkleTree.json', treeJson);
}

const printUrl = () => {
    console.log('Please visit: file://' + __dirname + '/treeVisualizer.html');
    console.log(`Then paste contents of dist/visuals/merkleTree.json into the text box and push the button.`);
}

writeMerkleTreeToFile();
printUrl();
