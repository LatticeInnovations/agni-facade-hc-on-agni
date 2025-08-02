let router = require('express').Router();
let bodyParser = require('body-parser');
router.use(bodyParser.json()); // support json encoded bodies
router.use(bodyParser.urlencoded({ extended: true }));
let jwt = require('jsonwebtoken');
let secretKey = require('../config/nodeConfig').jwtSecretKey;
const roles = require("../utils/role.json")
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
                req.decoded.orgId = req.decoded?.orgId || "1";
                req.accessToken = token;
                const typeIndex = roles.findIndex(e => e.userTypeId === decoded.user_type_id)
                req.decoded.userId = req.headers["sync-user-fhir-id"] ? req.headers["sync-user-fhir-id"] : req.decoded?.fhir_id || null;
                req.token = {"userId": req.decoded.userId, "orgId": req.decoded?.orgId || "1", "type": roles?.[typeIndex]?.display || null || null, "userName": req.decoded.user_id, email: req.decoded.sub, "encodedToken": token || null };
                console.log("check here: ", req.decoded, req.token)
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