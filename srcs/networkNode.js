import Blockchain from "./blockchain.js"

const express = require("express");
const bodyParser = require('body-parser');
const uuid = require("uuid/v1");
const rp = require("request_promise");

const listenPort = process.argv[2];
const nodeAddress = uuid().split("-").join("");

export default class NetworkNode
{
    constructor(blockchain)
    {
        this.blockchain = blockchain;
        this.app = express();
        this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(bodyParser.json());
        
        this.setRoutes();
    }

    broadcastNodes(newNodeUrl)
    {
        for (var node of this.blockchain.networkNodes) {
            
        }
    }

    setRoutes()
    {
        this.app.get("/blockchain", (request, result) => {
            result.send(this.blockchain);
        });
        
        this.app.post("/transaction", (request, result) => {
            let body = request.body;
            if (body.amount && body.sender && body.recipient) {
               let block = this.blockchain.createNewTransaction(Number(body.amount), body.sender, body.recipient);
               result.json({note: `Transaction will be added in block ${block}`});
            }
        });
        
        this.app.get("/mine", (request, result) => {
            let prevBlock = this.blockchain.getLastBlock();
            let datas = {
                transactions: this.blockchain.pendingTransactions,
                index: prevBlock.index + 1
            }

            let nonce = this.blockchain.proofOfWork(prevBlock.hash, datas);
            let newBlockHash = this.blockchain.hashBlock(prevBlock.hash, datas, nonce);

            this.blockchain.createNewTransaction(0.5, "00", nodeAddress);

            let newBlock = this.blockchain.createNewBlock(nonce, prevBlock.hash, newBlockHash);
            result.json({note: `New block successfully mined`, block: newBlock});
        });

        // register one new node and send it to other nodes already known
        this.app.post('/register-and-broadcast-node', (request, result) => {
           if (request.body.newNodeUrl) {
               let newNodeUrl = request.body.newNodeUrl;

                if (this.blockchain.networkNodes.indexOf(newNodeUrl) == -1) {
                    this.blockchain.networkNodes.push(newNodeUrl); // check if node url is valid by a ping pong request ?
                }
                this.broadcastNode(newNodeUrl);
           } 
        });

        // only register
        this.app.post('/register-node', (request, result) => {
            if (request.body.newNodeUrl) {
                
            }
        });

        // register multiples nodes at once
        this.app.post('/register-nodes-bulk', (request, result) => {
            
        });
    }

    listen() 
    {
        this.app.listen(listenPort, () => {
            console.log(`Network node listening on port ${listenPort}...`);
        }).on('error', (e) => { console.log(`An error occured while trying to start the network node ${e}`); });
    }
}

