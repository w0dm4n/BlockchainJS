import Blockchain from "./blockchain.js"
import Block from "./block.js"
import NetworkNode from "./networkNode.js"

if (process.argv.length == 4) {
    let blockchain = new Blockchain();
    let node = new NetworkNode(blockchain);
    node.listen();
} else {
    console.log("Please provide a port for the network node as argument and a url");
}

// let webAPI = new WebAPI(listenPort, blockchain, nodeAddress);
// webAPI.listen();