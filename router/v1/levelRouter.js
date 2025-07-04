let express = require("express");
let router = express.Router();
let levelController = require("../../controllers/levelController")

router.post("/",  levelController.saveLevelData);



router.patch("/", levelController.patchLevelData);


router.get("/", levelController.getLevelData); 




module.exports = router