const jwt = require('jsonwebtoken')

const TERMINALS_JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";

const checkTerminalLoginController = async (req, res, next) => {
    const authHeader = req.body.headers.authorization
    console.log('CHECK TERMINAL LOGIN CONTROLLER')
    console.log(authHeader)
    console.log(req.body)
    console.log(req.headers)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.send({ status: 406, data: { msg: 'nedostaje token' } })
    }
    else {
        console.log(authHeader)
        const token = authHeader.split(' ')[1]

        try {
            const decoded = jwt.verify(token, TERMINALS_JWT_SECRET)
            const { t} = decoded
            req.data = { t},
            console.log(req.data)
            console.log('checkTerminalLogin')
            res.send({ status: 200, data: { data:req.data,msg: 'token je valjan' } })
        } catch (error) {
            console.log(error)
            res.send({ status: 406, data: { msg: 'Not authorized to access this route bla bla bla' } })
        }
    }
};

module.exports = { 
    checkTerminalLoginController
}