import Blockchain from "./blockchain.js"
import Transaction from "./transaction.js"
import Utils from "./utils.js"

const express = require("express");
const bodyParser = require('body-parser');
const uuid = require("uuid/v1");
const rp = require("request-promise");
const { spawn } = require('child_process');
const elliptic = require("elliptic");
const random_string = require("randomstring");
const eccrypto = require("eccrypto");
const fs = require("fs");
const sha256 = require("sha256");
const EC = require('elliptic').ec;

const listenPort = process.argv[2];
const currentNodeUrl = process.argv[3];

export default class NetworkNode
{
    constructor(blockchain)
    {
        this.blockchain = blockchain;
        this.app = express();
        this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(bodyParser.json());

        this.app.use(function(req, res, next) {
            var err = null;
            try {
                decodeURIComponent(req.path)
            }
            catch (e) {
                err = e;
            }

            if (err) {
                return res.status(400).end("Bad request. Aren't you trying to hijack our little blockchain ? Mh ?");
            }
            next();
        });

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
            let body = request.body.base;
            let object = request.body.transactionObject;
            if (body && body.amount && body.recipient && body.sender && body.signature && object) {

                if (!this.blockchain.validAddress(body.sender) || !this.blockchain.validAddress(body.recipient)) {
                    result.json({note: "Invalid recipient or sender address"});
                    return;
                }
                var ec = new EC('secp256k1');

                if (body.amount != object.amount || body.recipient !== object.recipient && body.sender !== object.sender) {
                    return;
                }

                let t = {
                    amount: body.amount,
                    recipient: body.recipient,
                    sender: body.sender,
                    initiated: body.initiated
                }
                let key = ec.keyFromPublic(body.sender, "hex");
                let hash = sha256(JSON.stringify(t));
                if (key.verify(hash, body.signature)) { // address authentified
                    let datas = this.blockchain.getAddressData(body.sender);
                    
                    if (datas.balance >= body.amount) {
                        let newTransaction = new Transaction(object);
                        this.blockchain.addToPendingTransactions(newTransaction);

                        result.json({note: `Transaction accepted`, alive: true, newTransaction});
                    } else {
                        result.json({note: `Transaction rejected due to insufficient amount from ${body.sender}, need ${body.amount} and have ${datas.balance.toFixed(6)}`, alive: true, t});
                    }
                } else {
                    console.log(`Invalid transaction... you are not ${body.sender}`);
                    result.json({node: `Invalid transaction... you are not ${body.sender}`});
                }
            }
        });
        
        this.app.get("/mine", (request, result) => {
            let prevBlock = this.blockchain.getLastBlock();
            let transactions = [...this.blockchain.pendingTransactions];
            let datas = {
                transactions: transactions,
                index: prevBlock.id + 1
            }

            if (transactions.length == 0) {
                result.json({note: `No transaction to mine !`});
                return;
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
                this.blockchain.addPendingBlock(newBlock);

                this.broadcastBlock(newBlock, () => {
                    result.json({note: `One block mined and broadcasted to other nodes`, block: newBlock});
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
            if (body && body.amount && body.recipient && body.sender && body.signature && body.initiated) {

                if (!this.blockchain.validAddress(body.sender) || !this.blockchain.validAddress(body.recipient)) {
                    result.json({note: "Invalid recipient or sender address"});
                    return;
                }
                var EC = require('elliptic').ec;
                var ec = new EC('secp256k1');

                let t = {
                    amount: body.amount,
                    recipient: body.recipient,
                    sender: body.sender,
                    initiated: body.initiated
                }
                let hash = sha256(JSON.stringify(t));
                let key = ec.keyFromPublic(body.sender, "hex");
                if (key.verify(hash, body.signature)) { // address authentified
                    let datas = this.blockchain.getAddressData(body.sender);
                    
                    if (datas.balance >= body.amount) {
                        let newTransaction = this.blockchain.createNewTransaction(hash, body.amount, body.sender, body.recipient, Utils.convertNumArrayToHexString(body.signature), body.initiated);
                        this.blockchain.addToPendingTransactions(newTransaction);
                        
                        result.json({note: `Transaction accepted and broadcasted`, alive: true, newTransaction});
                        this.broadcastTransaction({base: body, transactionObject: newTransaction});
                    } else {
                        result.json({note: `Transaction rejected due to insufficient amount from ${body.sender}, need ${body.amount} and have ${datas.balance.toFixed(6)}`, alive: true, t});
                    }
                } else {
                    result.json({node: `Invalid transaction... you are not ${body.sender}`});
                }
            }
        });

        this.app.post('/receive-new-block', (request, result) => {
            let block = request.body;
            if (block && block.id && block.transactions && 
                block.nonce && block.hash && block.prevBlockHash && block.timestamp) {
                    let lastBlock = this.blockchain.getLastBlock();
                    let correctLastHash = lastBlock.hash === block.prevBlockHash;
                    let correctIndex = block.id == this.blockchain.getNewBlockIndex();
                
                    if (correctLastHash && correctIndex && this.blockchain.checkNewBlock(block)) {
                        
                        if (this.blockchain.isValidChain([...this.blockchain.chain, block])) {
                            result.json({alive: true, note: "New block added to the possible winners list", block: block});
                            this.blockchain.addPendingBlock(block);
                        } else {
                            result.json({alive: true, note: "New block invalid", block: block});
                        }
                    } else {
                        console.log(`${lastBlock.hash} VS ${block.prevBlockHash}`);
                        console.log(correctLastHash, correctIndex, this.blockchain.checkNewBlock(block));
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
                        this.blockchain.pendingTransactions = newChain.pendingTransactions;
                        this.blockchain.chain = newChain.chain;

                        result.json({alive: true, note: 'Current chain updated to a new larger one', chain: newChain});
                        return;
                    }
                }
                result.json({alive: true, note: 'Current chain seems to be valid and up to date', chain: this.blockchain.chain});
            })
        });

        this.app.get('/address/:id', (request, result) => {
            if (request.params.id) {
                let datas = this.blockchain.getAddressData(request.params.id);
                result.json({address:datas});
            }
        });

        this.app.get('/generateAddress', (request, result) => {
            result.json(this.blockchain.generateNewWallet());
        });
    }
    

    listen() 
    {
        this.app.listen(listenPort, () => {
            console.log(`Network node (${this.blockchain.currentNodeAddress().public_key}) listening on port ${listenPort}...`);
        }).on('error', (e) => { console.log(`An error occured while trying to start the network node ${e}`); });
    }
}
