let model = require('../models/index');
const { Op } = require("sequelize");

const getReportToken = async (req, res) => {
  try {
    let queryParams = req.query;

    let _offset = parseInt(queryParams._offset) || 0;
    let _count = parseInt(queryParams._count) || 200;
    let _lastUpdated = queryParams._lastUpdated;

    let whereCondition = {};
    
    if (_lastUpdated) {
      const operator = _lastUpdated.substring(0, 2); // ge, gt, le, lt
      const dateValue = new Date(_lastUpdated.substring(2).replace(" ", "+"));

      let sequelizeOp;

      switch (operator) {
        case "ge":
          sequelizeOp = Op.gte;
          break;
        case "gt":
          sequelizeOp = Op.gt;
          break;
        case "le":
          sequelizeOp = Op.lte;
          break;
        case "lt":
          sequelizeOp = Op.lt;
          break;
        default:
          sequelizeOp = Op.gt;
      }

      whereCondition.updatedAt = {
        [sequelizeOp]: dateValue,
      };
    }

    let order = [["updatedAt", "ASC"]];

    const result = await model.ReportToken.findAndCountAll({
      attributes: ["appointmentId", "token"],
      where: whereCondition,
      offset: _offset,
      limit: _count,
      order,
    });

    const hasMore = _offset + _count < result.count;

    return res.status(200).json({
      status: hasMore ? 1 : 2,
      message: "Report token fetched",
      total: result.count,
      offset: _offset,
      data: result.rows,
    });

  } catch (e) {
    console.error("getReportToken Error", e);
    return res.status(500).json({
      status: 0,
      message: "Unable to process. Please try again.",
      err: e,
    });
  }
};

module.exports = { getReportToken }