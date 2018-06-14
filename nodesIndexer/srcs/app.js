const express = require("express");
const bodyParser = require('body-parser');
const rp = require("request-promise");
const fs = require("fs");

class NodeIndexer
{
    constructor(port)
    {
        this.app = express();
        this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(bodyParser.json());

        this.app.use((req, res, next) => {
            var err = null;
            try {
                decodeURIComponent(req.path)
            }
            catch (e) {
                err = e;
            }

            if (err) {
                return res.status(400).end("Bad request. Aren't you trying to hijack our little indexer ? Mh ?");
            }
            next();
        });


        this.nodes = [];
        this.loadNodes();
        this.setRoutes();
        this.checkNodes();

        this.app.listen(port, () => {
            console.log(`Nodes indexer listening on port ${port}...`);
        }).on('error', (e) => { console.log(`An error occured while trying to start the nodes indexer ${e}`); });
    }

    saveNodes()
    {
        fs.writeFileSync("nodes.json", JSON.stringify({nodes: this.nodes}), "utf8");
    }

    loadNodes()
    {
        try {
            let contents = fs.readFileSync("nodes.json");
            if (contents) {
                let datas = JSON.parse(contents.toString());
                this.nodes = datas.nodes;
            }
            return true;
        } catch (e) { 
            return false;
        }
    }

    nodeExist(url) 
    {
        for (var node of this.nodes) {
            if (node.url == url) {
                return true;
            }    
        }
        return false;
    }

    addNewNode(node)
    {
        let obj = {url: node, timeout: 0};
        if (!this.nodeExist(node)) {
            this.nodes.push(obj);
        }
    }

    setRoutes()
    {
        this.app.post("/connect", (request, result) => {
            if (request.body && request.body.nodeUrl) {
                let newNodeUrl = request.body.nodeUrl;
                this.addNewNode(newNodeUrl);
            }
            result.json({nodes: this.nodes})
        });
    }

    checkNodes()
    {
        setInterval(() => {
            let i = 0;
            let validNodes = [];
            let nodesCount = this.nodes.length;
            let replaceNodes = (updatedNodes) => {
                this.nodes = updatedNodes;

                console.log(`Nodes replaced, ${this.nodes.length} alives.`);
                this.saveNodes();
            };
            
            for (var node of this.nodes) {

                ((currentNode) => {
                    rp({
                        method: "POST",
                        uri: `${currentNode.url}/ping`,
                        body: {nodes: this.nodes},
                        json: true,
                        timeout: 1500
                    }).then((answer) => {
                        i++;
                        if (answer && answer.alive == true) {
                            currentNode.timeout = 0;
                            validNodes.push(currentNode);
                        }
                        if (i == nodesCount)
                            replaceNodes(validNodes);
                    }).catch((e) => {
                        i++;
                        currentNode.timeout++;

                        if (currentNode.timeout < 5) {
                            validNodes.push(currentNode);
                        }
                        
                        if (i == nodesCount)
                            replaceNodes(validNodes);
                    });
                })(node);
            }
        }, 5000);
    }
}

let indexer = new NodeIndexer(3333);