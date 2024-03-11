const {createLogger, format, transports} = require('winston');
const {combine, timestamp, json, errors} = format;

function buildProdLogger(){
    
    return createLogger({
        level: "info",
        format: combine(
          timestamp(),
          errors({stack: true}),
          json(),
        ),
        transports: [
          new transports.File({ filename: './logs/logs.log' })
        ]
    });
}

module.exports = buildProdLogger;