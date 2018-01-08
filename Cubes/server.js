"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var express = require("express");
var compression = require("compression");
var server;
var app = express();
// Settings
app.disable('x-powered-by');
app.set("strict routing", true);
app.set("case sensitive routing", true);
app.use(compression());
// Routes
app.get("/", function (req, res, next) {
    var filePath = path.resolve('../client/index.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    }
    else {
        next();
    }
});
app.use(express.static(path.resolve('../client/')));
app.all("*", function (req, res) {
    console.log(req.path, "Not found");
    resError(res, 404);
});
function resError(res, errCode, errMsg) {
    if (errMsg === undefined) {
        switch (errCode) {
            case 400:
                errMsg = "Bad Request";
                break;
            case 401:
                errMsg = "Unauthorized ";
                break;
            case 403:
                errMsg = "Forbidden ";
                break;
            case 404:
                errMsg = "Not Found";
                break;
            case 503:
                errMsg = "Service Unavailable";
                break;
        }
    }
    res.status(errCode).json({
        error: errMsg
    });
}
// Start Server
server = app.listen(8088, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Server listening on %s:%s", host, port);
});
server.addListener("close", function () {
    console.log("Server closed");
});
//# sourceMappingURL=server.js.map