let router = require('express').Router();
let bodyParser = require('body-parser');
router.use(bodyParser.json()); // support json encoded bodies
router.use(bodyParser.urlencoded({ extended: true }));
let jwt = require('jsonwebtoken');
let secretKey = require('../config/nodeConfig').jwtSecretKey;

//middleware to verify the
router.use(function (req, res, next) {
    // check header or url parameters or post parameters for token
    console.log("req.headers: ", req.headers['x-access-token'])
    let tokenData = req.headers['x-access-token'];

    // decode token
    if (tokenData) {
        let token = tokenData.split(" ")[1];
        console.info("token is", token)
        // verifies secret and checks exp
        jwt.verify(token, secretKey,function (err, decoded) {
            if (err) {
                    console.error("Error:", err, err.name )
                    if(err.name == 'TokenExpiredError')
                        return res.status(401).json({ status: 0, message: 'Session expired.' });
                    else
                        return res.status(401).json({ status: 0, message: 'Unauthorized' });
            } else {
                // if everything is good, save to request for use in other routes
                console.log("passed")
                req.decoded = decoded;
                req.token = {"userId": decoded.userId, "orgId": decoded.orgId, "type": decoded?.type || null, "userName": decoded.userName, "encodedToken": token || null };
                next();
            }
        });
    } else {
        // if there is no token
        // return an error
        return res.status(403).send({ status: 0, message: 'No token provided.' });
    }
});

// check user is blocked or not





module.exports = router;