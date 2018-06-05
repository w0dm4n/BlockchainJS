import Blockchain from "./blockchain.js"

const express = require("express");
const bodyParser = require('body-parser');

const listenPort = 3000;

export default class WebAPI
{
    constructor(listenPort)
    {
        this.app = express();
        this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(bodyParser.json());
        
        this.setRoutes();
    }

    setRoutes()
    {
        this.app.get("/blockchain", (request, result) => {
            
        });
        
        this.app.post("/transaction", (request, result) => {
            console.log(`Express de merde ${request.body.slt}`);
        });
        
        this.app.get("/mine", (request, result) => {
            
        });
    }

    listen() 
    {
        this.app.listen(listenPort, () => {
            console.log(`API listening on port ${listenPort}...`);
        });
    }
}
