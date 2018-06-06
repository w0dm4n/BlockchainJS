import Blockchain from "./blockchain.js"
import Block from "./block.js"
import WebAPI from "./api.js"

const uuid = require("uuid/v1");
const listenPort = 3000;

let blockchain = new Blockchain();
let nodeAddress = uuid().split("-").join("");
let webAPI = new WebAPI(listenPort, blockchain, nodeAddress);
webAPI.listen();