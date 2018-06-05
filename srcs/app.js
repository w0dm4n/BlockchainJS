import Blockchain from "./blockchain.js"
import Block from "./block.js"

let blockchain = new Blockchain();

// let prevBlock = blockchain.createNewBlock(4488445, "", "EFE1X23W8");
// blockchain.createNewTransaction(0.50, "xXRichGuyxX", "XxPoorBastardXx");
// console.log(blockchain);

// blockchain.createNewTransaction(1.50, "XxPoorBastardXx", "xXRichGuyxX");
// let curBlock = blockchain.createNewBlock(4215875, "", "EF45WF5zXE");
// blockchain.createNewTransaction(0.50, "xXRichGuyxX", "XxPoorBastardXx");
// blockchain.createNewBlock(47878, "EFE1X23W8", "EFGEEFGECX");
// console.log(blockchain);
//console.log(blockchain.hashBlock("EFE1X23W8", curBlock, curBlock.nonce));
// let nonce = blockchain.proofOfWork("EFE1X23W8", curBlock.transactions);
// console.log(nonce);
// let test = new Block(JSON.parse('{"id":666,"transactions":[],"nonce":4488445,"hash":"EFE1X23W8","prevBlockHash":"","timestamp":1528228215025}'));
// console.log(test);