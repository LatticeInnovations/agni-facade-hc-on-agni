let model = require('../models/index');

const getTimestamp = async (req, res) => {
    try{
        let token= req.accessToken
        let timestamp = await model.userTimeMap.findAll({ attributes: ['uuid', 'timestamp']});
        res.json({ status: 1, message: "timestamp fetched", data : timestamp });
    }
    catch(e){
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            err: e
        });
    }
} 

const updateTimestamp = async (req, res) => {
    try{
        let token= req.accessToken
        let data = req.body;
        data = data.map((d) => {
            d.orgId = token.orgId;
            return d;
        });      
        await model.userTimeMap.bulkCreate(data, { updateOnDuplicate: [ 'timestamp', 'orgId' ] });
        res.json({ status: 1, message: "timestamp updated", data });
    }
    catch(e){
        return res.status(500).json({
            status: 0,
            message: "Unable to process. Please try again.",
            err: e
        });
    }
}

module.exports = {
    getTimestamp,
    updateTimestamp
}