import Blockchain from "./blockchain.js"
import Transaction from "./transaction.js"

const express = require("express");
const bodyParser = require('body-parser');
const uuid = require("uuid/v1");
const rp = require("request-promise");
const { spawn }= require('child_process');

const listenPort = process.argv[2];
const nodeAddress = uuid().split("-").join("");
const currentNodeUrl = process.argv[3];

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

    broadcastNewNode(newNode, callback)
    {
        let promises = [];
        let i = 0;
        let nodesCount = this.blockchain.networkNodes.length;
        for (var node of this.blockchain.networkNodes) {
            
            ((currentNode) => {
                rp({
                    method: "POST",
                    uri: `${node}/register-node`,
                    body: { newNodeUrl: newNode },
                    json: true,
                    timeout: 1500
                }).then((answer) => {
                    i++;
                    
                    if (currentNode != currentNodeUrl) {
                        if (!answer.alive) { // || check node address validity ?
                            this.blockchain.removeNode(newNode);
                        }
                    }
                    
                    if (i == nodesCount)
                        callback();
                }).catch((error) => {
                    i++;
                    this.blockchain.removeNode(node);
                    if (i == nodesCount)
                        callback();
                });
                
            })(node);
        }
    }

    broadcastTransaction(transaction) 
    {
        for (var node of this.blockchain.networkNodes) {
            if (node != currentNodeUrl) {
                rp({
                    method: "POST",
                    uri: `${node}/transaction`,
                    body: transaction,
                    json: true,
                    timeout: 1500
                }).then(() => {}).catch(() => {});
            }
        }
    }

    broadcastBlock(block, callback)
    {
        let i = 0;
        let nodesCount = this.blockchain.networkNodes.length - 1;
        
        if (nodesCount <= 0) {
            callback();
            return;
        }
        for (var node of this.blockchain.networkNodes)
        {
            if (node != currentNodeUrl) {
                rp({
                    method: "POST",
                    uri: `${node}/receive-new-block`,
                    body: block,
                    json: true,
                    timeout: 1500
                }).then(() => {
                    i++;
                    if (i == nodesCount)
                        callback();
                }).catch(() => {
                    i++;
                    if (i == nodesCount)
                        callback();
                });
            }
        }
    }

    getNodesBlockchain(callback)
    {
        let i = 0;
        let nodesCount = this.blockchain.networkNodes.length - 1;
        let chains = [];


        if (nodesCount <= 0) {
            callback([]);
            return;
        }
        for (var node of this.blockchain.networkNodes) 
        {
            if (node != currentNodeUrl) {
                rp({
                    method: "GET",
                    uri: `${node}/blockchain`,
                    json: true,
                    timeout: 1500
                }).then((blockchain) => {
                    if (blockchain) {
                        chains.push(blockchain);
                    }
                    i++;
                    if (i == nodesCount)
                        callback(chains);
                }).catch(() => {
                    i++;
                    if (i == nodesCount)
                        callback(chains);
                });
            }
        }
    }

    setRoutes()
    {
        this.app.get("/blockchain", (request, result) => {
            result.send(this.blockchain);
        });
        
        this.app.post("/transaction", (request, result) => {
            let body = request.body;
            if (body && body.id && body.amount && body.sender && body.recipient) {
                let transaction = new Transaction(body);
                this.blockchain.addToPendingTransactions(transaction);

                result.json({alive: true, note: `Transaction will be added in block ${this.blockchain.getNewBlockIndex()}`});
            }
        });
        
        this.app.get("/mine", (request, result) => {
            let prevBlock = this.blockchain.getLastBlock();
            let transactions = [...this.blockchain.pendingTransactions];
            let datas = {
                transactions: transactions,
                index: prevBlock.id + 1
            }

            let powResult = '';

            let child = spawn('node', ['srcs/pow.js', prevBlock.hash, JSON.stringify(datas), this.blockchain.hash_need]);
            child.stdout.on('data', (data) => {
                powResult += data;
            });

            child.on('exit',  (code, signal) => {
                let nonce = Number(powResult);
                let newBlockHash = this.blockchain.hashBlock(prevBlock.hash, datas, nonce);

                let lastBlock = this.blockchain.getLastBlock();

                if (prevBlock.hash != lastBlock.hash) {
                    console.log('I mined one block but it was already mined by another bastard ! No reward this time :(');
                    return;
                }
                let newBlock = this.blockchain.createNewBlock(nonce, prevBlock.hash, newBlockHash, transactions);
                this.broadcastBlock(newBlock, () => {

                    console.log("I mined a block and broadcasted it, now i have won a reward, awesome !");
                    rp({
                        method: "POST",
                        uri: `${currentNodeUrl}/transaction/broadcast`,
                        body: {
                            amount: 0.5,
                            sender: "00",
                            recipient: nodeAddress
                        },
                        json: true,
                        timeout: 1500
                    }).then(() => { result.json({note: `New block successfully mined && broadcasted`, block: newBlock}); }).catch(() => {});
                });    
            });
        });

        // register one new node and send it to other nodes already known
        this.app.post('/register-and-broadcast-node', (request, result) => {
           if (request.body.newNodeUrl) {
               let newNodeUrl = request.body.newNodeUrl;
               result.json({alive: true});

                /*
                ** check if node url is valid by a ping pong request ?
                ** can be fake spoof nodes to ddos or down the blockchain
                */
                this.blockchain.addNewNode(newNodeUrl);
                this.broadcastNewNode(newNodeUrl, () => {
                    rp({
                        method: "POST",
                        uri: `${newNodeUrl}/register-nodes-bulk`,
                        body: { nodes: this.blockchain.networkNodes },
                        json: true,
                        timeout: 1500
                    }).then(() => {}).catch(() => {});
                });
           } 
        });

        // only register
        this.app.post('/register-node', (request, result) => {
            if (request.body.newNodeUrl) {
                result.json({alive: true});
                this.blockchain.addNewNode(request.body.newNodeUrl);
                // add check node
            }
        });

        // register multiples nodes at once
        this.app.post('/register-nodes-bulk', (request, result) => {
            if (request.body.nodes) {
                result.json({alive: true});
                for (var node of request.body.nodes) {
                    this.blockchain.addNewNode(node);
                }
            }
        });

        // send a transaction to other nodes
        this.app.post('/transaction/broadcast', (request, result) => {
            let body = request.body;
            if (body && body.amount && body.sender && body.recipient) {
                let newTransaction = this.blockchain.createNewTransaction(Number(body.amount), body.sender, body.recipient);
                result.json({note: `Transaction created and broadcasted`, alive: true, newTransaction});
                this.blockchain.addToPendingTransactions(newTransaction);
                this.broadcastTransaction(newTransaction);
            }
        });

        this.app.post('/receive-new-block', (request, result) => {
            let block = request.body;
            if (block && block.id && block.transactions && 
                block.nonce && block.hash && block.prevBlockHash && block.timestamp) {
                    let lastBlock = this.blockchain.getLastBlock();
                    let correctLastHash = lastBlock.hash === block.prevBlockHash;
                    let correctIndex = block.id == this.blockchain.getNewBlockIndex();
                    
                    if (correctLastHash && correctIndex) {
                        result.json({alive: true, note: "New block accepted", block: block});
                        this.blockchain.addNewBlock(block);

                        if (!this.blockchain.isValidChain(this.blockchain.chain)) {
                            rp({
                                method: "POST",
                                uri: `${currentNodeUrl}/consensus`,
                                body: { nodes: this.blockchain.networkNodes },
                                json: true,
                                timeout: 1500
                            }).then(() => {}).catch(() => {});

                            console.log(`Something went wrong with my blockchain :(`);
                        }

                    } else {
                        result.json({alive: true, note: "New block refused", block: block});
                    }
                } else {
                    console.log(block);
                }
        });

        //longuest chain rule 
        this.app.get('/consensus', (request, result) => {
            this.getNodesBlockchain((blockchains) => {
                if (blockchains.length > 0) {
                    let maxLen = this.blockchain.chain.length;
                    let newChain = null;
                    for (var blockchain of blockchains) {
                        if (blockchain.chain && blockchain.chain.length > maxLen) {
                            maxLen = blockchain.chain.length;
                            newChain = blockchain;
                        }
                    }

                    if (newChain && this.blockchain.isValidChain(newChain.chain)) {
                        // if chain not sync all 'legit' transactions sent to it are lost ?
                        this.blockchain.pendingTransactions = newChain.pendingTransactions;
                        this.blockchain.chain = newChain.chain;

                        result.json({alive: true, note: 'Current chain updated to a new larger one', chain: newChain});
                    } else {
                        result.json({alive: true, note: 'Current chain seems to be valid and up to date', chain: this.blockchain.chain});
                    }
                } else result.json({alive: true, note: 'Current chain seems to be valid and up to date', chain: this.blockchain.chain});
            })
        });
    }
    

    listen() 
    {
        this.app.listen(listenPort, () => {
            console.log(`Network node (${nodeAddress}) listening on port ${listenPort}...`);
        }).on('error', (e) => { console.log(`An error occured while trying to start the network node ${e}`); });
    }
}
