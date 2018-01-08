import fs = require('fs')
import path = require('path')
import http = require('http')
import * as express from 'express'
import * as compression from 'compression'

let server: http.Server
const app = express()

// Settings
app.disable('x-powered-by')
app.set("strict routing", true)
app.set("case sensitive routing", true)
app.use(compression())

// Routes
app.get("/", (req, res, next) => {
    let filePath = path.resolve('../client/index.html')

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        next()
    }
})
app.use(express.static(path.resolve('../client/')));
app.all("*", (req, res) => {
    console.log(req.path, "Not found")
    resError(res, 404)
})
function resError(res: express.Response, errCode: number, errMsg?: string) {

    if (errMsg === undefined) {
        switch (errCode) {
            case 400: errMsg = "Bad Request"; break
            case 401: errMsg = "Unauthorized "; break
            case 403: errMsg = "Forbidden "; break
            case 404: errMsg = "Not Found"; break
            case 503: errMsg = "Service Unavailable"; break
        }
    }

    res.status(errCode).json({
        error: errMsg
    })
}

// Start Server
server = app.listen(8088, () => {

    let host = server.address().address
    let port = server.address().port

    console.log("Server listening on %s:%s", host, port)
})

server.addListener("close", () => {
    console.log("Server closed")
})