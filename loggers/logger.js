const buildDevLogger = require("./devLogger");
const buildProdLogger = require("./prodLogger");

let logger = null;

if(process.env.DEBUG_MODE){
    logger = buildDevLogger();
} else {
    logger = buildProdLogger();
}

module.exports = logger;