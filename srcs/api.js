import Blockchain from "./blockchain.js"

const express = require("express");
const bodyParser = require('body-parser');

export default class WebAPI
{
    constructor(listenPort, blockchain, nodeAddress)
    {
        this.listenPort = listenPort;
        this.blockchain = blockchain;
        this.nodeAddress = nodeAddress;

        this.app = express();
        this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(bodyParser.json());
        
        this.setRoutes();
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

            this.blockchain.createNewTransaction(0.5, "00", this.nodeAddress);

            let newBlock = this.blockchain.createNewBlock(nonce, prevBlock.hash, newBlockHash);
            result.json({note: `New block successfully mined`, block: newBlock});
        });
    }

    listen() 
    {
        this.app.listen(this.listenPort, () => {
            console.log(`API listening on port ${this.listenPort}...`);
        });
    }
}

