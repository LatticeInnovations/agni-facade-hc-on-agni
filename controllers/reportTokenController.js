let model = require('../models/index');

const getReportToken = async (req, res) => {
  try {
    let queryParams = req.query;

    let _offset = parseInt(queryParams._offset) || 0;
    let _count = parseInt(queryParams._count) || 200;

    const result = await model.ReportToken.findAndCountAll({
      attributes: ["appointmentId", "token"],
      offset: _offset,
      limit: _count,
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